# PM Tool

A local-first project management desktop application built with Python Flask and Electron.

## Tech Stack

- **Backend:** Flask 3.x (local-only, bound to `127.0.0.1:5050`, configurable via `PM_TOOL_PORT`)
- **Shell:** Electron (Chromium desktop wrapper with native IPC bridge)
- **Database:** SQLite with connection pooling, WAL mode, foreign keys, stored in `%LOCALAPPDATA%\PMTool\pmtool.db`
- **UI / Frontend:** Server-rendered Jinja2 templates, native CSS tokens, offline-first IBM Plex fonts
- **Packaging:** PyInstaller (headless Flask backend) + electron-builder (NSIS installer & portable Windows binaries)

---

## Project Structure

```text
pm_tool/
├── .gitignore
├── README.md
├── requirements.txt         # Backend Python dependencies
├── version.json             # Version configuration
├── main.py                  # Flask entry point & server lifecycle
├── routes.py                # REST APIs & template routes
├── db.py                    # SQLite connection pool & migrations
├── notifier.py              # Desktop notification bridge
├── flask.spec               # PyInstaller specification
├── build.bat                # Automated release build script
├── electron/
│   ├── package.json         # Electron scripts and builder config
│   ├── main.js              # Electron window & backend process manager
│   ├── preload.js           # Safe IPC context bridge
│   ├── icon.ico
│   └── icon.png
├── static/
│   ├── favicon.ico
│   ├── icon.png
│   └── fonts/               # Offline IBM Plex Sans & Mono fonts
└── templates/
    ├── shell.html           # Main desktop window layout & sidebar
    └── home.html            # Dashboard overview view
```

---

## Development

### 1. Setup Python Environment
```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Run Flask Backend (Terminal 1)
```bash
python main.py
```
> Flask runs at `http://127.0.0.1:5050`

### 3. Run Electron Shell (Terminal 2)
```bash
cd electron
npm install
npm start
```

---

## Release Build

To build the standalone Windows installer and portable executable:

```bash
# Ensure PyInstaller is installed in your Python environment
pip install pyinstaller

# Run the build script
.\build.bat
```

Output binaries will be placed in `release/`:
- `release/PM Tool-Setup-1.0.0.exe` (Installer)
- `release/PM Tool-1.0.0.exe` (Portable)
