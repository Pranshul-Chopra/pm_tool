# PM Tool — Developer Handbook

**Document Status:** Current Architecture, Standards, and Engineering Guide  
**Current Version:** 1.5.0  
**Target Platform:** Windows 10/11 Desktop (Local-First, Privacy-Preserving)

---

## 1. Executive Summary & Vision

**PM Tool** is an enterprise-grade product management copilot designed as a high-performance, local-first desktop application. It combines traditional structured project management (projects, tasks, decisions, requirements) with an autonomous AI reasoning engine capable of ingesting local company documentation, drafting Product Requirement Documents (PRDs), searching past organizational decisions, and providing high-leverage PM insights.

### Core Architectural Principle: The Three Pipelines
Instead of the standard brittle approach of dumping all files into a vector store and prompting an LLM to "figure it out", PM Tool separates operations into three distinct pipelines:

1. **Knowledge Pipeline:** Ingests documents (PDF, DOCX, TXT, MD) → semantic chunking → vector storage + BM25 keyword index → hybrid retrieval → structured evidence parsing.
2. **Action Pipeline:** User requests → deterministic router → permission / parameter validation → tool execution → structured output.
3. **Reasoning Pipeline:** User input + active project context + retrieved evidence + decision history → **Context Builder** → LLM Gateway → synthesized answer with citations.

---

## 2. System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      ELECTRON DESKTOP SHELL                            │
│  (electron/main.js & electron/preload.js)                              │
│                                                                        │
│  ├── Sandboxed Chromium Window (autoHideMenuBar, custom styling)       │
│  ├── Cascading Port Collision Resilience (probes 5050..5065)           │
│  ├── Process Supervisor: auto-spawns & manages local Flask HTTP server │
│  ├── In-App Auto-Updater (electron-updater + GitHub Releases)          │
│  │   ├── Startup probe (3s delay) + recurring 4-hour background poll   │
│  │   ├── In-app toast + sidebar update badge + progress bar            │
│  │   └── Graceful Flask tree-kill (stopFlask) before quitAndInstall()  │
│  ├── Electron Notification Bridge (electron-notify IPC)                │
│  └── Preload Bridges: electronUpdater, electronNotifier, electronEnv   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP on 127.0.0.1:5050..5065
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FLASK APPLICATION                               │
│  (main.py + routes.py + notifier.py)                                   │
│                                                                        │
│  ├── Cascading port binding (5050..5065, dynamic discovery handshake)  │
│  ├── Security middleware (strict Origin & Sec-Fetch-Site validation)   │
│  ├── Security headers & CSP (offline font loading, nosniff, DENY frame)│
│  ├── Deterministic Tool Dispatch (document_generator, summarizer, etc.)│
│  └── RESTful APIs for entities, workspace, sprint board, and AI RAG    │
└──────────────┬──────────────────────────────────────────┬──────────────┘
               │                                          │
               ▼                                          ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│     STRUCTURED STORAGE       │          │      AI CONTEXT ENGINE       │
│  (%LOCALAPPDATA%\PMTool)     │          │  (%LOCALAPPDATA%\            │
│                              │          │   AIContextTool)             │
│  └── pmtool.db               │          │                              │
│      ├── projects            │          │  ├── ai_context.db           │
│      ├── tasks (v5 agile)    │          │  │   ├── conversations       │
│      ├── decisions           │          │  │   ├── messages            │
│      ├── app_settings        │          │  │   └── tool_runs           │
│      └── ai_config (enc)     │          │  └── chroma/ (vector store)  │
└──────────────────────────────┘          └──────────────┬───────────────┘
                                                         │
                                                         ▼
                                          ┌──────────────────────────────┐
                                          │      LLM GATEWAY LAYER       │
                                          │  (llm/gateway.py)            │
                                          │                              │
                                          │  ├── Local Ollama            │
                                          │  ├── Native Google Gemini    │
                                          │  └── OpenAI-Compatible APIs  │
                                          └──────────────────────────────┘
```

---

## 3. Directory Layout

```text
pm_tool/
├── .github/
│   └── workflows/
│       ├── release.yml      # Automated GitHub Actions CI/CD for packaging & releases
│       └── ci.yml           # Automated CI build verification for PRs & pushes
├── .gitignore               # Git exclusion list
├── README.md                # Quick-start instructions
├── RELEASE_WORKFLOW.md      # Automated packaging, publishing, and auto-update guide
├── CHANGELOG.md             # Semantic versioning history
├── DEV_HANDBOOK.md          # Technical handbook and architecture specification
├── requirements.txt         # Python dependencies (Flask, requests, plyer, pypdf, python-docx, openpyxl)
├── version.json             # Single source of truth for app version (v1.5.0)
├── main.py                  # Flask application factory, server lifecycle, ping checks
├── routes.py                # REST API controllers and template renderers
├── db.py                    # SQLite connection pool, WAL mode, schema migrations (pmtool.db)
├── ai_db.py                 # SQLite context store, conversation history, and FTS5 BM25 index (ai_context.db)
├── notifier.py              # Cross-platform desktop notification service
├── flask.spec               # PyInstaller build specification
├── build.bat                # 4-stage automated Windows build script
│
├── llm/                     # LLM Gateway and provider abstraction
│   ├── __init__.py
│   └── gateway.py           # Machine-bound encryption, Ollama probe, Gemini discovery, cascading dispatch
│
├── rag/                     # Local-first document ingestion and retrieval pipeline
│   ├── __init__.py
│   ├── parsers.py           # Deep parsers for .pdf, .docx, .md, .txt, .csv, .json
│   ├── chunker.py           # Section-aware sliding-window chunker
│   └── engine.py            # Directory scanner, change detection, and BM25 retrieval
│
├── tools/                   # PM productivity tools
│   ├── __init__.py
│   ├── document_generator.py # Formats markdown into professionally styled .docx documents
│   ├── summarizer.py        # Deterministic document brief summarizer with 8K token budget
│   └── story_decomposer.py  # Deterministic PRD-to-Agile story decomposer with acceptance criteria
│
├── electron/                # Desktop shell
│   ├── package.json         # Electron scripts, auto-updater publish target, builder configuration
│   ├── main.js              # Cascading port discovery, process supervisor, auto-updater lifecycle
│   ├── preload.js           # Isolated IPC bridge (electronUpdater, electronNotifier, electronEnv)
│   ├── icon.ico             # Windows application icon (PmT branding)
│   └── icon.png             # Taskbar/notification icon (PmT branding)
│
├── static/                  # Static assets served by Flask
│   ├── favicon.ico          # PmT favicon
│   ├── icon.png             # PmT web icon
│   └── fonts/               # Offline IBM Plex Sans & Mono woff2 fonts
│       └── ibmflex.css
│
└── templates/               # Jinja2 HTML templates
    ├── shell.html           # Main workstation layout, multi-tab iframe manager, in-app updater toast
    ├── home.html            # Product workspace, initiatives, roadmaps, backlog manager
    ├── board.html           # Interactive drag-and-drop Sprint Kanban Board & velocity tracker
    ├── chat.html            # AI Copilot studio with buttonish slash command pill & DOCX export
    ├── documents.html       # Knowledge Base manager, dual-scrollbar table, FTS5 test bench
    └── settings.html        # AI model configuration, cascading test probes, secret manager
```

---

## 4. Storage Architecture: Two-Database Strategy

To maintain clean separation between operational project metadata and high-frequency AI reasoning traces, data is partitioned across two separate stores:

### 1. Operational Database: `pmtool.db`
- **Location:** `%LOCALAPPDATA%\PMTool\pmtool.db`
- **Managed By:** [`db.py`](file:///C:/Users/Pranshul%20Chopra/OneDrive/Desktop/Project/pm_tool/db.py)
- **Role:** Source of truth for all relational PM entities (projects, tasks, decisions, user preferences).
- **Configuration:** SQLite with Write-Ahead Logging (`PRAGMA journal_mode=WAL`), foreign keys enabled (`PRAGMA foreign_keys=ON`), and thread-safe connection pooling.

#### Current Schema:
```sql
-- Schema migration tracker
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects (Schema v3)
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    domain TEXT NOT NULL DEFAULT 'Platform',
    priority TEXT NOT NULL DEFAULT 'medium',
    health TEXT NOT NULL DEFAULT 'planning',
    owner TEXT DEFAULT '',
    target_date TEXT DEFAULT '',
    goals TEXT DEFAULT '',
    tech_stack TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks Backlog
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents Metadata (Schema v4)
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    last_modified REAL NOT NULL,
    chunk_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'indexed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Watched Knowledge Directories
CREATE TABLE doc_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_path TEXT NOT NULL UNIQUE,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    label TEXT DEFAULT '',
    recursive INTEGER NOT NULL DEFAULT 1,
    last_scanned TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User and application preferences
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Encrypted AI provider configurations
CREATE TABLE ai_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Context & AI Trace Database: `ai_context.db`
- **Location:** `%LOCALAPPDATA%\AIContextTool\ai_context.db`
- **Role:** High-volume AI data (chat sessions, messages, token usage, tool invocation telemetry, chunk indexing metadata).
- **Full-Text BM25 Index:** Uses SQLite FTS5 (`document_chunks_fts`) with Porter stemming.

#### Schema:
```sql
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    project_id INTEGER,
    title TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tool_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT,
    tool_name TEXT NOT NULL,
    input_payload TEXT,
    output_payload TEXT,
    status TEXT NOT NULL,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RAG Knowledge Chunks Store
CREATE TABLE document_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL,
    project_id INTEGER,
    chunk_index INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    section_title TEXT,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SQLite FTS5 BM25 Virtual Table
CREATE VIRTUAL TABLE document_chunks_fts USING fts5(
    content,
    section_title,
    filename,
    content='document_chunks',
    content_rowid='id',
    tokenize='porter unicode61'
);
```

---

## 5. Security & Threat Model

Because PM Tool is designed for confidential business and product data, security is enforced at every layer:

### Localhost Isolation & Origin Verification
- Flask binds strictly to `127.0.0.1:5050` (loopback only, configurable via `PM_TOOL_PORT`).
- All `/api/*` endpoints enforce strict origin checks. Requests with `Sec-Fetch-Site: cross-site` or mismatched `Origin` headers are immediately rejected with `403 Forbidden`.
- Web pages viewed in external browsers cannot tamper with local data or trigger unauthorized tool runs.

### Machine-Bound Secret Encryption
API keys (Google Gemini, OpenAI, Groq, etc.) are never saved in plain text.
- Derived Key: Generated via `PBKDF2-HMAC-SHA256` (100,000 rounds) using the Windows username, machine local app data path, and an application salt.
- Cipher: Counter-mode keystream with a random 16-byte nonce and HMAC-SHA256 integrity tag (`enc_v1:...`).
- Benefit: If the SQLite database is copied to another computer or backup drive, the stored keys cannot be decrypted.

### Content Security Policy (CSP)
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'`
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- `font-src 'self' https://fonts.gstatic.com data:`
- `object-src 'none'`, `frame-ancestors 'none'`

---

## 6. LLM Gateway & Provider Dispatch

The LLM Gateway (`llm/gateway.py`) provides a single polymorphic interface:

```python
from llm import gateway as llm_gateway
import db

result = llm_gateway.call_llm(
    db_module=db,
    system_prompt="You are an enterprise PM assistant.",
    message="Draft the user stories for SSO authentication.",
    history=[{"role": "user", "content": "..."}]
)

if "error" in result:
    print("Error:", result["error"])
else:
    print("Response:", result["response"])
    print("Provider:", result["provider"], "| Model:", result["model"])
```

### Supported Providers:
1. **Ollama (Local Inference):**
   - Base URL: `http://127.0.0.1:11434`
   - Auto-detection: Pings `/api/tags` with a 1.5s timeout.
   - Priority selection: Automatically defaults to installed high-capability models (`llama3.2`, `llama3.1`, `mistral`, `gemma2`, `phi4`).
2. **Google Gemini (Native REST):**
   - Zero SDK overhead: Direct HTTP calls to `generativelanguage.googleapis.com`.
   - Cost-to-Quality sorting: Discovers models dynamically and routes in order: Flash-Lite → Flash → Pro.
   - Resiliency: Automatically cascades to next model tier upon encountering HTTP 429 (quota) or HTTP 503 (high demand).
3. **OpenAI-Compatible Custom Endpoints:**
   - Works with LM Studio, LocalAI, Groq, DeepSeek, OpenRouter, and custom enterprise proxy gateways.

---

## 7. REST API Reference

### System & Health
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/ping` | Fast readiness probe polled by Electron before opening window |
| `GET` | `/api/status` | Application health, version, and project/task counts |

### PM Entities
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/projects` | List all active projects ordered by `updated_at DESC` |
| `POST` | `/api/projects` | Create a new project (`{ "name": str, "description": str }`) |
| `GET` | `/api/tasks` | List all tasks |
| `POST` | `/api/tasks` | Create a new task (`{ "project_id": int, "title": str, ... }`) |

### LLM & Provider Management
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/llm/status` | Returns active provider, model, Ollama status, and key state |
| `POST` | `/api/llm/config` | Saves provider preferences with key encryption |
| `GET` | `/api/llm/ollama/probe` | Live check of local Ollama server status and model list |
| `GET` | `/api/llm/ollama/models` | Returns installed Ollama model array |
| `POST` | `/api/llm/gemini/models` | Discovers available Gemini models for an API key |
| `POST` | `/api/llm/custom/probe` | Validates custom OpenAI-compatible server endpoint |

---

## 8. Coding Standards & Conventions

1. **Python Backend:**
   - Python 3.11+ syntax (`str | None`, `tuple[int, ...]`).
   - SQLite queries must use parameterized placeholders (`?`). Never string-format SQL queries.
   - Thread safety: Always acquire connections using `with db.get_db() as con:` and wrap write transactions in `with con:`.
   - Error handling: Never raise uncaught exceptions to the client. Always return clean JSON with `{ "error": str }` and appropriate HTTP status codes.
2. **Frontend & Templates:**
   - Vanilla modern JS (ES6+) without heavy frontend build steps for rapid developer iteration.
   - CSS Variables: Always use design tokens defined in `:root` (`--bg`, `--surface`, `--amber`, `--border`).
   - XSS Prevention: Use `escapeHtml()` when interpolating dynamic data into innerHTML.
3. **Electron Desktop Shell:**
   - Keep `contextIsolation: true` and `sandbox: true` on all BrowserWindows.
   - Never expose Node `fs` or `child_process` directly to the renderer. Use typed IPC via `preload.js`.

---

## 9. Testing & Smoke Verification Recipe

To run the complete verification suite from PowerShell:
```powershell
python -c "
import sys; sys.path.insert(0, '.');
import db; db.init_db();
from llm.gateway import detect_ollama, encrypt_secret, decrypt_secret;
assert decrypt_secret(encrypt_secret('test_key')) == 'test_key';
from main import create_app;
app = create_app();
client = app.test_client();
assert client.get('/api/ping').status_code == 200;
assert client.get('/api/llm/status').status_code == 200;
print('All core smoke tests passed!')
"
```

---

## 10. In-App Auto-Update & GitHub Releases Architecture

PM Tool features a fully automated, background-first update system powered by `electron-updater` and GitHub Releases.

```text
┌────────────────────────┐         ┌────────────────────────┐
│  GitHub Releases CDN   │         │ Electron Desktop Shell │
│  (Pranshul-Chopra/     │         │                        │
│   pm_tool)             │         │ ┌────────────────────┐ │
│                        │         │ │ autoUpdater Engine │ │
│ ├── latest.yml ────────┼─────────┼─┤ (electron-updater) │ │
│ ├── PMTool-Setup.exe   │ HTTP GET│ └─────────┬──────────┘ │
│ └── *.exe.blockmap ────┼─────────┼───────────┘            │
└────────────────────────┘         │                        │
                                   │ IPC 'updater-status'   │
                                   ▼                        │
                         ┌────────────────────┐             │
                         │ In-App Toast &     │             │
                         │ Sidebar Indicator  │             │
                         └────────────────────┘             │
                                   │                        │
                                   │ User clicks "Restart"  │
                                   ▼                        │
                         ┌────────────────────┐             │
                         │ stopFlask()        │             │
                         │ Tree-kill Python   │             │
                         └─────────┬──────────┘             │
                                   │ SQLite locks released  │
                                   ▼                        │
                         ┌────────────────────┐             │
                         │ quitAndInstall()   │             │
                         │ Silent NSIS Apply  │             │
                         └────────────────────┘             │
```

### 1. Update Lifecycle & Scheduling
- **Startup Probe:** Triggered 3 seconds post-initialization. This ensures the local Flask HTTP server and SQLite databases have finished initialization before network queries begin.
- **Periodic Background Polling:** Runs automatically every 4 hours (`4 * 60 * 60 * 1000` ms).
- **Manual User Trigger:** Users can check on demand by clicking the sidebar version footer (`#sb-version-strip`), which dispatches `updater-check` to the main process.

### 2. Preload Bridge API (`window.electronUpdater`)
Exposed securely via `electron/preload.js` with `contextIsolation: true`:
- `onStatus(callback)`: Registers listener for status events (`checking`, `available`, `downloading`, `downloaded`, `not-available`, `error`).
- `checkForUpdates()`: Dispatches manual update check to main process.
- `restartAndInstall()`: Triggers graceful shutdown and silent NSIS installer application.
- `getInfo()`: Queries current app version, packaging state, and portable mode status.

### 3. Graceful Shutdown & File Lock Prevention
On Windows systems, SQLite databases (`pmtool.db`, `ai_context.db`) and executable binaries in `%LOCALAPPDATA%` lock while child processes are active. When `updater-restart-install` fires:
1. `stopFlask()` executes `taskkill /F /T /PID <flaskPid>` (or sends SIGTERM to the process tree).
2. The Electron main process pauses until the Flask backend has terminated and all file handles are closed.
3. `autoUpdater.quitAndInstall(false, true)` is invoked, executing the NSIS installer without encountering `EBUSY` or locked-file errors.

### 4. Differential Blockmap Downloads
`electron-builder` generates `.blockmap` files alongside the installer. When updating:
- `electron-updater` reads `latest.yml` to identify the current release.
- If an existing version is installed, only the modified blocks are downloaded rather than the full installer binary, drastically reducing bandwidth and update time.

### 5. Portable Mode Fallback
If running in portable mode (`process.env.PORTABLE_EXECUTABLE_DIR` is detected):
- Automatic download is disabled (`autoUpdater.autoDownload = false`).
- When an update is detected, the UI displays a notification linking directly to the GitHub Release tag for manual archive extraction.

---

## 11. Deterministic Document Summarizer & 8K Token Budget

The Document Summarizer tool ([`tools/summarizer.py`](file:///C:/Users/Pranshul%20Chopra/OneDrive/Desktop/Project/pm_tool/tools/summarizer.py)) produces executive-grade Markdown briefs from uploaded or indexed company documents and deterministically persists them to a user-specified filesystem location.

### 1. Ingestion & Token Budgets
- **Source Document Threshold:** Up to **30,000 words** of extracted document text (from PDF, DOCX, TXT, MD, CSV, JSON). Section headers and document structure are preserved.
- **Expanded Output Budget:** Max output tokens set to **8,192** (upgraded from 2,048) in the LLM Gateway invocation. This guarantees complete, un-truncated coverage of multi-section enterprise specifications.
- **Deterministic Parameterization:** Operates at low temperature (`0.2`) and focused sampling (`top_p: 0.95`) to prevent hallucination and strictly mirror source data.

### 2. Standardized 6-Section Schema
Every generated summary adheres to the following structure:
1. `## 1. Executive Summary & Objective` — High-level business purpose, strategic thesis, and core problems.
2. `## 2. Core Architecture & System Specifications` — Technical components, data flows, and integration contracts.
3. `## 3. Key Decisions, Constraints & Trade-Offs` — Architectural choices, evaluated alternatives, and dependencies.
4. `## 4. Success Metrics & Quantitative Acceptance Criteria` — Measurable KPIs, SLAs, performance baselines, and quality gates.
5. `## 5. Identified Risks, Blockers & Open Questions` — Security concerns, failure modes, and unvalidated assumptions.
6. `## 6. Actionable Next Steps & Engineering Tasks` — Prioritized action items labeled `[P0]`, `[P1]`, `[P2]`.

### 3. File System Persistence & Integrity Frontmatter
Summaries are written directly to the target `.md` file with cryptographic integrity frontmatter:
```markdown
---
document_title: "Executive Document Brief: Architecture_Spec.pdf"
source_file: "C:/Projects/Docs/Architecture_Spec.pdf"
source_sha256: "a1b2c3d4..."
output_sha256: "e5f6g7h8..."
generated_at: "2026-10-03T18:30:00Z"
generator: "PM Tool Deterministic Summarizer v1.2"
word_count: 2450
---
```
Every execution is audited into `ai_context.db` under `tool_runs` with execution latency, status, input parameters, and file verification telemetry.

---

## 12. Modern UI/UX Architecture: Command Pills & Dual Scrollbars

### 1. Interactive Buttonish Slash Command Pill
The Copilot chat interface ([`templates/chat.html`](file:///C:/Users/Pranshul%20Chopra/OneDrive/Desktop/Project/pm_tool/templates/chat.html)) provides a button-like slash command container:
- Typing `/` triggers an auto-complete dropdown of deterministic tools (`/summarize`, `/draft-prd`, `/search-decisions`, `/create-task`).
- Selecting an action replaces the raw text slash command with an interactive **command pill** container styled with the application's amber accent theme (`--amber: #f59e0b`, `--amber-glow`).
- The pill container includes a clear/remove handle (`×`) that allows the user to dismiss the command and return to free-text mode with a single click or backspace.

### 2. Knowledge Base Dual-Scrollbar Architecture
The Document Explorer table ([`templates/documents.html`](file:///C:/Users/Pranshul%20Chopra/OneDrive/Desktop/Project/pm_tool/templates/documents.html)) features synchronized dual-axis scrolling:
- Wrapped in `.table-scroll-container` with `overflow-x: auto; overflow-y: auto; max-height: 480px;`.
- Table column headers utilize `position: sticky; top: 0; z-index: 10;` with solid background rendering to prevent see-through text collisions during vertical scroll.
- Handles deep file system paths (`C:\Very\Deep\Folder\Structure\...`) and wide metadata columns without viewport clipping or table blowout.
- Integrated dark-carbon scrollbar styling (`::-webkit-scrollbar`) with `#1f242d` tracks and `#333b47` hoverable thumbs matching the core application aesthetic.

---

## 13. Cascading Port Discovery & Process Lifecycle

To eliminate port collision issues caused by zombie processes, developer servers, or competing local services, PM Tool uses a cascading handshake mechanism across 16 ports (`5050` through `5065`):

1. **Port Probe:** The Electron supervisor sequentially tests ports in the range `5050..5065` via TCP socket connections to determine availability.
2. **Environment Injection:** The first free port is selected and passed to the Flask backend via `PM_TOOL_PORT`.
3. **Health Handshake:** Electron polls `http://127.0.0.1:<port>/api/ping` with exponential backoff (up to 15 seconds) until HTTP 200 is confirmed.
4. **Window Presentation:** The main Chromium window is revealed only after the backend health check succeeds, preventing white-screen errors or connection refused screens.
5. **Clean Teardown:** On window close or update installation, `taskkill` ensures the entire Python process tree is terminated, freeing the port immediately.

---

## 14. Sprint Kanban & Agile Execution Engine (v1.3.0)

Version 1.3.0 transforms PM Tool from a planning copilot into an active sprint execution environment via a dedicated **Sprint Kanban Board** ([`templates/board.html`](file:///C:/Users/Pranshul%20Chopra/OneDrive/Desktop/Project/pm_tool/templates/board.html)) and an automated PRD-to-Story Decomposer ([`tools/story_decomposer.py`](file:///C:/Users/Pranshul%20Chopra/OneDrive/Desktop/Project/pm_tool/tools/story_decomposer.py)).

### 1. Kanban Workflow Lanes & Drag-and-Drop Lifecycle
The board organizes tasks across four status lanes:
- `📋 Backlog` (`todo`): Groomed user stories awaiting sprint allocation.
- `⚡ In Progress` (`in_progress`): Active engineering or design deliverables.
- `⚠️ Blocked` (`blocked`): Items impeded by cross-team dependencies, reviews, or technical debt.
- `✅ Completed` (`done`): Finished deliverables meeting acceptance criteria.

Drag-and-drop utilizes the native HTML5 Drag and Drop API with optimistic UI updates:
1. `dragstart`: Attaches task ID and sets dragging visual styling.
2. `dragover` / `dragleave`: Highlights target column with amber glow border.
3. `drop`: Optimistically moves DOM card to target lane, dispatches `PATCH /api/tasks/:id` with `{ status: newStatus }`, recalculates sprint velocity metrics, and broadcasts updates to peer frames.

### 2. Database Schema Migration v5 (`db.py`)
To elevate simple task records to rich Agile user stories, Schema Migration v5 extends the `tasks` table with:
- `story_points INTEGER DEFAULT 0`: Fibonacci story points (1, 2, 3, 5, 8, 13).
- `acceptance_criteria TEXT DEFAULT ''`: Bulleted, verifiable Given/When/Then conditions.
- `assignee TEXT DEFAULT ''`: Engineering lead or stakeholder handle.

### 3. Automated PRD-to-Story Decomposer (`tools/story_decomposer.py`)
Triggered via `/breakdown` or the board header:
1. Gathers context from raw input or active project parameters (domain, goals, tech stack).
2. Prompts the LLM Gateway (8,192 token limit) to synthesize 4–8 discrete, testable Agile stories following standard persona formats (`As a [persona], I want [action] so that [outcome]`).
3. Formulates structured Given/When/Then acceptance criteria and Fibonacci point estimates.
4. Deterministically inserts stories into `pmtool.db` (`tasks`) and audits telemetry into `ai_context.db` (`tool_runs`).

---

## 15. Data Studio & Analytical Engine Architecture (`data_engine.py`)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      DATA STUDIO & KPI ENGINE                          │
├──────────────────────────┬─────────────────────────────────────────────┤
│  Data Source Connectors  │  • Excel (.xlsx/.xls via openpyxl)          │
│                          │  • CSV / TSV / JSON Array Data Files        │
│                          │  • SQLite Databases (.db, .sqlite)          │
├──────────────────────────┼─────────────────────────────────────────────┤
│  Materialization Store   │  • %LOCALAPPDATA%\PMTool\datasets\          │
│                          │  • analytics_store.db with type inference   │
│                          │  • Batch insert & sanitized identifiers     │
├──────────────────────────┼─────────────────────────────────────────────┤
│  Custom KPI & Charts     │  • Operations: SUM, AVG, COUNT, MIN, MAX    │
│                          │  • Formatting: Currency ($, €, ₹), %, #,### │
│                          │  • Target benchmarks: ahead/behind tracking │
│                          │  • Pure SVG Bar, Donut, and Table views     │
├──────────────────────────┼─────────────────────────────────────────────┤
│  Guarded AI Sandbox      │  • Schema-only context (zero PII exposure)  │
│  (Safe Controlled Access)│  • Multi-statement block (no semicolons)    │
│                          │  • SELECT/WITH whitelist only               │
│                          │  • Mutation blacklist (DROP, DELETE, etc.)  │
│                          │  • Mandatory LIMIT 100 ceiling              │
│                          │  • Read-only SQLite URI (file:... ?mode=ro) │
│                          │  • /data slash command in Copilot           │
└──────────────────────────┴─────────────────────────────────────────────┘
```

### 1. Ingestion & Materialization Flow
When a user uploads a dataset (`/api/data/sources/upload`):
1. **Validation & Isolation**: Suffix is checked against `ALLOWED_DATASET_EXTENSIONS`. Files are written into `%LOCALAPPDATA%\PMTool\datasets\`.
2. **Schema & Affinity Inference**: `_infer_type()` scans sample values to infer SQLite types (`INTEGER`, `REAL`, `DATETIME`, `TEXT`).
3. **Table Materialization**: Table is generated in `analytics_store.db` with prefix `ds_{timestamp}_{slug}` and populated via chunked `executemany` batches.
4. **Metadata Registration**: Recorded in `data_sources` table in `pmtool.db` with column schemas and sample values.

### 2. Guarded SQL Execution Sandbox
Queries submitted through the UI Sandbox or AI data inspection route to `execute_safe_query(data_source_id, sql_query, max_rows)`:
- **Defense in Depth**:
  1. Blocks semicolons to prohibit multi-statement injections.
  2. Ensures queries strictly begin with `SELECT` or `WITH`.
  3. Scans tokens against `DISALLOWED_SQL_KEYWORDS` (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `REPLACE`, `ATTACH`, `DETACH`, `TRUNCATE`, `PRAGMA`, `VACUUM`).
  4. Injects `LIMIT 100` ceiling if no smaller limit is specified.
  5. Opens SQLite connection with URI `mode=ro` preventing any disk writes at the driver layer.

### 3. KPI Computation & Dynamic Visualizations
`compute_widget_data(widget_id)` handles real-time metric evaluation:
- **KPI Cards**: Computes aggregated single values with unit formatting (`format_metric_value`) and benchmarks (`diff_pct`, `direction: "up" | "down"`, target display).
- **Bar & Donut Visualizations**: Groups data by categorical dimensions (`GROUP BY {group_by_col}`) with automated percentage share calculation and amber-carbon color palette rotation.
- **Table Views**: Safe 50-row paginated data previews.

### 4. Guarded AI Copilot Integration
- `get_analytics_context_for_llm(project_id)` generates a compact, high-leverage context block embedded into the Copilot's system prompt.
- Injects dataset names, row/column counts, table names, and column types alongside active KPI values and benchmark states.
- Raw sensitive records are never leaked to LLM context.
- Dedicated `/data` command in `chat.html` guides the assistant to deliver executive data synthesis and KPI health summaries.

---

## 16. Engineering Roadmap & Architecture Evolution (2026)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   PM TOOL STRATEGIC ROADMAP (2026)                     │
├──────────────┬───────────────────────────────┬─────────────────────────┤
│ Milestone    │ Theme & Deliverables          │ Status & Priority       │
├──────────────┼───────────────────────────────┼─────────────────────────┤
│ v2.0.0 (NEW) │ Desktop SPA Modernization     │ 🔥 IN PROGRESS          │
│              │ • Vite + React + TypeScript   │ (PRIORITY 1 - ACTIVE)   │
│              │ • Zero-Iframe App Shell       │                         │
│              │ • Unified AppBridge IPC       │                         │
│              │ • 60 FPS @dnd-kit Kanban      │                         │
│              │ • Shared Tailwind Tokens      │                         │
├──────────────┼───────────────────────────────┼─────────────────────────┤
│ v1.5.0       │ AI Doc Generator & Export     │ ✅ COMPLETED            │
│              │ • 1-Click PRD & Spec Modal    │ (Shipped)               │
│              │ • Word (.docx) & .md Exporter │                         │
│              │ • Direct RAG Ingestion        │                         │
│              │ • Zero-Crash Markdown Parser  │                         │
│              │ • Enterprise ErrorBoundary    │                         │
├──────────────┼───────────────────────────────┼─────────────────────────┤
│ v1.4.0       │ Data Studio & SQL Sandbox     │ ✅ COMPLETED            │
│              │ • Guarded SQLite Analytics    │ (Shipped)               │
│              │ • Dynamic KPI Cards & Charts  │                         │
│              │ • Excel/CSV Auto-Ingestion    │                         │
├──────────────┼───────────────────────────────┼─────────────────────────┤
│ v1.3.0       │ Agile Sprint Board Engine     │ ✅ COMPLETED            │
│              │ • Story Points & Criteria     │ (Shipped)               │
│              │ • PRD-to-Story Decomposer     │                         │
├──────────────┼───────────────────────────────┼─────────────────────────┤
│ v1.2.0       │ In-App Auto-Updater & Assets  │ ✅ COMPLETED            │
│              │ • Differential Delta Updates  │ (Shipped)               │
│              │ • Cascading Port Handshake    │                         │
├──────────────┼───────────────────────────────┼─────────────────────────┤
│ v2.1.0       │ Team Workspaces & Multi-Vault │ 📅 PLANNED              │
│              │ • Project Workspace Switching │ (Post v2.0 Transition)  │
│              │ • Exportable Workspaces       │                         │
└──────────────┴───────────────────────────────┴─────────────────────────┘
```

### Active Priority 1: v2.0.0 Desktop SPA Transition
The current primary development effort is focused on transitioning PM Tool's presentation layer from legacy multi-frame Vanilla JS (`shell.html` + `<iframe>`) into a high-performance, single-DOM Single Page Application (SPA):

1. **Phase 1: Foundation & Shell**
   - Initialize Vite + React 18/19 + TypeScript + Tailwind inside `electron/`.
   - Build unified dark carbon application frame (Titlebar, Collapsible Sidebar, Breadcrumbs).
   - Implement `AppBridge` (`bridge.ts`) to cleanly coordinate Electron IPC and local Flask REST calls.
2. **Phase 2: Kanban & Home Experience**
   - Re-architect Agile Sprint Board using `@dnd-kit/core` and `@dnd-kit/sortable` for 60 FPS hardware-accelerated drag-and-drop.
   - Introduce optimistic state mutations and non-blocking background synchronization.
3. **Phase 3: Knowledge Base & AI Copilot**
   - Streamline Document Manager with virtualized lists and sticky headers.
   - Streamline Copilot chat with streaming markdown token parsing, copy buttons, and interactive slash command pills.
4. **Phase 4: Data Studio & SQL Sandbox**
   - Port SQLite dataset explorer and SQL sandbox editor using `@tanstack/react-table`.
   - Connect dynamic SVG and Recharts KPI widgets with reactive state bindings.
5. **Phase 5: Packaging & CI/CD Pipeline Update**
   - Update `build.bat` and `.github/workflows/release.yml` to compile the Vite bundle into `electron/dist/renderer`.
   - Verify differential updates (`latest.yml`, `.blockmap`) and cross-process tree-kill functionality.
