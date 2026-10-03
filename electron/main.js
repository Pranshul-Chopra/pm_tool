/**
 * electron/main.js — PM Tool desktop shell
 *
 * Responsibilities:
 * 1. Spawn the local Flask backend (python main.py or bundled exe)
 * 2. Cascading handshake: discover active port from stdout, runtime_port.json, or by cascading ping
 * 3. Open BrowserWindow pointing at the discovered local URL
 * 4. Kill Flask backend process tree cleanly when the Electron window closes
 */

const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const CANDIDATE_PORTS = [5050, 5051, 5052, 5053, 5054, 5055, 5056, 5057, 5058, 5059, 5060];
let activeFlaskPort = process.env.PM_TOOL_PORT ? parseInt(process.env.PM_TOOL_PORT, 10) : 5050;
let activeFlaskUrl = `http://127.0.0.1:${activeFlaskPort}`;

let mainWindow = null;
let flaskProcess = null;

// ── Native Desktop Notification handler ──────────────────────────────────────
ipcMain.on('electron-notify', (_event, payload) => {
  try {
    if (Notification && Notification.isSupported()) {
      const title = (payload && payload.title) || 'PM Tool';
      const body = (payload && payload.body) || '';
      const iconPath = path.join(__dirname, 'icon.png');
      const n = new Notification({
        title,
        body,
        icon: iconPath,
        silent: false,
      });
      n.show();
    }
  } catch (err) {
    console.error('Failed to dispatch native notification:', err);
  }
});

ipcMain.handle('app-is-packaged', () => app.isPackaged);

// ── Port Handshake Utilities ──────────────────────────────────────────────────

function getRuntimePortFilePath() {
  const base = process.env.LOCALAPPDATA || path.join(require('os').homedir(), '.pmtool');
  return path.join(base, 'PMTool', 'runtime_port.json');
}

function tryReadRuntimePort() {
  try {
    const file = getRuntimePortFilePath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data && data.port && (Date.now() - (data.timestamp * 1000) < 60000)) {
        return parseInt(data.port, 10);
      }
    }
  } catch (_) {}
  return null;
}

function probePortPing(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/ping`, (res) => {
      if (res.statusCode === 200) {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json && json.app === 'pm_tool' && json.status === 'ok') {
              return resolve(true);
            }
          } catch (_) {}
          resolve(false);
        });
      } else {
        resolve(false);
      }
    });
    req.on('error', () => resolve(false));
    req.setTimeout(400, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForFlaskCascading(retries = 40, interval = 250) {
  for (let attempt = 0; attempt < retries; attempt++) {
    // 1. Build priority list of candidate ports
    const filePort = tryReadRuntimePort();
    const portsToProbe = [];

    if (filePort && !portsToProbe.includes(filePort)) portsToProbe.push(filePort);
    if (!portsToProbe.includes(activeFlaskPort)) portsToProbe.push(activeFlaskPort);
    for (const p of CANDIDATE_PORTS) {
      if (!portsToProbe.includes(p)) portsToProbe.push(p);
    }

    // 2. Cascade probe across candidate ports
    for (const port of portsToProbe) {
      const ok = await probePortPing(port);
      if (ok) {
        activeFlaskPort = port;
        activeFlaskUrl = `http://127.0.0.1:${port}`;
        console.log(`[handshake] Successfully connected to PM Tool on port ${port}`);
        return activeFlaskUrl;
      }
    }

    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error('Flask backend did not respond on any candidate port within expected time.');
}

// ── Flask Backend Management ──────────────────────────────────────────────────

function stopFlask() {
  if (!flaskProcess) return;
  const proc = flaskProcess;
  flaskProcess = null;

  try {
    if (proc.exitCode !== null || proc.killed) {
      return;
    }

    if (process.platform === 'win32' && proc.pid) {
      const isDev = !app.isPackaged;
      const imagePattern = isDev ? 'python*' : 'flask*';
      spawn('taskkill', ['/pid', proc.pid.toString(), '/fi', `IMAGENAME eq ${imagePattern}`, '/f', '/t'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } else if (proc.pid) {
      proc.kill('SIGTERM');
    }
  } catch (err) {
    console.error('Error terminating Flask process:', err);
  }
}

function startFlask() {
  const isDev = !app.isPackaged;
  let cmd, args, cwd;

  if (isDev) {
    cmd = process.platform === 'win32' ? 'python' : 'python3';
    args = ['main.py'];
    cwd = path.join(__dirname, '..');
  } else {
    cmd = path.join(process.resourcesPath, 'flask', 'flask.exe');
    args = [];
    cwd = path.join(process.resourcesPath, 'flask');
  }

  flaskProcess = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  if (flaskProcess.stdout) {
    flaskProcess.stdout.on('data', (data) => {
      const text = data.toString();
      const match = text.match(/\[PM_TOOL_HANDSHAKE\] PORT=(\d+)/);
      if (match) {
        activeFlaskPort = parseInt(match[1], 10);
        activeFlaskUrl = `http://127.0.0.1:${activeFlaskPort}`;
        console.log(`[handshake stdout] Discovered port ${activeFlaskPort}`);
      }
    });
  }

  if (flaskProcess.stderr) {
    flaskProcess.stderr.on('data', (data) => {
      console.error(`[flask stderr] ${data.toString().trim()}`);
    });
  }

  flaskProcess.on('error', (err) => {
    console.error('Flask failed to start:', err);
    flaskProcess = null;
  });

  flaskProcess.on('exit', () => {
    flaskProcess = null;
  });
}

// ── Window Lifecycle ──────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#111110',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(`${activeFlaskUrl}/`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    startFlask();
    try {
      await waitForFlaskCascading();
      createWindow();
    } catch (err) {
      console.error(err);
      createWindow();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  stopFlask();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopFlask();
});
