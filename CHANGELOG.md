# Changelog

All notable changes to **PM Tool** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-10-03

### 📋 Interactive Sprint Kanban Board & Agile Execution Engine
- **Sprint Kanban Studio (`templates/board.html` & `/board` route)**:
  - 4 status workflow lanes: **Backlog** (`todo`), **In Progress** (`in_progress`), **Blocked** (`blocked`), and **Completed** (`done`).
  - Native HTML5 drag-and-drop mechanics with optimistic UI updates, visual hover targets, and background persistence (`PATCH /api/tasks/:id`).
  - Sprint KPI metrics header: Total Tasks, Active/In-Flight items, Blockers alert badge, Velocity completion rate (`% Done`) with visual progress bar, and Fibonacci story points tracking.
  - Multi-dimensional filtering by Project, Priority (`critical`, `high`, `medium`, `low`), and instant substring search.
  - Dedicated "Sprint Board" sidebar tab in `shell.html` with cross-frame synchronization (`broadcastToFrames`) and direct navigation from Project Overview.

### 🤖 Automated PRD-to-Story Decomposer Tool (`tools/story_decomposer.py`)
- **Deterministic Backlog Generation (`/api/tools/breakdown` & `/breakdown` slash command)**:
  - Analyzes raw PRD text or existing project objectives/architecture notes.
  - Prompts LLM Gateway (8,192 token output budget) to generate 4–8 discrete, testable Agile user stories.
  - Generates Given/When/Then acceptance criteria, priority weights, and Fibonacci story points (1, 2, 3, 5, 8).
  - Deterministically saves generated stories into `pmtool.db` (`tasks`) with telemetry logging in `ai_context.db` (`tool_runs`).

### 🗄️ Database Schema Migration v5 (`db.py`)
- **Agile Task Columns**:
  - Added `story_points` (INTEGER), `acceptance_criteria` (TEXT), and `assignee` (TEXT) to `tasks` table via non-destructive migration.
  - Enhanced `get_tasks()` with joined project names/domains, status ordering, and multi-field keyword search.
  - Added `get_sprint_metrics()` for instant calculation of lane distributions and velocity stats.

## [1.2.0] - 2026-10-03

### 🔄 In-App Auto-Updating & GitHub Releases Pipeline
- **Automated Update Subsystem (`electron/main.js` & `electron/preload.js`)**:
  - Integrated `electron-updater` with GitHub Releases (`Pranshul-Chopra/pm_tool`).
  - Automatic background update checks executed 3 seconds after application launch and every 4 hours thereafter.
  - Background delta downloading for NSIS installed builds using `.blockmap` differential files.
  - Graceful backend shutdown: executes `stopFlask()` prior to calling `autoUpdater.quitAndInstall()` to release SQLite database locks and terminate all Python worker processes cleanly.
  - Safe IPC bridge (`electronUpdater`) exposing `onStatus`, `restartAndInstall`, `checkForUpdates`, and `getInfo`.
- **In-App Toast & Shell Status (`templates/shell.html`)**:
  - Floating glassmorphic updater toast (`#app-updater-toast`) with real-time download progress bar and percentage display.
  - Interactive sidebar version strip (`#sb-version-strip`) with pulsing update notification dot (`#sb-update-indicator`) and manual update check trigger.
  - Portable mode detection providing direct browser download links to the release.
- **Automated CI/CD Workflow (`.github/workflows/release.yml`)**:
  - GitHub Actions workflow compiling the Flask backend with PyInstaller and packaging the Electron app via `electron-builder --publish always` upon pushing `v*` git tags.

### 🎨 Bespoke PmT Brand Identity & Multi-Resolution Icons
- **New App Icon Design (`static/icon.png`, `electron/icon.png`, `electron/icon.ico`)**:
  - Replaced legacy "Pos" branding with distinctive, professional **PmT** (Product Management Tool) icon.
  - Crisp off-white (`#EEEBEA`) "P" on the left paired with warm amber-orange (`#F29E24`) "mT" on the right, aligned on the same bottom baseline.
  - Solid dark charcoal matte squircle container (`#161515`) with transparent corners.
  - Generated full multi-resolution Windows icon (`icon.ico` with 16px, 24px, 32px, 48px, 64px, 128px, 256px), `favicon.ico`, and high-resolution `icon.png` (1024×1024 RGBA).

### ⚡ Interactive Buttonish Slash Command Pill Container
- **Pill Container inside Chat Input (`templates/chat.html`)**:
  - Selecting a slash command from the suggestions menu, clicking a quick chip, or typing `/cmd ` transforms the command into an interactive button-like badge container (`#active-command-pill`) directly before the input textarea.
  - Color-coded glowing badge styles matching the slash suggestion menu:
    - `/search`: Cyan (`mode-search`)
    - `/prd` & `/summarize`: Purple (`mode-doc`)
    - `/plan` & `/metrics`: Amber (`mode-plan`)
    - `/chat`: Blue (`mode-chat`)
  - Integrated `✕` remove button and keyboard Backspace deletion when textarea is empty.
  - Contextual placeholder updates guiding the user on mode-specific prompt phrasing.
  - Outgoing and historical user messages format active slash commands with colored badge pills.

### 📑 Deterministic Document Summarizer & 8,192 Max Output Tokens
- **Deterministic Summarization Tool (`tools/summarizer.py`)**:
  - Deterministic document summarizer tool producing structured executive briefs with ISO metadata frontmatter and SHA256 integrity verification.
  - Full execution telemetry auditing into `ai_context.db` (`tool_runs`).
  - Source document word budget expanded from 12,000 words to **30,000 words**.
- **Increased LLM Generation Budget (`llm/gateway.py`)**:
  - Maximum output token budget raised from 4,096 to **8,192 tokens** across all AI providers (Gemini `maxOutputTokens: 8192`, Ollama `num_predict: 8192` with `num_ctx: 16384`, and OpenAI-compatible endpoints).

### 📊 Documents Table Dual Scrollbars & Sticky Headers
- **Table Navigation (`templates/documents.html`)**:
  - Wrapped indexed documents table in `.table-scroll-wrap` with horizontal and vertical scrolling (`max-height: 480px; overflow-x: auto;`).
  - Enforced table `min-width: 860px` to guarantee action buttons and metadata never wrap or squash on compact displays.
  - Sticky table headers (`th { position: sticky; top: 0; z-index: 5 }`) anchored during vertical scrolling.
  - Dark-theme styled scrollbars matching the application color palette.

### 🔌 Dynamic Cascading Port Collision Resilience
- **Multi-Port Handshake (`routes.py` & `electron/main.js`)**:
  - Cascading port binding across ports `5050` through `5065` preventing collisions with other local developer tools.
  - Tri-channel handshake discovery via stdout regex, `%LOCALAPPDATA%\PMTool\runtime_port.json`, and cascading HTTP `/api/ping` probes.

---

## [1.1.0-mvp] - 2026-10-03

### 📚 Local-First RAG Subsystem & Knowledge Base
- **Multi-Format Document Parsing (`rag/parsers.py`)**:
  - Deep section parsers for `.pdf` (`pypdf`), `.docx` (`python-docx`), `.md`, `.txt`, `.csv`, and `.json`.
  - Section-aware sliding-window chunker (`rag/chunker.py`) preserving markdown heading hierarchies, token estimates, and metadata.
- **SQLite FTS5 BM25 Search Engine (`ai_db.py` & `rag/engine.py`)**:
  - Pure local search with 0MB external server or cloud vector dependencies.
  - SQLite FTS5 full-text index with Porter stemming and BM25 relevance ranking scoring.
  - Change detection comparing file size and modification timestamps to avoid re-indexing untouched files.
- **Knowledge Base Interface (`templates/documents.html`)**:
  - Unified Knowledge Base tab in desktop sidebar shell.
  - Live metric cards: Indexed Documents, Total Knowledge Chunks, Supported File Formats, and RAG status.
  - Interactive test search bar to benchmark BM25 retrieval against indexed specs with live score previews.
  - Registered folder directory manager with one-click Rescan All.
  - Drag-and-drop file upload zone saving directly to `%LOCALAPPDATA%\PMTool\documents`.
  - Document chunk inspector modal allowing deep inspection of individual sections and token counts.
- **RAG-Grounded AI Copilot & Verified Citations (`templates/chat.html` & `routes.py`)**:
  - Automatic retrieval of top-4 relevant chunks injected into system instructions as verified ground truth.
  - Grounded source chips (`📄 file · section`) rendered directly with assistant responses.
  - Dynamic RAG status pill in topbar indicating total active indexed documents and chunks.
  - PM workflow slash command chips (`/prd`, `/metrics`, `/roadmap`, `/user-stories`, `/risks`).
- **PRD Document Generator & Exporter (`tools/document_generator.py`)**:
  - Converts markdown specifications into clean, styled Word documents (`.docx`) with cover metadata, heading hierarchy, callout blocks, and bullet styles.
  - One-click "Export DOCX" and "Copy Text" buttons directly on assistant responses.
  - Endpoints: `POST /api/export/docx`, `POST /api/export/markdown`, and `POST /api/documents/upload`.
- **Intelligent Project Management & Initiative Presets (`templates/home.html`)**:
  - 5 Enterprise PM Presets (SaaS Hub, AI Copilot, Mobile App, Security IAM, High-Scale Infra) autofilling domain, OKRs, tech stack, and scope.
  - Automated seeding of standard PM milestone tasks (PRD, Tech Spec, Telemetry, Security Review, Beta QA).
  - One-click "Generate PRD" button on project cards navigating to Copilot with prefilled context and project scope.

---

## [1.0.0-mvp] - 2026-10-03

### 🚀 Initial Foundation & Local-First Architecture
- **Desktop Shell (Electron 44)**:
  - Sandboxed, context-isolated Chromium window with custom titlebar support and offline asset loading.
  - Child process manager in `electron/main.js` that automatically spawns and manages the Flask HTTP backend.
  - Graceful teardown via `taskkill` ensuring child Python/Flask processes terminate upon window closure.
  - Preload bridge (`electron/preload.js`) for safe IPC notification dispatch.
- **Backend Application Server (Flask 3.x)**:
  - Local-only HTTP server with dynamic cascading port discovery (`5050` through `5065`).
  - Active runtime handshake system writing `%LOCALAPPDATA%\PMTool\runtime_port.json` and emitting stdout signal `[PM_TOOL_HANDSHAKE]`.
  - Security middleware enforcing strict loopback `Origin` and `Sec-Fetch-Site` validation regardless of allocated port.
  - Hardened Content Security Policy (CSP) and nosniff/frame-ancestors security headers.
  - High-concurrency readiness probe `/api/ping` for fast startup synchronization.
- **Storage Layer (SQLite WAL Mode)**:
  - Central database located at `%LOCALAPPDATA%\PMTool\pmtool.db`.
  - Thread-safe connection pool with write-ahead logging (WAL) and foreign keys enabled.
  - Schema migration system (`schema_version`) managing incremental schema upgrades.
  - Initial tables: `projects`, `tasks`, `app_settings`, and `ai_config`.
- **Machine-Bound Secret Encryption**:
  - Authenticated symmetric cipher (`PBKDF2-HMAC-SHA256` + counter-mode keystream + HMAC verification).
  - Derived from local Windows machine seed and user account SID to encrypt API keys stored in SQLite.
  - Prevents credential exposure in plain text backups or drive transfers.

### 🧠 LLM Gateway & Provider Dispatch Layer
- **Multi-Provider Unified Gateway (`llm/gateway.py`)**:
  - Single dispatch entry point (`call_llm`) auto-routing between local Ollama, native Google Gemini, or OpenAI-compatible endpoints.
- **Resilient Cascading Failsafes & Graceful High-Demand Handling**:
  - Multi-tier cascading fallback (`candidate_models[:6]`) seamlessly recovering from deprecated endpoints (`gemini-2.5-flash`), rate limits (HTTP 429), and cluster capacity spikes (HTTP 503).
  - Clean, user-friendly status reporting on busy provider queues without exposing raw internal stack traces.
  - Automatic failover from local Ollama to configured Cloud API in `auto` mode if local model loading stalls.
- **Professional Enterprise PM Behavioural System Prompts**:
  - Principal PM & Technical Architect operational standards: first-principles problem formulation, explicit goals vs non-goals boundaries, Gherkin-formatted acceptance criteria (`Given/When/Then`), North Star & guardrail counter-metrics, two-way door decision matrices, and MoSCoW prioritization.
  - Deep active project context injection grounding all prompts in the target project's domain, health status, strategic OKRs, tech stack, and live task backlog.

### 🎨 Design System & Workspace UI
- **Cross-Tab Reactive State Synchronization**:
  - Event-driven iframe message bridge (`tab_activated`, `llm_config_updated`, `projects_updated`) keeping AI Copilot readiness badges, setup notices, and project context pickers instantly in sync with Settings and Home.
- **Enterprise Project Workspace (`templates/home.html` - Schema v3)**:
  - Upgraded project schema adding domain categories, priority levels, health indicators (`On Track`, `At Risk`, `Blocked`, `Planning`, `Completed`), lead PM owners, target launch dates, strategic OKRs, and architecture notes.
  - Interactive project cards with dynamic task completion progress bars (`X/Y tasks done`, percentage fill).
  - Search and filter toolbar filtering projects dynamically by search query, domain, or health status.
  - Slide-over project detail modal with embedded task manager (add task, toggle completed status, priority tagging) and 1-click "Discuss in Copilot" button.
- **AI Settings UI Panel (`templates/settings.html`)**:
  - Dedicated configuration center for provider selection (`auto`, `ollama`, `api`).
  - Live Ollama probe and model selection dropdown with one-click refresh.
  - Password-masked API key storage, Gemini ModelService discovery, and OpenAI-compatible endpoint probe.
- **AI Copilot Chat Workspace (`templates/chat.html`)**:
  - Dedicated chat studio with conversation thread management sidebar (create, switch, delete).
  - Active project context picker injecting project description and tasks into system instructions.
  - Interactive prompt suggestion chips for PRDs, KPI metrics, architecture decisions, and roadmaps.
  - Live synthesis indicator and unconfigured provider notice banner with 1-click jump to Settings.

### 💾 AI Context & Trace Storage Layer (`ai_db.py`)
- **Dedicated AI Context Database**:
  - Stored at `%LOCALAPPDATA%\AIContextTool\ai_context.db`.
  - Independent WAL-mode pool managing `conversations`, `messages`, and `tool_runs`.
  - Decoupled from operational `pmtool.db` to prevent database lock contention.
- **RESTful Chat & Conversation APIs**:
  - `/api/chat` orchestrating context building, prompt assembly, gateway dispatch, and turn recording.
  - `/api/conversations` (list, create, detail, rename, delete) managing persistent session threads.

### 📦 Build & Release Infrastructure
- **Packaging Pipeline (`build.bat` & `flask.spec`)**:
  - Headless Flask executable packaging via PyInstaller.
  - Dual Windows packaging via electron-builder (NSIS one-click installer + portable standalone exe).
