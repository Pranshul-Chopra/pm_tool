# PM Tool — Release & Packaging Workflow

This document explains the build pipeline, executable packaging, automated CI/CD releases, and in-app auto-updating workflow for **PM Tool**.

---

## 1. Architecture Overview

PM Tool distributes as a standalone local-first desktop application for Windows:
- **Flask Backend:** Packaged into a headless binary using **PyInstaller** (`flask.spec`).
- **Electron Shell:** Packaged with **electron-builder** into both an **NSIS One-Click Installer** (`.exe`) and a **Portable Executable** (`.exe`).
- **Extra Resources:** The compiled Flask binary is bundled inside Electron's `resources/flask/` directory.
- **Auto-Updating Subsystem:** Integrated with **electron-updater** and **GitHub Releases**, delivering differential background delta downloads and in-app restart prompts.

```text
Build & Distribution Flow
========================================================================================
Source Tree
  ├── Flask Backend (main.py, routes.py, rag/, tools/, llm/)
  └── Electron Shell (electron/main.js, preload.js, icon.ico, package.json)
        │
        ├── [1] PyInstaller flask.spec
        │     └──► dist/flask/ (headless backend executable & assets)
        │
        └── [2] electron-builder
              ├── Generates resources/app-update.yml (GitHub Release target)
              ├── Bundles dist/flask/ as extraResources
              └── Outputs to release/
                    ├── PM Tool-Setup-<version>.exe    (1-Click NSIS Installer)
                    ├── PM Tool-<version>.exe          (Portable Executable)
                    ├── PM Tool-Setup-<version>.exe.blockmap (Delta download map)
                    └── latest.yml                     (Auto-update manifest)
```

---

## 2. Prerequisites for Building

1. **Python 3.11 or 3.13** with virtual environment:
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
3. **Environment Flag:**
   When running local builds, set:
   ```powershell
   $env:CSC_IDENTITY_AUTO_DISCOVERY="false"
   ```

---

## 3. Automated CI/CD Release Workflow (GitHub Actions)

PM Tool includes a fully automated, rock-solid GitHub Actions pipeline in [`.github/workflows/release.yml`](file:///.github/workflows/release.yml).

### How It Works:
1. **Triggers:**
   - **Tag Push:** Pushing a tag prefixed with `v` (e.g. `git push origin v1.5.0`) automatically kicks off the workflow.
   - **Manual Dispatch:** Run anytime via the **Actions** tab with optional custom tag input (auto-detects version from `electron/package.json` if omitted).
2. **Compilation & Packaging:**
   - Compiles the backend Flask executable with `PyInstaller flask.spec`.
   - Packages desktop binaries using `npx electron-builder --win --publish never` into the `release/` directory.
3. **Artifact Integrity Verification:**
   - Automatically verifies that `latest.yml` and all `.exe` executables exist in `release/` before publishing.
4. **Reliable GitHub Release Publication (`softprops/action-gh-release@v2`):**
   - Decoupled from `electron-builder`'s internal publisher (which can silently skip uploads or draft releases if tags already exist or git roots differ).
   - Guarantees immediate public publication (`draft: false`, `prerelease: false`, `make_latest: true`).
   - Automatically generates release notes from commit history.
   - Reliably attaches:
     - `PM-Tool-Setup-<version>.exe` (NSIS Installer)
     - `PM-Tool-<version>.exe` (Portable edition)
     - `latest.yml` (Auto-updater discovery metadata)
     - `PM-Tool-Setup-<version>.exe.blockmap` (Differential delta updates)

### Triggering a Release via Git:
```powershell
# 1. Update version numbers (see Step 4 below)
git add -A
git commit -m "chore(release): bump version to 2.0.0"

# 2. Create an annotated git tag
git tag -a v2.0.0 -m "Release v2.0.0 - Desktop SPA Modernization, Command Palette & Automated Updates"

# 3. Push commit and tag to GitHub
git push origin master
git push origin v2.0.0
```

---

## 4. Local Manual Release Workflow

If you prefer building locally or offline without CI/CD:

### Step 1: Version Bumping Checklist
Ensure the target version string is synchronized across all core files:
1. `version.json`:
   ```json
   {
     "version": "2.0.0",
     "app_name": "PM Tool",
     "build_date": "2026-10-06"
   }
   ```
2. `electron/package.json`:
   ```json
   {
     "name": "pm-tool",
     "version": "2.0.0"
   }
   ```
3. `CHANGELOG.md`: Document release notes under `## [2.0.0] - YYYY-MM-DD`.
4. `DEV_HANDBOOK.md`: Update version header to `2.0.0`.

### Step 2: Run the Local Build Script
From the repository root in PowerShell:
```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"
.\build.bat
```

The script runs the 4-stage pipeline:
1. Validates Python environment
2. Compiles Flask backend into `dist\flask\`
3. Compiles Vite React SPA and installs Electron dependencies in `electron\`
4. Runs `electron-builder` and outputs artifacts to `release\`

### Step 3: Manual GitHub Release Publication
1. Navigate to: `https://github.com/Pranshul-Chopra/pm_tool/releases/new`
2. **Tag:** `v2.0.0`
3. **Release Title:** `PM Tool v2.0.0`
4. **Notes:** Copy the markdown summary from `CHANGELOG.md`.
5. **Assets to Attach (Drag & Drop all 4 files from `release\`):**
   - `PM-Tool-Setup-2.0.0.exe` *(Primary installer)*
   - `PM-Tool-2.0.0.exe` *(Portable edition)*
   - `latest.yml` *(CRITICAL for electron-updater background detection)*
   - `PM-Tool-Setup-2.0.0.exe.blockmap` *(CRITICAL for differential delta updates)*
6. Click **Publish release**.

---

## 5. In-App Auto-Update Architecture

The desktop application includes a fully automated self-updating subsystem:

### Lifecycle & Flow:
1. **Automated Startup Check:** 3 seconds after launch, `electron-updater` automatically checks `https://github.com/Pranshul-Chopra/pm_tool/releases/latest/download/latest.yml` in the background. No manual click required.
2. **Periodic Automatic Checks:** A background timer queries for new releases automatically every 60 minutes.
3. **Non-Intrusive Status Indication:** The sidebar displays a live status pill (`v2.0.0 · auto`) reflecting updater states (idle, downloading with spinner, downloaded).
4. **Background Delta Download:**
   - If installed via NSIS, `electron-updater` downloads only changed blocks using the `.blockmap` file.
   - The renderer receives progress percentages via IPC (`updater-status` -> `downloading`) and renders a live progress bar inside `#app-updater-toast`.
5. **Ready & Prompt:**
   - Once downloaded, the in-app toast updates with a **"Restart Now"** button and displays a pulsing indicator dot in the sidebar.
6. **Graceful Application Update:**
   - When the user clicks "Restart Now", Electron triggers `ipcRenderer.send('updater-restart-install')`.
   - The main process executes `stopFlask()` first to release all SQLite file locks and terminate the backend tree.
   - `autoUpdater.quitAndInstall(false, true)` applies the update silently and restarts into the new version.

---

## 6. Verification & Smoke Testing Checklist

Before distributing any new release:
- [ ] Run `PM Tool-Setup-<version>.exe` to verify 1-click installation succeeds.
- [ ] Verify desktop and Start Menu shortcuts are created with the new **PmT** icon.
- [ ] Launch PM Tool and verify single-DOM SPA window boots cleanly without console errors.
- [ ] Verify Flask starts automatically and `/api/ping` succeeds.
- [ ] Verify Command Palette (`Ctrl+K` / `Cmd+K`) opens and filters navigation, projects, and actions.
- [ ] Verify universal shortcuts (`Ctrl+B` toggle sidebar, `Ctrl+1..6` tab switcher).
- [ ] Verify automatic update check triggers in background without user intervention.
- [ ] Close the application window and verify in Task Manager that both `pm-tool.exe` and `flask.exe` terminate completely.
