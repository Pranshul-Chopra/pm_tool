# Implementation Plan: PM Tool v2.2.0 ("Scribe & Foundry")

**Release Focus:** First-Launch Onboarding Wizard, In-Built Living Document Editor (PranshulOS Style), Contextual AI Artifacts Promotion, and Segregated Database Architecture (`artifacts.db`)  
**Current Milestone:** v2.2.0  
**Target Platform:** Windows Desktop (Local-First, Privacy-Preserving)

---

## 1. Executive Summary & Goals

PM Tool v2.2.0 introduces two major strategic capabilities:
1. **User Onboarding Flow for First-Time App Launches:** A clean, friction-free setup wizard that greets first-time users, sets up their project initiative, configures their AI provider (with live Ollama probing and cloud API key options), and introduces the workstation's core capabilities and keyboard shortcuts (`Ctrl+K`, `Ctrl+B`, `Ctrl+1..6`).
2. **Contextual Artifacts Management (Docs - PranshulOS Style):** An in-built living document editor for PRDs, architecture RFCs, sprint briefs, and meeting notes with live split preview, multi-format export (`.docx`, `.md`, HTML), 1-click sprint board decomposition, and 1-click chat-to-artifact promotion.
3. **Segregated Database Architecture (`artifacts.db`):** Zero bloat on existing databases. Retains `pmtool.db` strictly for agile entities and `ai_context.db` strictly for conversations and RAG chunks, placing all document bodies, ASTs, and revision histories into a dedicated SQLite database (`%LOCALAPPDATA%\PMTool\artifacts.db`).

---

## 2. Architecture & Component Blueprint

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PM TOOL v2.2.0 ARCHITECTURE                     │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Segregated Database Architecture                                    │
│    • pmtool.db      → Agile entities, tasks, sprints, datasets, widgets│
│    • ai_context.db  → Conversations, chat messages, RAG vector chunks  │
│    • artifacts.db   → Living document bodies, versions, FTS5 index    │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Backend Artifacts Service (artifacts_db.py & routes.py)             │
│    • artifacts table: id, uuid, project_id, title, doc_type, content,  │
│      summary, tags, is_pinned, word_count, created_at, updated_at      │
│    • artifact_versions table: historical snapshot tree                 │
│    • artifacts_fts table: SQLite FTS5 instant text search              │
│    • REST API: /api/artifacts CRUD, /api/artifacts/from-chat, export   │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Artifacts Studio & Living Doc Editor (ArtifactsStudio.tsx)         │
│    • Gallery View: Doc cards, type chips (PRD, RFC, Brief), pin, delete│
│    • Editor View: Title autosave, Markdown toolbar, Edit/Split/Preview │
│    • Export: 1-click Word (.docx), Markdown (.md), HTML                │
│    • Sprint Bridge: 1-click "Decompose to Sprint" via DecomposerModal  │
│    • RAG Bridge: 1-click "Ingest to Knowledge Base"                    │
│    • Version History: Snapshots drawer and revision restore            │
├────────────────────────────────────────────────────────────────────────┤
│ 4. First-Launch Onboarding Wizard (OnboardingModal.tsx)                │
│    • State gate: localStorage.getItem('pm_tool_onboarding_completed') │
│    • Step 1: Workspace Initiative & Tech Stack                         │
│    • Step 2: AI Gateway (Ollama Live Probe, Gemini, Custom, Offline)  │
│    • Step 3: Workstation Feature Tour & Keyboard Shortcuts Spotlight   │
│    • Step 4: Instant Launch into Workspace                             │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Chat-to-Artifact Promotion Bridge (ChatView.tsx)                    │
│    • 1-click "Save as Living Artifact" on Copilot markdown outputs     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Task & Implementation Checklist

- [x] **Phase 1: Segregated Database Architecture (`artifacts_db.py`)**
  - [x] Implement `artifacts_db.py` with dedicated SQLite connection pool at `%LOCALAPPDATA%\PMTool\artifacts.db`.
  - [x] Implement `artifacts` table, `artifact_versions` table, and `artifacts_fts` virtual table.
  - [x] Implement CRUD methods: `create_artifact`, `get_artifact`, `update_artifact`, `delete_artifact`, `list_artifacts`, `toggle_pin`, `create_version`, `restore_version`.
  - [x] Add REST API endpoints in `routes.py`:
    - `GET /api/artifacts` (list with filters: project_id, doc_type, search, pinned)
    - `POST /api/artifacts` (create document)
    - `GET /api/artifacts/<id>` (get document)
    - `PUT /api/artifacts/<id>` (update document)
    - `DELETE /api/artifacts/<id>` (delete document)
    - `POST /api/artifacts/<id>/pin` (toggle pinned)
    - `GET /api/artifacts/<id>/versions` (list revisions)
    - `POST /api/artifacts/<id>/versions/restore` (restore revision)
    - `POST /api/artifacts/from-chat` (promote AI response to artifact)

- [x] **Phase 2: TypeScript Types & Bridge Integration**
  - [x] Add `Artifact`, `ArtifactVersion`, `ArtifactDocType`, `CreateArtifactPayload`, and `UpdateArtifactPayload` to `electron/src/types/index.ts`.
  - [x] Add `AppBridge.artifacts` client service methods in `electron/src/services/bridge.ts`.

- [x] **Phase 3: Living Document Editor & Artifacts Studio (PranshulOS Style)**
  - [x] Create `electron/src/components/docs/ArtifactsStudio.tsx`:
    - [x] Document grid/list mode with filtering by type (`PRD`, `RFC`, `Brief`, `Architecture`, `Meeting Notes`) and instant search.
    - [x] Template picker for new documents (Blank, PRD Template, Architecture RFC, Sprint Brief).
    - [x] Rich editor with auto-save debounce, IBM Plex styling, and formatting toolbar.
    - [x] Segmented mode switcher (`Edit` / `Split` live preview / `Preview`).
    - [x] Export actions (`.md`, `.docx`, HTML).
    - [x] 1-click "Decompose to Sprint" bridge triggering `DecomposerModal`.
    - [x] 1-click "Ingest to Knowledge Base" bridge.
    - [x] Snapshot revision history drawer.
  - [x] Integrate `ArtifactsStudio` into `electron/src/views/DocsView.tsx` with top-level tabs:
    - Tab 1: **Artifacts Studio (Living Docs)**
    - Tab 2: **Knowledge Base (RAG Index & Chunks)**

- [x] **Phase 4: AI Copilot Chat-to-Artifact Bridge**
  - [x] Add "Save as Artifact" action on Copilot markdown responses in `electron/src/views/ChatView.tsx`.
  - [x] Auto-detect document title and type, create artifact in `artifacts.db`, and provide feedback toast with quick link to editor.

- [x] **Phase 5: First-Time User Onboarding Wizard**
  - [x] Create `electron/src/components/onboarding/OnboardingModal.tsx`:
    - [x] Step 1: Workspace & Initiative Setup (Project Name, Domain, Tech Stack, Seed Backlog).
    - [x] Step 2: AI Gateway Setup (Local Ollama probe, Gemini, OpenAI / Custom, or Offline).
    - [x] Step 3: Workstation Feature Tour & Global Hotkeys Spotlight (`Ctrl+K`, `Ctrl+B`, `Ctrl+1..6`).
    - [x] Step 4: Launch into Workstation.
  - [x] Add first-launch state gate in `electron/src/App.tsx` (`localStorage.getItem('pm_tool_onboarding_completed')`).
  - [x] Add "Launch Onboarding Tour" action in `CommandPalette.tsx` and `SettingsView.tsx`.

- [x] **Phase 6: Automated Verification & Production Build**
  - [x] Write and run backend verification script (`test_v220_artifacts.py`).
  - [x] Compile Vite SPA bundle (`npm --prefix electron run build:ui`).
  - [x] Verify zero regressions across all views.
