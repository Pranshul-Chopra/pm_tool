export interface ReleaseHighlight {
  id: string;
  icon: 'kpi' | 'database' | 'shield' | 'zap' | 'bot' | 'file-text' | 'sparkles';
  title: string;
  tag: string;
  description: string;
}

export interface ReleaseSection {
  title: string;
  type: 'feature' | 'improvement' | 'fix';
  items: string[];
}

export interface WhatsNewRelease {
  version: string;
  codename: string;
  date: string;
  isLatest?: boolean;
  title: string;
  summary: string;
  highlights: ReleaseHighlight[];
  sections: ReleaseSection[];
}

export const WHATS_NEW_RELEASES: WhatsNewRelease[] = [
  {
    version: '2.2.0',
    codename: 'Scribe & Foundry',
    date: 'October 2026',
    isLatest: true,
    title: 'Artifacts Living Docs Studio & First-Launch Onboarding Wizard',
    summary:
      'PM Tool v2.2.0 introduces an in-built living document editor for PRDs and architecture RFCs (PranshulOS style), contextual AI artifacts promotion, isolated database architecture (artifacts.db), and a friction-free first-launch onboarding wizard.',
    highlights: [
      {
        id: 'artifacts-studio',
        icon: 'file-text',
        title: 'Living Document Editor & Artifacts Studio',
        tag: 'Documentation',
        description:
          'In-built living document editor with edit, split live preview, and preview modes for PRDs, architecture RFCs, and sprint briefs with auto-saving, template picker, and rich toolbar.',
      },
      {
        id: 'segregated-db',
        icon: 'database',
        title: 'Zero-Bloat Segregated Database Architecture',
        tag: 'Storage',
        description:
          'Dedicated artifacts.db SQLite engine strictly isolating document bodies, markdown ASTs, and revision snapshots, preserving high throughput in pmtool.db and ai_context.db.',
      },
      {
        id: 'onboarding-wizard',
        icon: 'sparkles',
        title: 'First-Launch Onboarding & Setup Wizard',
        tag: 'Experience',
        description:
          'Friction-free setup wizard guiding first-time users through project initialization, live Ollama/cloud AI gateway probing, and keyboard navigation shortcuts.',
      },
      {
        id: 'chat-to-artifact',
        icon: 'bot',
        title: '1-Click AI Chat-to-Artifact Promotion',
        tag: 'Copilot Bridge',
        description:
          'Promote transient AI chat answers and architectural proposals into permanent, version-controlled living documents with a single click.',
      },
      {
        id: 'sprint-decomposition',
        icon: 'zap',
        title: 'Direct Living Doc to Sprint Story Decomposition',
        tag: 'Agile Engine',
        description:
          'Bridge directly from living PRDs and RFCs into the Agile Decomposer modal to synthesize INVEST user stories and commit them straight to the Kanban board.',
      },
    ],
    sections: [
      {
        title: 'New Features',
        type: 'feature',
        items: [
          'Artifacts Studio in Docs View with split preview, Markdown toolbar, and template picker (PRD, RFC, Sprint Brief).',
          'Segregated SQLite database (artifacts.db) with instant FTS5 text search and revision snapshot trees.',
          'Multi-format document export engine (.docx Microsoft Word, .md Markdown, and styled HTML).',
          'First-time user onboarding wizard configuring initial project, AI gateway, and hotkeys.',
          '1-click "Save as Living Artifact" on Copilot markdown outputs in Chat View.',
          'Direct 1-click decomposition bridge connecting living PRDs and RFCs into Agile Sprint Backlog.',
        ],
      },
      {
        title: 'Improvements & Quality',
        type: 'improvement',
        items: [
          'Clean 3-database separation: pmtool.db for agile entities, ai_context.db for chats/RAG, artifacts.db for documents.',
          'Global keyboard navigation and shortcuts spotlight (Ctrl+K palette, Ctrl+B sidebar, Ctrl+1..6 views).',
          'Zero-crash debounce auto-saving with word count calculation and tag categorization.',
        ],
      },
    ],
  },
  {
    version: '2.1.0',
    codename: 'Atlas',
    date: 'October 2026',
    isLatest: false,
    title: 'Advanced Dataset Analytics & Calibrated Story Decomposer',
    summary:
      'PM Tool v2.1.0 introduces industry-standard analytical instruments for datasets (funnel drop-offs, cohort retention, correlation matrices, and statistical outlier detection) along with an overhauled high-precision agile story decomposer.',
    highlights: [
      {
        id: 'story-decomposer-pro',
        icon: 'bot',
        title: 'Calibrated Story Decomposer & Pre-Commit Preview',
        tag: 'Agile Engine',
        description:
          'High-precision decomposition based on INVEST principles with explicit positive and negative Gherkin scenarios, calibrated Fibonacci point sizing, persona filtering, and live pre-commit card approval.',
      },
      {
        id: 'funnel-analytics',
        icon: 'kpi',
        title: 'Multi-Stage Funnel Conversion & Drop-Off Analyzer',
        tag: 'Analytics',
        description:
          'Track sequential conversion steps, drop-off rates, stage-to-stage transition loss, and conversion velocity with visual drop-off bars.',
      },
      {
        id: 'cohort-retention',
        icon: 'zap',
        title: 'Cohort Retention Matrix Heatmaps',
        tag: 'Intelligence',
        description:
          'Evaluate month-over-month and week-over-week user or transaction retention rates across behavioral cohorts with dynamic color intensity mapping.',
      },
      {
        id: 'stats-outliers',
        icon: 'database',
        title: 'Statistical Distributions & Z-Score Outlier Detection',
        tag: 'Data Science',
        description:
          'Automated computation of percentiles (P25, P50/Median, P75, P90, P99), standard deviations, interquartile ranges, and Z-score outlier flagging on any numerical column.',
      },
      {
        id: 'correlation-matrix',
        icon: 'sparkles',
        title: 'Pairwise Feature Correlation Matrix',
        tag: 'Exploration',
        description:
          'Discover hidden relationships and dependencies across numeric dataset dimensions with interactive Pearson correlation coefficient grids.',
      },
    ],
    sections: [
      {
        title: 'New Features',
        type: 'feature',
        items: [
          'Advanced Analytics Workbench in Data Studio featuring Funnels, Retention Cohorts, and Correlation Grids.',
          'Z-Score and IQR statistical outlier detection for numerical columns.',
          'Story Decomposer Studio modal with target persona selection and pre-commit task inspection.',
          'Preview mode for PRD-to-story synthesis before committing tasks to SQLite sprint backlog.',
        ],
      },
      {
        title: 'Improvements & Quality',
        type: 'improvement',
        items: [
          'Calibrated Fibonacci point estimation formula based on architectural risk, scope, and dependencies.',
          'Enforced multi-scenario Given/When/Then acceptance criteria with edge-case and negative testing coverage.',
          'Sub-second analytical computation pipeline directly querying connected SQLite databases.',
        ],
      },
    ],
  },
  {
    version: '2.0.1',
    codename: 'Velocity',
    date: 'October 2026',
    isLatest: false,
    title: 'Interactive KPI Studio, SQLite Engine & AI Governance',
    summary:
      'PM Tool v2.0.1 introduces interactive KPI dashboards, universal SQLite (.db) ingestion, deep AI context permission policies, persistent 1-click sprint execution cards, and SQL query synthesis.',
    highlights: [
      {
        id: 'kpi-studio',
        icon: 'kpi',
        title: 'Interactive KPI Studio',
        tag: 'Analytics',
        description:
          'Live visual KPI metric cards with target progress rings, donut distribution breakdowns, and dynamic bar benchmarks calculated directly against your active workspace datasets.',
      },
      {
        id: 'sqlite-ingestion',
        icon: 'database',
        title: 'Universal SQLite (.db) Ingestion',
        tag: 'Storage',
        description:
          'Native ingestion and browser filtering for .db, .sqlite, and .sqlite3 databases across all modules, paired with a dark-mode dataset deletion confirmation modal.',
      },
      {
        id: 'ai-governance',
        icon: 'shield',
        title: 'AI Ticket Access Governance',
        tag: 'Governance',
        description:
          'Granular workspace settings allowing you to grant or restrict AI Copilot access to internal vs external sprint tickets, keeping proprietary tickets strictly confidential.',
      },
      {
        id: 'action-cards',
        icon: 'zap',
        title: 'Persistent 1-Click Action Cards & "Apply All"',
        tag: 'Workflow',
        description:
          'Proposed tasks and stories retain their completed/applied state across tab switching and conversation reloads. Batch approve multi-story proposals with the new ⚡ Apply All button.',
      },
      {
        id: 'query-assistant',
        icon: 'bot',
        title: 'Smart Database SQL Assistant (/query)',
        tag: 'AI Tools',
        description:
          'Use the new /query slash command chip in AI Copilot to automatically formulate schema-aware SQL queries grounded in your connected SQLite database tables.',
      },
      {
        id: 'markdown-engine',
        icon: 'file-text',
        title: 'Overhauled Markdown & Table Renderer',
        tag: 'Interface',
        description:
          'High-fidelity markdown rendering with pristine GFM tables, sanitized backticks, robust bold formatting, and interactive /plan and /query intent chips.',
      },
    ],
    sections: [
      {
        title: 'New Features',
        type: 'feature',
        items: [
          'Interactive KPI Studio with metric targets, visual status indicators, and donut breakdown charts.',
          'Universal database ingestion supporting .db, .sqlite, and .sqlite3 formats across all modules.',
          'AI context governance settings to allow or restrict Copilot access to internal/external tickets.',
          'Batch "⚡ Apply All Proposals" controller for rapid multi-story backlog grooming.',
          'Dedicated "/query" command chip for instant natural language SQL synthesis.',
          'Centred "What\'s New" modal with automatic one-time display on update and quick-access version button.',
        ],
      },
      {
        title: 'Improvements & Polishes',
        type: 'improvement',
        items: [
          'Action cards now persistently track completed execution state in SQLite across tab switches.',
          'Polished dark-mode dataset deletion dialog matching luxury workspace styling.',
          'Hardened markdown token regex to eliminate escaped characters and double-backtick table artifacts.',
          'Integrated /plan header blocks, tab inheritance, and contextual tool awareness in AI Copilot.',
        ],
      },
      {
        title: 'Bug Fixes',
        type: 'fix',
        items: [
          'Fixed file selector filter restricting ingestion solely to Excel files.',
          'Resolved action cards resetting to unapplied state when switching views.',
          'Corrected KPI dashboard empty state to dynamically calculate from active tables.',
        ],
      },
    ],
  },
  {
    version: '2.0.0',
    codename: 'Titan',
    date: 'October 2026',
    isLatest: false,
    title: 'Single-DOM SPA Transformation & Design System',
    summary:
      'Complete architectural transformation into a local-first single-page application desktop client with instant sub-second view transitions and AI Copilot.',
    highlights: [
      {
        id: 'spa-architecture',
        icon: 'sparkles',
        title: 'Modern Single-DOM React 19 SPA',
        tag: 'Core',
        description:
          'Zero-latency navigation powered by View Transitions API, removing multi-window Electron overhead and providing instant tab switching.',
      },
      {
        id: 'ai-copilot',
        icon: 'bot',
        title: 'Contextual AI Copilot & 3-Pipeline Engine',
        tag: 'AI Core',
        description:
          'High-performance RAG combining hybrid vector search, BM25 indexing, deterministic tool execution, and local reasoning.',
      },
      {
        id: 'auto-updater',
        icon: 'zap',
        title: 'Differential Background Auto-Updater',
        tag: 'Distribution',
        description:
          'Automated silent background updates via GitHub Releases with differential blockmap downloads and graceful process cleanup.',
      },
    ],
    sections: [
      {
        title: 'Key Capabilities',
        type: 'feature',
        items: [
          'Integrated Command Palette (Ctrl+K / Cmd+K) for global search and navigation.',
          'Sprint Kanban board with drag-and-drop state transitions.',
          'Data Studio with SQL sandbox and tabular dataset viewer.',
          'Knowledge Base with document ingestion and semantic chunking.',
        ],
      },
    ],
  },
];

export const LATEST_RELEASE = WHATS_NEW_RELEASES[0];

export const getReleaseByVersion = (version: string): WhatsNewRelease => {
  return WHATS_NEW_RELEASES.find((r) => r.version === version) || LATEST_RELEASE;
};
