# Changelog

All notable changes to **PM Tool** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [2.2.5] - 2026-10-10

### 🌐 Hexagonal Architecture Nexus & 100% Local Parity
- **Decoupled Domain Ports (`ports/`)**:
  - `TicketTrackerPort` (`ports/ticket_tracker.py`): Formal interfaces for board schema discovery, task creation, transitions, and delta synchronization.
  - `DocumentRepositoryPort` (`ports/document_repo.py`): Formal interfaces for living document revisions, content trees, and cross-platform publishing.
  - `KnowledgeSourcePort` (`ports/knowledge_source.py`): Formal interfaces for remote document ingestion, diagnostic checks, and RAG index population.
- **Local Parity Adapters (`adapters/`)**:
  - `LocalTicketAdapter` (`adapters/local_ticket_adapter.py`): High-throughput local SQLite ticket tracker implementing 100% contract parity.
  - `LocalArtifactsAdapter` (`adapters/local_artifacts_adapter.py`): Living document repository adapter backed by segregated `artifacts.db`.
  - `LocalDiskRAGAdapter` (`adapters/local_disk_rag_adapter.py`): Local disk RAG and knowledge base adapter with BM25 indexing.

### 🔌 Connection Outposts: Jira Cloud, Notion & Google Docs
- **Atlassian Jira Cloud REST API v3 Outpost (`adapters/jira_ticket_adapter.py`)**:
  - Bidirectional integration with Jira Cloud projects via secure basic token authentication.
  - Dynamic workflow status retrieval and board column mapping.
  - Issue creation, field mapping, and status transition execution (`/rest/api/3/issue/{id}/transitions`).
- **Notion Workspace Outpost (`adapters/notion_document_adapter.py`)**:
  - Automated Markdown-to-Block transformer for living PRDs, RFCs, and meeting notes.
  - Support for headings (H1/H2/H3), bulleted lists, numbered lists, blockquotes, code blocks, and callout call-to-actions.
- **Google Docs Export Outpost (`adapters/gdocs_document_adapter.py`)**:
  - Direct 1-click cloud publishing from Artifacts Studio to Google Docs using batch document update transformations.

### 🛡️ Pre-Sync Safety Snapshot & Outpost-as-Dictator Model
- **Pre-Sync Safety Backup Engine (`tools/outposts/snapshot.py`)**:
  - Enforces the "Outpost as Dictator" model when linking external boards: before wiping local tickets to mirror remote Jira status, a full timestamped JSON backup snapshot is written to `%LOCALAPPDATA%\PMTool\backups\pre_sync_<provider>_<id>.json`.
  - 1-click atomic restore capability (`/api/projects/<id>/restore-snapshot`) reversing accidental data overwrites instantly.
  - Snapshot inspection API (`/api/projects/<id>/snapshots`).

### 🔒 SSRF Defensive Perimeter & Machine-Bound Credential Vault
- **SSRF Defensive Perimeter (`tools/outposts/security.py`)**:
  - Strict HTTPS validation and IP resolution defense blocking loopback (`127.0.0.1`, `::1`), private networks (RFC 1918 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata IP (`169.254.169.254`).
- **Machine-Bound PBKDF2 Credential Vault (`tools/outposts/security.py` & `db.py`)**:
  - Hardware/OS-salted PBKDF2 encryption (`encrypt_token` / `decrypt_token`) storing outpost secrets in the dedicated `outpost_configs` table.
  - Sensitive token masking for frontend display and log security (`mask_token`).

### 🖥️ React Desktop UI & Workflow Bridges
- **Outposts Integration Hub (`OutpostsSettingsPanel.tsx` in `SettingsView.tsx`)**:
  - Unified configuration studio for Jira, Notion, and Google Docs with live latency diagnostics.
- **Link Jira Board Modal & Dynamic Workflow Columns (`LinkJiraModal.tsx` & `BoardView.tsx`)**:
  - Dynamic column rendering based on remote Jira workflow statuses (`To Do`, `In Progress`, `Code Review`, `Done`).
  - Pre-sync snapshot warning and confirmation modal.
  - Jira board sync button with live sync status toast.
- **Task Card Jira Badges (`TaskCard.tsx`)**:
  - External issue key badge `[PROJ-102 ↗]` with deep link and labels.
- **Artifacts Studio Cloud Export (`ArtifactsStudio.tsx`)**:
  - "Publish to Notion" and "Export to Google Docs" integrated into the Artifacts Studio export menu.

## [2.2.0] - 2026-10-07

### 📝 In-Built Living Document Editor & Artifacts Studio (PranshulOS Style)
- **Artifacts Studio in Docs View (`ArtifactsStudio.tsx`)**:
  - Full-featured living document workstation supporting PRDs, Architecture RFCs, Sprint Briefs, Strategy Documents, and Meeting Notes.
  - Multi-mode reading and authoring: `Edit`, `Split` (side-by-side synchronized preview), and `Preview`.
  - Comprehensive Markdown formatting toolbar (Headings, Bold, Italic, Strikethrough, Code block, Quotes, Tables, Checklist tasks).
  - Built-in document template selector (Standard PRD, Architecture RFC, Sprint Brief, Blank).
  - Debounced auto-save engine with live status indicator ("All changes saved" / "Saving...") and live word counter.
- **Segregated Database Architecture (`artifacts_db.py` & `%LOCALAPPDATA%\PMTool\artifacts.db`)**:
  - Zero database bloat: all document bodies, markdown ASTs, and revision trees are stored in an independent SQLite engine.
  - Full text search powered by SQLite FTS5 index (`artifacts_fts`) for sub-millisecond document query performance.
  - Snapshot revision history tree (`artifact_versions` table) with 1-click historical version inspection and restoration.
- **Multi-Format Export Engine**:
  - 1-click client-side export to Microsoft Word (`.docx`), Markdown (`.md`), and styled HTML.
- **Bridges to Sprint Kanban & Knowledge Base**:
  - Direct 1-click bridge from living PRDs/RFCs into the Agile Decomposer modal (`DecomposerModal.tsx`), generating INVEST user stories directly from living document text.
  - Direct 1-click bridge to vectorize and ingest living documents into the RAG Knowledge Base.

### 🚀 Friction-Free First-Launch Onboarding Wizard
- **Interactive Multi-Step Setup Wizard (`OnboardingModal.tsx`)**:
  - Clean-launch detection via `pm_tool_onboarding_completed` localStorage signal.
  - **Step 1: Workspace & Initiative**: Project naming, domain selection, technology stack tagger, and optional seed backlog generator.
  - **Step 2: AI Gateway Probe**: Live Ollama local instance connectivity probe and model detection, alongside cloud Gemini and OpenAI gateway configuration.
  - **Step 3: Workstation Tour & Hotkey Spotlight**: Visual overview of core workstations and global keyboard shortcuts (`Ctrl+K` Command Palette, `Ctrl+B` Sidebar, `Ctrl+1..6` Quick View switching).
  - Re-accessible at any time via the Command Palette or Settings view ("Launch Onboarding Tour").

### 🤖 AI Copilot Chat-to-Artifact Promotion Bridge
- **1-Click "Save as Living Artifact" (`ChatView.tsx`)**:
  - Added quick promotion button to AI Copilot assistant markdown responses.
  - Automatically infers document title and document type, persisting the artifact directly into `artifacts.db` and displaying a toast notification.

### 🎛️ Configurable Token Headroom & Extended Generation Limits (React + Backend)
- **Token Headroom & Generation Limits Studio (`SettingsView.tsx`)**:
  - Interactive configuration panel directly integrated into the React Desktop Settings workstation.
  - Range sliders and numeric inputs for 4 independent execution planes:
    - 💬 **Standard AI Chat** (`chat_max_tokens`, default 8,192, up to 32,768 tokens)
    - 📄 **File & Document Generation** (`file_gen_max_tokens`, default 16,384, up to 65,536 tokens)
    - 📋 **Plan Mode & Epics** (`plan_max_tokens`, default 8,192, up to 32,768 tokens)
    - 🛠️ **Tool Calls & Summaries** (`tool_call_max_tokens`, default 16,384, up to 65,536 tokens)
  - 1-Click Headroom Presets: `⚡ Eco (4k/8k)`, `⚖️ Balanced (8k/16k)`, and `🚀 Max (16k/32k)`.
  - Machine-bound encrypted atomic saving via `AppBridge.api.saveLLMConfig` and `/api/llm/config`.
- **Intelligent Gateway Token Routing (`llm/gateway.py` & `routes.py`)**:
  - Dynamic request classification routing output tokens based on intent (`/prd`, `/breakdown`, `/document`, `/plan`, `/search`, `/summarize`).
  - Native Gemini API Safety Clamping: Automatically clamps generation requests to $\le 8,192$ output tokens for Google Gemini native API to prevent upstream HTTP 400 parameter errors, while unlocking extended budgets (up to 32K/64K) for OpenAI, Ollama, and LM Studio.
- **RAG Document Summarizer Upgrade (`tools/summarizer.py`)**:
  - Default summary budget expanded from 8,192 to 16,384 tokens with dynamic parameter pass-through.
- **Document Generator Headroom Awareness (`DocumentGeneratorModal.tsx` & `ChatView.tsx`)**:
  - Added active `Extended 16K Headroom` telemetry badge to the AI Document Generator header.
  - Updated `/summarize` command chip description to reflect 16K document synthesis.

## [2.1.1] - 2026-10-06

### 🐛 What's New Lifecycle & Presentation Hardening
- **Post-Update Restart Enforcement**:
  - Gated automatic "What's New" modal display exclusively to actual post-update application restarts via the `pm_tool_just_updated_restart` signal or genuine binary version upgrades.
  - Eliminated unwanted automatic modal popups on regular application launches while preserving full on-demand modal accessibility via the shell status bar version badge.

## [2.1.0] - 2026-10-06

### 📈 Industry-Standard Advanced Analytics Workbench
- **Multi-Stage Conversion Funnel & Drop-Off Analyzer (`tools/analytics_engine.py`)**:
  - Sequential pipeline tracking with step-to-step drop-off percentages, top-of-funnel relative conversions, and lost volume calculations.
  - Interactive visual funnel bar graph with dynamic color gradients and executive milestone counters.
- **Period-over-Period Cohort Retention Matrix**:
  - Automated month-over-month (MoM), week-over-week (WoW), and day-over-day (DoD) cohort construction.
  - Interactive heatmap retention matrix with color-coded retention intensity cells.
- **Statistical Distributions & Outlier Detection**:
  - Full parametric and non-parametric distribution profiling: Mean, Median (P50), P25, P75, P90, P99, Standard Deviation, and Interquartile Range (IQR).
  - Outlier detection leveraging Tukey's fences ($1.5 \times \text{IQR}$) and Z-scores ($|Z| > 3.0$) with live table inspection.
- **Pairwise Feature Correlation Matrix**:
  - Automated detection of numerical features and computation of Pearson correlation coefficients $r \in [-1.0, 1.0]$.
  - Heatmap grid with direction/strength classifications (Strong, Moderate, Weak).
- **Linear Trendline & Trajectory Forecasting**:
  - Time-series linear regression engine calculating slope rate ($\Delta / \text{period}$), intercept, and $R^2$ goodness-of-fit.
  - Projection of future milestones across customizable forecasting horizons.

### 🤖 High-Precision Agile Story Decomposer Overhaul
- **INVEST Principles & Atomic Story Slicing**:
  - Re-architected `tools/story_decomposer.py` prompt system enforcing Independent, Negotiable, Valuable, Estimable, Small, and Testable user stories.
- **Strict Multi-Scenario Gherkin Acceptance Criteria**:
  - Every synthesized story includes at least 3 distinct Given/When/Then scenarios: Happy Path, Validation & Negative Flows, and Boundary/Resilience edge cases.
- **Calibrated Fibonacci Point Estimation**:
  - Standardized Fibonacci estimates ($1, 2, 3, 5, 8, 13$) calibrated to architectural complexity, schema impact, and risk rather than raw token length.
- **Interactive Decomposer Studio Modal (`DecomposerModal.tsx`)**:
  - Stakeholder persona filters (End-User, Administrator, API Consumer, DevOps/Platform) and story count selector (3–10).
  - Live pre-commit review step allowing engineers to inspect, select, adjust story points, and batch-commit approved stories directly to the sprint Kanban board.

## [2.0.1] - 2026-10-06

### 📊 Interactive Data Studio & KPI Dashboard Studio
- **Full Metric & Chart CRUD Lifecycle**:
  - Implemented `AddWidgetModal.tsx` enabling creation of live analytical cards and visual distribution charts directly linked to any materialized dataset.
  - Interactive deletion controls on cards with instant UI state updates and backend synchronization.
- **Three Supported Widget Types**:
  - **KPI Cards (`kpi_card`)**: Real-time aggregation values, formatted metrics (`Number`, `Currency`, `Percentage`), target benchmark milestones, and ahead/behind percentage variance badges (`▲ +12.5% vs target`).
  - **Bar Distribution Charts (`bar_chart`)**: Dynamic categorical breakdowns with percentage distributions, colored progress bars, and total counts.
  - **Donut Share Breakdown (`donut_chart`)**: Visual multi-color dimensional share representation with segment percentages and totals.
- **Live Evaluator & Backend Integration**:
  - `compute_widget_data` evaluated live against `analytics_store.db` with safe PRAGMA column validations and AST SQL inspection.
  - Auto-provisions default KPI Dashboard on first navigation with prominent `+ Add KPI Metric` header action and interactive empty state call-to-action.

### 🛡️ SQLite Database Ingestion & Analytical Hardening
- **Native SQLite File Materialization**:
  - Extended dataset ingestion to seamlessly materialize native SQLite databases (`.db`, `.sqlite`, `.sqlite3`), alongside Excel (`.xlsx`, `.xls`), CSV, TSV, and JSON formats.
  - Implemented streaming file-copy fallbacks for multi-process environments, PRAGMA-driven non-locking table selection, and clean database detach handlers.
- **Polymorphic Row Rendering**:
  - Fixed table grid crashes (`e.map is not a function`) by implementing polymorphic row rendering in `StudioView.tsx` supporting both array-shaped and object-shaped SQL result sets.

### 🗑️ App-Themed Dataset Deletion Modal (`DeleteDatasetModal.tsx`)
- **Elimination of Native Browser Dialogs**:
  - Replaced browser-native `window.confirm` with `DeleteDatasetModal.tsx`, unifying dataset deletion with the application's dark-mode carbon aesthetic (`DeleteProjectModal`).
  - Provides table name and row count inspection, safety warnings for dropped tables, and smooth cancel/delete transitions.

### 🤖 Story Decomposer Gateway Resilience
- **LLM Gateway Signature Alignment**:
  - Resolved `TypeError: call_llm() got an unexpected keyword argument 'temperature'` in `tools/story_decomposer.py`, restoring 1-click PRD decomposition into sprint Kanban user stories.

### 🔄 Automated Silent Updates & Security Verification
- **Automated Lifecycle**:
  - Background silent update checks on launch and 60-minute recurring polling via `electron-updater`.
  - Comprehensive automated security, AST sandbox query validation, and pressure tests executed with zero vulnerabilities.

## [2.0.0] - 2026-10-06

### 🚀 Desktop SPA Modernization & Zero-Iframe Architecture
- **Single Page Application (SPA) Complete**:
  - Migrated entire desktop client to a single-DOM React 19 + TypeScript + Tailwind CSS architecture inside Electron.
  - Decommissioned legacy Jinja2 templates bundling from `flask.spec`, trimming distribution bundle overhead and guaranteeing zero iframe latency.
  - Native hardware-accelerated animations and view transitions between workstation modules.

### 🔍 Global Spotlight Command Palette (`CommandPalette.tsx`)
- **Spotlight Overlay (`Ctrl+K` / `Cmd+K`)**:
  - Raycast/Linear-style command palette for instant keyboard-first navigation across PM Tool.
  - Full fuzzy filtering across workstation views, live database projects, and productivity actions.
  - Keyboard-driven selection navigation with Arrow keys (`↑`, `↓`), `↵ Enter` execution, and `ESC` dismissal.
  - Clickable Command Palette trigger badge integrated into application `Titlebar`.

### ⌨️ Universal Keyboard Shortcuts Engine (`App.tsx`)
- **Global Application Keybindings**:
  - `Ctrl+K` / `Cmd+K`: Toggle Spotlight Command Palette.
  - `Ctrl+B` / `Cmd+B`: Toggle collapsible navigation sidebar.
  - `Ctrl+1` – `Ctrl+6`: Instant direct switching between Workspace (`1`), Sprint Board (`2`), Data Studio (`3`), Knowledge Base (`4`), AI Copilot (`5`), and Settings (`6`).
  - `ESC`: Clean modal and palette dismissal.

### 🔄 Fully Automated Background Updates
- **Automatic Silent Probing**:
  - Replaced manual "Check updates" button with automated background lifecycle.
  - Automatic silent probe on application boot and background interval polling every 60 minutes via `electron-updater`.
  - Non-intrusive live status indicator in `Sidebar.tsx` displaying `v2.0.0` with pulse/spin indicators.
  - Auto-downloaded updates seamlessly present the `UpdaterToast` notification with 1-click "Restart Now" execution.

### 🧹 Workspace Overview Streamlining (`HomeView.tsx`)
- **Redundant Launchpad Removal**:
  - Removed highlighted 3-card launchpad grid from `HomeView.tsx` to eliminate visual clutter.
  - Workspace view now flows smoothly from active initiatives directly into the recent user stories table.

## [1.5.0] - 2026-10-05

### 📝 AI Workspace PM Document Generator (`DocumentGeneratorModal.tsx`)
- **Interactive 1-Click Document Generator**:
  - Accessible directly from the AI Copilot workspace header toolbar via the **`+ Generate Document`** action.
  - Scaffolds 5 structured, executive-ready PM templates:
    1. **Product Requirement Document (PRD)**: Executive summary, target personas, functional requirements, technical architecture, and phased rollout guardrails.
    2. **Technical Architecture Spec**: System context, API contracts, relational schemas, latency budgets, and security audits.
    3. **Agile Sprint Story Breakdown**: Epics, prioritized user stories, Fibonacci point estimates, and Given/When/Then acceptance criteria.
    4. **Product Strategy & KPI Plan**: North Star KPI definitions, L1/L2 metric trees, counter metrics, and analytics event telemetry schemas.
    5. **Executive Brief & Evidence Synthesis**: TL;DR synthesis, strategic alignments, and risk matrices grounded in indexed documents.
  - Configurable contextual inputs: Document Title, Project Scope, Analytical Focus directive, Requirements Context, and Technical Stack constraints.

### 📄 Multi-Format Export Subsystem (`tools/document_generator.py` & `/api/export`)
- **Native Microsoft Word (`.docx`) Export**:
  - Backend endpoint `POST /api/export/docx` generating in-memory binary `.docx` files using `python-docx`.
  - Professional formatting: 1-inch margins, custom headers, styled metadata tables (Author, Date, Status, Project Scope), formatted bullet lists, and Consolas code blocks.
- **Clean Markdown (`.md`) Export**:
  - Backend endpoint `POST /api/export/markdown` generating downloadable `.md` files for direct wiki or git integration.
- **Action Toolbar on All Assistant Responses**:
  - Quick action toolbar under every assistant message:
    - 📋 **Copy Markdown**: 1-click clipboard copy.
    - 📄 **Word (DOCX)**: 1-click DOCX download with loading spinner feedback.
    - ⬇️ **Markdown**: Direct `.md` file download.
    - 📁 **Save to Docs**: 1-click direct ingestion into the project Knowledge Base (`POST /api/documents/upload`), immediately indexing into SQLite FTS5 for grounded RAG.
    - ⚡ **Decompose**: Instant transfer of generated PRD text into `DecomposerModal` for automated Fibonacci estimation and sprint Kanban ticket generation.

### 🛡️ Zero-Crash Resilience & Markdown Parser Hardening (`MarkdownContent.tsx`)
- **Tokenization Regular Expression Fix**:
  - Converted regex sub-patterns in `renderInline` to non-capturing groups and added strict defensive type-checking to prevent `undefined` match exceptions during markdown rendering.
- **Enterprise Error Boundaries (`ErrorBoundary.tsx`)**:
  - Integrated Dark Carbon styled Error Boundary in the application shell (`App.tsx`), guaranteeing that transient rendering errors never cause a blank screen or unmount the desktop shell.

### 📦 Build Pipeline & Packaging Enhancements (`flask.spec` & GitHub Workflows)
- **PyInstaller Hardening**:
  - Added `openpyxl` data files and submodules, `ai_db`, and analytics engines to `flask.spec` for standalone binary packaging.
- **Continuous Integration (`.github/workflows/ci.yml`)**:
  - Added automated build verification workflow for pushes and pull requests to ensure all frontend builds and backend imports succeed prior to release tagging.
- **Resilient Release Packaging (`.github/workflows/release.yml`)**:
  - Added fallback dependencies installation and target commitish tagging for reproducible releases.

## [1.4.0] - 2026-10-04

### 📊 Data Studio & Business Dashboard Engine (`data_engine.py` & `/dashboard`)
- **Multi-Format Tabular Ingestion & Materialization**:
  - Direct ingestion of Excel (`.xlsx`, `.xls` via `openpyxl`), CSV, TSV, JSON array documents, and SQLite databases.
  - Automatic column schema discovery and affinity type inference (`INTEGER`, `REAL`, `DATETIME`, `TEXT`).
  - Isolated table materialization in local `%LOCALAPPDATA%\PMTool\datasets\analytics_store.db` with auto-sanitized identifiers and batch insert acceleration.
- **Custom User-Defined KPI Metrics & Dynamic Visualizations**:
  - Configurable aggregation operations (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`) across any ingested numeric or categorical dimension.
  - Flexible number formatting: Currency (USD `$`, EUR `€`, INR `₹`), Percentages (`%`), and formatted thousands.
  - Target comparisons with automated delta percentages and visual trend badges (`+12.4% vs target`, `Ahead`/`Behind`).
  - Pure SVG responsive chart components matching PM Tool's dark carbon design:
    - Vertical Bar charts with hover tooltips and category labels.
    - Donut charts with multi-color palette breakdowns and percentage shares.
    - Paginated Tabular data views (first 50 rows).
- **Safe Read-Only SQL Sandbox**:
  - Interactive SQL console for analytical data exploration with syntax formatting, execution timer (`ms`), and table grid view.
  - Multi-layered defense-in-depth:
    1. Multi-statement injection block (disallowing `;`).
    2. Statement whitelist: only `SELECT` and `WITH` allowed.
    3. Mutation keyword blacklist: strictly blocking `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `REPLACE`, `ATTACH`, `DETACH`, `PRAGMA`, `TRUNCATE`, `VACUUM`.
    4. Mandatory ceiling: automatically enforces `LIMIT 100` caps.
    5. Native driver enforcement: opened via SQLite URI `file:... ?mode=ro` preventing any disk write mutations.

### 🛡️ Guarded AI Contextual Grounding & `/data` Slash Command
- **AI Integration Awareness with Zero Data Leakage**:
  - LLM Copilot system prompt dynamically receives structured schemas of connected business datasets (table names, row counts, column types, sample distributions) and live dashboard KPI values.
  - Raw records and PII are never dumped into prompt context, maintaining strict confidentiality.
- **Dedicated `/data` Slash Command (`templates/chat.html`)**:
  - Instant command palette pill (`/data`) triggering executive analytical synthesis, trend insights, and KPI health assessments.

### 🗄️ Database Schema Migration v6 (`db.py`)
- **Analytical Tables**:
  - `data_sources`: Ingested file paths, table names, schema JSON, row/column counts, and project associations.
  - `dashboards`: Custom analytical boards with title, description, and timestamps.
  - `dashboard_widgets`: Widget configuration cards, operations (`metric_op`, `value_column`, `group_by_column`), format types, target milestones, and display ordering.

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
