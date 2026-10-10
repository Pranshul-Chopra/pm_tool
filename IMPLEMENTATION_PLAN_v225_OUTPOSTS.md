# Technical Specification & Implementation Plan: PM Tool v2.2.5 ("Outpost & Nexus")

**Document Status:** Approved Architecture Specification (Hexagonal Ports & Outpost-Dictated Model)  
**Target Milestone:** v2.2.5  
**Target Platform:** Windows 10/11 Desktop (Local-First, Privacy-Preserving)  
**Architecture Pattern:** Hexagonal (Ports & Adapters) with Cloud-Dictated Remote Modes  
**Security Level:** Air-Gapped / Isolated Local Core with User-Governed Cloud Outposts  

---

## 1. Executive Summary & Architecture Philosophy

PM Tool v2.2.5 introduces the **Connection Outposts Architecture**, refactoring the application's core domain modules (Kanban tickets, Living Documents, and Knowledge Base RAG) into a decoupled **Hexagonal / Ports & Adapters** design.

### 1.1 The Two Fundamental Architectural Decisions

1. **Decoupled Ports & Replicated Local Adapters**:
   - The UI presentation layer (`BoardView`, `ArtifactsStudio`, `ChatView`) and deterministic AI engines (`StoryDecomposer`, `Summarizer`, `Copilot`) **never interact directly with external REST APIs**.
   - Instead, all interactions flow through three abstract domain ports: `TicketTrackerPort`, `DocumentRepositoryPort`, and `KnowledgeSourcePort`.
   - **Local Adapters Replicate All Port Contracts:** Even when no external integrations are enabled, PM Tool runs local adapters (`LocalTicketAdapter`, `LocalArtifactsAdapter`, `LocalDiskRAGAdapter`) that implement the **exact same interfaces, issue types, label structures, and transaction controls**. The system never relies on special-case `if (isJira)` branches.

2. **Cloud Outpost as the Authoritative Dictator When Linked**:
   - When a project or living document is connected to an external outpost (Atlassian Jira, Notion Workspace, or Google Docs), **that external service becomes the single authoritative dictator and source of truth**.
   - Local SQLite (`pmtool.db`, `artifacts.db`) operates as a **high-speed local cache, read replica, and offline transaction buffer**.
   - **Pre-Integration Handshake ("Wipe & Replace" with Safety Snapshot):** 
     - Before linking, the user is presented with an explicit confirmation dialog warning that existing local tickets will be cleared and replaced with the remote board's state.
     - A timestamped safety backup snapshot is automatically dumped to `%LOCALAPPDATA%\PMTool\backups\pre_sync_<provider>_<id>.json`.
     - The Kanban board dynamically adopts the remote service's workflow columns, ticket types, and label taxonomy.

---

## 2. Hexagonal Architecture Blueprint & Port Contracts

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        HEXAGONAL (PORTS & ADAPTERS) ARCHITECTURE                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         PRESENTATION & CLIENT PLANE                            │   │
│   │                                                                                │   │
│   │    [BoardView (Kanban)]      [ArtifactsStudio (Docs)]     [ChatView / Copilot] │   │
│   └───────────────────────┬───────────────────┬───────────────────┬────────────────┘   │
│                           │                   │                   │                    │
│                           ▼                   ▼                   ▼                    │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                           UNIFIED DOMAIN PORTS                                 │   │
│   │                                                                                │   │
│   │    ┌──────────────────────┐ ┌────────────────────────┐ ┌─────────────────────┐ │   │
│   │    │  TicketTrackerPort   │ │ DocumentRepositoryPort │ │ KnowledgeSourcePort │ │   │
│   │    └──────────┬───────────┘ └───────────┬────────────┘ └──────────┬──────────┘ │   │
│   └───────────────┼─────────────────────────┼─────────────────────────┼────────────┘   │
│                   │                         │                         │                │
│         ┌─────────┴─────────┐     ┌─────────┴─────────┐     ┌─────────┴─────────┐      │
│         │                   │     │                   │     │                   │      │
│         ▼                   ▼     ▼                   ▼     ▼                   ▼      │
│   ┌───────────┐       ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────┐ │
│   │   Local   │       │   Jira    │ │   Local   │ │  Notion   │ │   Local   │ │Cloud │ │
│   │  Ticket   │       │  Outpost  │ │ Artifacts │ │  Outpost  │ │   Disk    │ │ RAG  │ │
│   │  Adapter  │       │  Adapter  │ │  Adapter  │ │  Adapter  │ │    RAG    │ │Outpst│ │
│   │(pmtool.db)│       │ (Jira v3) │ │(artifacts)│ │(Notion v1)│ │(ai_context)│ │      │ │
│   └─────┬─────┘       └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └──┬───┘ │
│         │                   │             │             │             │          │     │
│         ▼                   ▼             ▼             ▼             ▼          ▼     │
│   ┌───────────┐       ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────┐ │
│   │ Local WAL │       │ Atlassian │ │ Local WAL │ │  Notion   │ │ Local BM25│ │Google│ │
│   │  SQLite   │       │Jira Cloud │ │  SQLite   │ │ Workspace │ │  Index    │ │ Drive│ │
│   └───────────┘       └───────────┘ └───────────┘ └───────────┘ └───────────┘ └──────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The Domain Port Definitions (Python & TypeScript)

#### 1. `TicketTrackerPort`
```python
class TicketTrackerPort(ABC):
    """Abstract port for all board and backlog operations."""
    
    @abstractmethod
    def get_board_schema(self, project_id: int) -> BoardSchema:
        """Returns the active board columns, workflow transitions, and allowed labels."""
        pass

    @abstractmethod
    def list_tasks(self, project_id: int, status: str = None) -> list[TaskEntity]:
        """Lists tasks matching criteria."""
        pass

    @abstractmethod
    def create_task(self, project_id: int, payload: CreateTaskPayload) -> TaskEntity:
        """Creates a new task/story."""
        pass

    @abstractmethod
    def update_task(self, task_id: int, patch: UpdateTaskPayload) -> TaskEntity:
        """Updates task title, description, points, or labels."""
        pass

    @abstractmethod
    def transition_task(self, task_id: int, target_status: str) -> TaskTransitionResult:
        """Executes a workflow state transition."""
        pass

    @abstractmethod
    def delete_task(self, task_id: int) -> bool:
        """Deletes or archives a task."""
        pass

    @abstractmethod
    def sync_external(self, project_id: int) -> SyncResult:
        """Refreshes state from authoritative backend."""
        pass
```

#### 2. `DocumentRepositoryPort`
```python
class DocumentRepositoryPort(ABC):
    """Abstract port for living documents, PRDs, and architecture specs."""
    
    @abstractmethod
    def list_documents(self, project_id: int = None) -> list[DocumentEntity]:
        pass

    @abstractmethod
    def get_document(self, doc_id: int) -> DocumentDetailEntity:
        pass

    @abstractmethod
    def save_document(self, doc_id: int, content: str, title: str, tags: list[str]) -> DocumentEntity:
        pass

    @abstractmethod
    def publish_revision(self, doc_id: int, summary: str) -> RevisionEntity:
        pass

    @abstractmethod
    def revert_revision(self, doc_id: int, version_num: int) -> DocumentDetailEntity:
        pass
```

#### 3. `KnowledgeSourcePort`
```python
class KnowledgeSourcePort(ABC):
    """Abstract port for indexing, chunking, and querying knowledge content."""
    
    @abstractmethod
    def pull_documents(self, source_id: int) -> list[RawDocumentPayload]:
        pass

    @abstractmethod
    def test_connection(self, config: dict) -> ConnectionDiagnostic:
        pass
```

---

## 3. The "Outpost as Dictator" State Management Model

### 3.1 Single Source of Truth
When an outpost is linked to a project, **Jira / Notion / Google Docs is the dictator**:

| Entity Plane | Unintegrated (Local Mode) | Integrated (Outpost-Dictated Mode) |
| :--- | :--- | :--- |
| **Board Columns** | PM Tool default lanes (`todo`, `in_progress`, `done`) | Remote Jira board stages (`Backlog`, `Dev`, `Review`, `QA`, `Done`) |
| **Authoritative Store** | Local `pmtool.db` | Atlassian Jira / Notion Cloud API |
| **Local SQLite Role** | Single Source of Truth | High-speed cache, read replica, and offline buffer |
| **Labels & Tags** | Local string array | 1:1 Jira `labels` array / Notion `multi-select` tags |
| **Issue Types** | Local defaults (`task`, `bug`) | Jira issue types (Story, Bug, Task, Epic) |
| **Story Points** | Local integer | Jira custom field (`customfield_10016` or board estimate) |

### 3.2 The Pre-Sync Handshake Warning & Safety Snapshot

When the user connects a project to Jira or Notion, PM Tool enforces an explicit confirmation modal before initiating synchronization:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Link Project to Atlassian Jira                                   [✕]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  You are connecting project "Acme Web" to Jira project "ACME-CORE".    │
│                                                                        │
│  NOTICE: Jira will become the single authoritative state manager:      │
│                                                                        │
│  • All existing local tickets in this project will be archived to a    │
│    local snapshot and cleared from the active board.                   │
│  • Board columns will be replaced with Jira's active workflow stages.  │
│  • The board will be populated with active sprint & backlog tickets    │
│    from Jira.                                                          │
│  • All future status moves, labels, and point assignments will sync   │
│    directly to Jira.                                                   │
│                                                                        │
│  [ Snapshot & Export Local Tasks (.json) ]                             │
│                                                                        │
│  [ Cancel ]                        [ Confirm & Wipe Local Board (Jira) ]
└────────────────────────────────────────────────────────────────────────┘
```

#### Snapshot Execution Guarantee:
1. `tools/outposts/snapshot.py` serializes all current project tasks into a JSON artifact:
   `%LOCALAPPDATA%\PMTool\backups\pre_jira_sync_<project_id>_<timestamp>.json`
2. Local tasks for that `project_id` are marked archived (`status = 'archived'`).
3. Outpost client calls Jira API to fetch the board configuration and active issues.
4. The local SQLite cache is hydrated with Jira's issue entities.
5. If the user unlinks Jira in the future, a "Restore Pre-Jira Snapshot" option is presented.

---

## 4. Separate Labels, Issue Types & Property Synchronization

### 4.1 Jira Label & Metadata Mirroring
- **Labels (Tags):** 
  - Jira provides a simple array of string tokens (`labels: ["frontend", "security", "p0"]`).
  - PM Tool displays these exact tokens as colored badges on the card and filter bar.
  - Adding a label in PM Tool dispatches an issue update: `{ "update": { "labels": [{ "add": "frontend" }] } }`.
  - Removing a label dispatches: `{ "update": { "labels": [{ "remove": "frontend" }] } }`.
- **Issue Types:**
  - Mirrored from Jira (`Story`, `Bug`, `Task`, `Epic`).
  - Rendered with standard icons: 🟢 Story, 🔴 Bug, 🔷 Task, 🟣 Epic.
- **Issue Keys & Deep Links:**
  - Rendered as clickable pills: `[PROJ-102 ↗]`.
  - Clicking opens the issue in Jira in the user's default browser via Electron's safe external handler.

### 4.2 Notion Properties & Tag Mirroring
- Living documents pushed to Notion mirror Notion database properties:
  - `Title`: Document title
  - `Document Type`: Notion Select property (`PRD`, `RFC`, `Sprint Brief`)
  - `Tags`: Notion Multi-Select property (e.g. `Architecture`, `v2.2.5`)
  - `Last Edited`: Notion Date property
- Pulling from Notion parses multi-select options directly into PM Tool's `tags` array.

### 4.3 Google Docs Metadata & Review Status
- Document title, export revision, and PM Tool doc type mapped to Google Drive file metadata and description properties.

### 4.4 Local Adapter Parity Guarantee
The `LocalTicketAdapter` and `LocalArtifactsAdapter` implement the **exact same property models**:
- Even in 100% offline local mode, `LocalTicketAdapter` supports:
  - `labels`: Array of string tags
  - `ticket_type`: `story` | `bug` | `task` | `epic`
  - `story_points`: Fibonacci integers
  - `assignee`: String user name
- This ensures that transitioning a project from Local Mode to Jira Mode (or vice-versa) requires zero UI adjustments!

---

## 5. Database Schema & Data Models

### 5.1 Outpost Credential Vault (`outpost_configs` in `pmtool.db`)
```sql
CREATE TABLE IF NOT EXISTS outpost_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL UNIQUE,       -- 'jira' | 'notion' | 'gdocs'
    base_url TEXT,                       -- e.g. 'https://myorg.atlassian.net'
    auth_token TEXT,                     -- PBKDF2-HMAC-SHA256 encrypted token
    user_email TEXT,                     -- Associated user email (Jira basic auth)
    project_key TEXT,                    -- Default project/workspace key
    database_id TEXT,                    -- Default Notion database ID
    is_active INTEGER DEFAULT 0,         -- 1 = enabled, 0 = disabled
    sync_policy TEXT DEFAULT 'manual',   -- 'manual' | 'on_create'
    last_tested_at TIMESTAMP,            -- Timestamp of last successful test
    last_error TEXT,                     -- Diagnostic error string if failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 Project-Level Outpost Linkage (`projects` table in `pmtool.db`)
```sql
-- Migration on projects table
ALTER TABLE projects ADD COLUMN outpost_provider TEXT DEFAULT NULL;       -- 'jira' | NULL
ALTER TABLE projects ADD COLUMN outpost_project_key TEXT DEFAULT NULL;    -- e.g. 'PROJ'
ALTER TABLE projects ADD COLUMN outpost_board_id INTEGER DEFAULT NULL;     -- Jira Board ID
ALTER TABLE projects ADD COLUMN is_outpost_dictated INTEGER DEFAULT 0;    -- 1 = Remote dictator, 0 = Local
ALTER TABLE projects ADD COLUMN last_synced_at TIMESTAMP DEFAULT NULL;
```

### 5.3 Task Entity External Linkage (`tasks` table in `pmtool.db`)
```sql
-- Migration on tasks table
ALTER TABLE tasks ADD COLUMN external_provider TEXT DEFAULT NULL;   -- 'jira'
ALTER TABLE tasks ADD COLUMN external_id TEXT DEFAULT NULL;         -- 'PROJ-102'
ALTER TABLE tasks ADD COLUMN external_url TEXT DEFAULT NULL;        -- 'https://myorg.atlassian.net/browse/PROJ-102'
ALTER TABLE tasks ADD COLUMN external_type TEXT DEFAULT 'Task';     -- 'Story', 'Bug', 'Task', 'Epic'
ALTER TABLE tasks ADD COLUMN external_labels TEXT DEFAULT '[]';     -- JSON array of strings
ALTER TABLE tasks ADD COLUMN sync_status TEXT DEFAULT 'synced';     -- 'synced' | 'pending' | 'conflict' | 'error'
ALTER TABLE tasks ADD COLUMN last_synced_at TIMESTAMP DEFAULT NULL;
```

### 5.4 Living Artifacts External Linkage (`artifacts` table in `artifacts.db`)
```sql
-- Migration on artifacts table
ALTER TABLE artifacts ADD COLUMN external_provider TEXT DEFAULT NULL; -- 'notion' | 'gdocs'
ALTER TABLE artifacts ADD COLUMN external_id TEXT DEFAULT NULL;       -- Notion Page UUID or GDoc File ID
ALTER TABLE artifacts ADD COLUMN external_url TEXT DEFAULT NULL;      -- Web URL
ALTER TABLE artifacts ADD COLUMN external_properties TEXT DEFAULT '{}';-- JSON properties
ALTER TABLE artifacts ADD COLUMN sync_status TEXT DEFAULT 'synced';
ALTER TABLE artifacts ADD COLUMN last_synced_at TIMESTAMP DEFAULT NULL;
```

### 5.5 Outpost Transaction Queue (`outpost_transactions` in `pmtool.db`)
```sql
CREATE TABLE IF NOT EXISTS outpost_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    entity_type TEXT NOT NULL,           -- 'task' | 'artifact'
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,                -- 'create' | 'update' | 'transition' | 'delete'
    payload TEXT NOT NULL,               -- JSON payload
    status TEXT DEFAULT 'pending',       -- 'pending' | 'processing' | 'failed'
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Defensive Security & URL Access Controls

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   OUTPOST DEFENSIVE SECURITY MODEL                     │
├────────────────────────────────────────────────────────────────────────┤
│ Perimeter 1: Electron Renderer & URL Click Isolation                   │
│   • sandbox: true, contextIsolation: true, nodeIntegration: false      │
│   • All outbound links intercepted by setWindowOpenHandler             │
│   • Strict protocol allowlist: https:// ONLY                           │
│   • Protocol ban: file://, javascript:, data:, cmd.exe, powershell     │
│   • Sanitization: reject CRLF (\r\n), null bytes (\0), control chars   │
├────────────────────────────────────────────────────────────────────────┤
│ Perimeter 2: Server-Side Request Forgery (SSRF) Defense                │
│   • Outpost base_url validator (tools/outposts/security.py)            │
│   • Enforces HTTPS exclusively in production                           │
│   • Blocks loopback (127.0.0.0/8, ::1, localhost)                      │
│   • Blocks cloud metadata endpoints (169.254.169.254, metadata.google) │
│   • Blocks RFC 1918 private subnets (10.0.0.0/8, 172.16/12, 192.168/16)│
│   • Enforces provider FQDN pattern matching (*.atlassian.net, notion.so│
├────────────────────────────────────────────────────────────────────────┤
│ Perimeter 3: Origin Validation & CSRF Protection                       │
│   • Flask @app.before_request blocks all cross-origin requests         │
│   • Sec-Fetch-Site: same-origin required on all /api/outposts routes   │
│   • Origin header must match active local Flask origin strictly        │
├────────────────────────────────────────────────────────────────────────┤
│ Perimeter 4: Secret Encryption at Rest & Token Masking                 │
│   • PBKDF2-HMAC-SHA256 authenticated machine-keyed encryption for      │
│     API tokens, OAuth bearer secrets, and service account keys in DB   │
│   • GET /api/outposts returns masked tokens (••••••••••••abcd)         │
│   • Raw tokens never leave localhost except inside encrypted TLS pipe  │
├────────────────────────────────────────────────────────────────────────┤
│ Perimeter 5: Data Minimization & Egress Audit Logging                  │
│   • Strict JSON field allowlist for outbound payloads                  │
│   • Local SQLite internal metadata, filesystem paths & DB IDs excluded │
│   • Outbound calls logged to ai_context.db (timestamp, status, latency)│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. State Management & Update Cadence

### 7.1 3-Tier State Management Lifecycle

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        3-TIER STATE MANAGEMENT                         │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 1: Optimistic UI State (React 19 Hooks & Signals)                 │
│   • Latency: <16ms (60fps synchronous render)                          │
│   • Scope: Card drag coordinates, modal open states, editor keystrokes │
│   • Behavior: Instant visual update before network or disk ACK         │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 2: Local Persistence & Cache (SQLite: pmtool.db, artifacts.db)    │
│   • Latency: <50ms (Synchronous SQLite transaction over WAL mode)      │
│   • Scope: Cached Jira issues, Notion pages, local tasks, outposts     │
│   • Behavior: Instant query retrieval and offline working buffer       │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 3: Remote Authoritative Outpost (Jira Cloud, Notion, GDocs)       │
│   • Latency: 300ms – 1,200ms (Asynchronous HTTPS REST calls)           │
│   • Scope: Remote transitions, page blocks, remote issue keys          │
│   • Behavior: Dictator of state; remote ACK commits, failure rollbacks │
└────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Update Cadence Matrix

| Event / Trigger | Trigger Mechanism | Frequency / Cadence | Latency / Debounce | Error / Offline Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Kanban Card Drag-and-Drop** | User moves card across lanes | On interaction | **0ms (Optimistic)**; SQLite writes in <30ms | Instant UI move; shows syncing badge |
| **Outbound Jira Transition** | Card moved to new column | Event-driven | **Debounced 1.5s** (prevents drag thrash) | Background call; if Jira rejects, card rolls back with toast |
| **1-Click "Push to Jira"** | User clicks button on task card | Explicit user action | **Instant on click** (~400ms REST roundtrip) | Loading spinner; shows issue key `PROJ-102` on success |
| **Living Doc Auto-Save** | Typing in `ArtifactsStudio` | Input stream | **600ms debounce** | Saves to `artifacts.db`; shows "Saved" status |
| **Publish to Notion / GDocs** | User clicks "Publish to Notion" | Explicit user action | **Instant on click** (~800ms API roundtrip) | Non-blocking modal; returns external URL |
| **Inbound Board Refresh** | Window focus or Tab change | Event-driven | **Throttled (Minimum 5 min interval)** | Pulls incremental delta since `last_synced_at` via JQL |
| **Manual Refresh** | User clicks `[↻ Sync Now]` | Explicit user action | **Instant on click** | Dispatches full sprint delta sync |

### 7.3 Conflict Resolution Decision Matrix
```text
┌────────────────────────────────────────────────────────┐
│                   CONFLICT DECISION MATRIX             │
├───────────────────┬────────────────────────────────────┤
│ Condition         │ Resolution Action                  │
├───────────────────┼────────────────────────────────────┤
│ Local move only   │ Push transition to Jira (Debounced)│
│ Remote move only  │ Move card on Kanban to match Jira  │
│ Concurrent Edits  │ Jira wins as Dictator of Record:   │
│ (Both modified    │ 1. Mark task with Amber Badge:     │
│  since last sync) │    [⚠️ Remote Changed in Jira]     │
│                   │ 2. Retain local draft in TaskModal │
│                   │ 3. Give user option: "Overwrite    │
│                   │    Jira" or "Accept Jira State"    │
└───────────────────┴────────────────────────────────────┘
```

---

## 8. Implementation Stages & Detailed Task Checklist

- [ ] **Phase 1: Ports & Local Adapters Refactoring + Database Schema + Vault**
  - [ ] Implement `ports/ticket_tracker.py`, `ports/document_repo.py`, `ports/knowledge_source.py`.
  - [ ] Refactor existing task/board logic into `adapters/local_ticket_adapter.py`.
  - [ ] Refactor existing artifacts logic into `adapters/local_artifacts_adapter.py`.
  - [ ] Add `outpost_configs`, `outpost_transactions` tables and project/task/artifact column migrations in `db.py` & `artifacts_db.py`.
  - [ ] Implement `tools/outposts/security.py` (SSRF URL validator & PBKDF2 cipher).
  - [ ] Implement `tools/outposts/snapshot.py` (Pre-sync local task/artifact JSON snapshot dumper).
  - [ ] Implement REST endpoints:
    - `GET /api/outposts` (list outposts with masked credentials)
    - `POST /api/outposts/<provider>` (save encrypted credentials)
    - `POST /api/outposts/<provider>/test` (diagnostic connection handshake)
    - `POST /api/projects/<id>/link-outpost` (handshake with snapshot & wipe)
    - `POST /api/projects/<id>/restore-snapshot` (restore pre-link snapshot)

- [ ] **Phase 2: Jira Outpost Engine & Dynamic Kanban Board**
  - [ ] Implement `adapters/jira_ticket_adapter.py` using Jira REST API v3.
  - [ ] Implement `POST /api/outposts/jira/push-task` (push task, record `external_id` and URL).
  - [ ] Implement `POST /api/outposts/jira/sync-task` (transition sync).
  - [ ] Add Pre-Sync Warning & Snapshot Modal (`LinkJiraModal.tsx`).
  - [ ] Dynamically render Kanban columns based on `active_board_schema` (Jira workflow stages vs default lanes).
  - [ ] Add Jira issue key pills, issue type icons (Story, Bug, Task, Epic), and 1:1 label chips to `TaskCard.tsx` and `TaskModal.tsx`.
  - [ ] Update `ActionCard.tsx` to support 1-click Jira ticket creation.

- [ ] **Phase 3: Notion & Google Docs Outpost Engines**
  - [ ] Implement `adapters/notion_document_adapter.py` using Notion API v1.
  - [ ] Implement `adapters/gdocs_document_adapter.py` using Google Drive / Docs API.
  - [ ] Implement `POST /api/outposts/notion/push-artifact` and `POST /api/outposts/gdocs/push-artifact`.
  - [ ] Add Pre-Sync Warning Modal for documents linking to Notion/GDocs.
  - [ ] Integrate "Publish to Notion" and "Export to Google Docs" buttons in `ArtifactsStudio.tsx`.
  - [ ] Implement inbound RAG ingestion from Notion database pages to local BM25 index.

- [ ] **Phase 4: Settings Integration Panel & End-to-End Verification**
  - [ ] Create `OutpostsSettingsPanel.tsx` in `electron/src/components/settings/`.
  - [ ] Embed into `SettingsView.tsx` with credential inputs, sync policies, and live test connection badges.
  - [ ] Compile React SPA bundle (`npm --prefix electron run build:ui`).
  - [ ] Create automated test suite `test_v225_outposts.py` verifying:
    - Port interchangeability (running identical tests against LocalAdapter and Mocked OutpostAdapter).
    - Pre-sync snapshot creation and task wipe.
    - SSRF prevention on malicious URLs.
    - Token masking and encryption roundtrips.
