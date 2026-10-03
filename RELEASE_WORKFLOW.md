# PM Tool — Release & Packaging Workflow

This document explains the build pipeline, executable packaging, and release publication workflow for **PM Tool**.

---

## 1. Architecture Overview

PM Tool distributes as a standalone desktop application on Windows:
- **Flask Backend:** Packaged into a headless binary using **PyInstaller** (`flask.spec`).
- **Electron Shell:** Packaged with **electron-builder** into both an **NSIS Installer** (`.exe`) and a **Portable Executable** (`.exe`).
- **Extra Resources:** The compiled Flask binary is bundled directly inside Electron's `resources/flask/` directory.

```text
build.bat
  ├── 1. Activates Python Virtual Environment
  ├── 2. Runs PyInstaller flask.spec ───► dist/flask/ (headless backend)
  ├── 3. Installs Electron dependencies ──► electron/node_modules/
  └── 4. Runs electron-builder ──────────► release/
                                            ├── PM Tool-Setup-<version>.exe (Installer)
                                            ├── PM Tool-<version>.exe       (Portable)
                                            ├── latest.yml                  (Update manifest)
                                            └── *.blockmap                  (Delta download map)
```

---

## 2. Prerequisites for Building

1. **Python 3.11+** with virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt pyinstaller
   ```
2. **Node.js (v18+) & npm**:
   ```powershell
   node --version
   npm --version
   ```

---

## 3. Step-by-Step: Publishing a New Release

### Step 1: Bump Version Number
Update the version string in the following files:
1. `version.json`:
   ```json
   {
     "version": "1.0.0",
     "app_name": "PM Tool",
     "build_date": "2026-10-03"
   }
   ```
2. `electron/package.json`:
   ```json
   {
     "name": "pm-tool",
     "version": "1.0.0",
     ...
   }
   ```

### Step 2: Run the Build Pipeline
In PowerShell from the repository root:
```powershell
# Disable code signing identity auto-discovery (avoids prompt if you do not have an EV certificate)
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"

# Run automated release build
.\build.bat
```

The script runs all 4 phases and outputs the binaries to the `release\` directory:
- `release\PM Tool-Setup-<version>.exe`
- `release\PM Tool-<version>.exe`
- `release\latest.yml`
- `release\PM Tool-Setup-<version>.exe.blockmap`

---

## 4. GitHub Release Publication

1. Navigate to your GitHub repository Releases page:
   `https://github.com/<owner>/<repo>/releases/new`
2. **Tag:** `v<version>` (e.g., `v1.0.0`)
3. **Title:** `PM Tool v<version>`
4. **Description:** Copy relevant release notes from [`CHANGELOG.md`](file:///C:/Users/Pranshul%20Chopra/OneDrive/Desktop/Project/pm_tool/CHANGELOG.md).
5. **Attach Assets (Drag & Drop):**
   - `PM Tool-Setup-<version>.exe` *(Primary installer)*
   - `PM Tool-<version>.exe` *(Portable edition)*
   - `latest.yml` *(Required if using auto-updates via electron-updater)*
   - `PM Tool-Setup-<version>.exe.blockmap` *(Enables differential delta updates)*
6. Click **Publish release**.

---

## 5. Verification & Smoke Testing Checklist

Before distributing any build, verify the packaged installer on a clean Windows machine or VM:
- [ ] Run `PM Tool-Setup-<version>.exe` to verify installation succeeds.
- [ ] Launch PM Tool from Desktop shortcut.
- [ ] Verify Electron window boots without console errors.
- [ ] Verify Flask starts automatically and `/api/ping` returns `200 OK`.
- [ ] Check `%LOCALAPPDATA%\PMTool\pmtool.db` exists with WAL and SHM files.
- [ ] Open Settings / LLM status and test:
  - Ollama probe (reports running models or offline cleanly).
  - API key saving and encryption round-trip.
- [ ] Close the application window and verify in Task Manager that both `pm-tool.exe` and `flask.exe` terminate completely (no zombie processes).
