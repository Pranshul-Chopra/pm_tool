# PM Tool — Developer Handbook

**Document Status:** Current Architecture, Standards, and Engineering Guide  
**Current Version:** 1.0.0-mvp  
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
│  ├── Auto-spawns & manages local Flask HTTP server                     │
│  ├── Electron Notification Bridge (electron-notify IPC)                │
│  └── Graceful taskkill /t tree-kill on window exit                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP on http://127.0.0.1:5050
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FLASK APPLICATION                               │
│  (main.py + routes.py + notifier.py)                                   │
│                                                                        │
│  ├── Local-only binding (127.0.0.1:5050, configurable via PM_TOOL_PORT)│
│  ├── Security middleware (strict Origin & Sec-Fetch-Site validation)   │
│  ├── Security headers & CSP (offline font loading, nosniff, DENY frame)│
│  └── RESTful APIs for entities, workspace, and AI lifecycle            │
└──────────────┬──────────────────────────────────────────┬──────────────┘
               │                                          │
               ▼                                          ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│     STRUCTURED STORAGE       │          │      AI CONTEXT ENGINE       │
│  (%LOCALAPPDATA%\PMTool)     │          │  (%LOCALAPPDATA%\            │
│                              │          │   AIContextTool)             │
│  └── pmtool.db               │          │                              │
│      ├── projects            │          │  ├── ai_context.db           │
│      ├── tasks               │          │  │   ├── conversations       │
│      ├── decisions (v1.1)    │          │  │   ├── messages            │
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
├── .gitignore               # Git exclusion list
├── README.md                # Quick-start instructions
├── RELEASE_WORKFLOW.md      # Automated packaging and publishing guide
├── CHANGELOG.md             # Semantic versioning history
├── DEV_HANDBOOK.md          # Technical handbook and architecture specification
├── requirements.txt         # Python dependencies (Flask, requests, plyer, pypdf, python-docx)
├── version.json             # Source of truth for app version
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
│   └── document_generator.py # Formats markdown into professionally styled .docx documents
│
├── electron/                # Desktop shell
│   ├── package.json         # Electron scripts and builder configuration
│   ├── main.js              # Cascading port discovery, process supervisor and window manager
│   ├── preload.js           # Isolated IPC bridge
│   ├── icon.ico             # Windows application icon
│   └── icon.png             # Taskbar/notification icon
│
├── static/                  # Static assets served by Flask
│   ├── favicon.ico
│   ├── icon.png
│   └── fonts/               # Offline IBM Plex Sans & Mono woff2 fonts
│       └── ibmflex.css
│
└── templates/               # Jinja2 HTML templates
    ├── shell.html           # Main workstation layout with multi-tab iframe manager
    ├── home.html            # Product workspace, initiatives, roadmaps, backlog manager
    ├── chat.html            # AI Copilot studio with verified citations & DOCX export
    ├── documents.html       # Knowledge Base manager, FTS5 test bench, and chunk inspector
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
