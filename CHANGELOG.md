# Changelog

All notable changes to **PM Tool** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
