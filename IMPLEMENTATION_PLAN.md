# Implementation Plan: PM Tool v2.1.0 ("Atlas")

**Release Focus:** Advanced Analytics, Calibrated Story Decomposer & Team Vault Scaffolding  
**Current Milestone:** v2.1.0  
**Target Platform:** Windows Desktop (Local-First, Privacy-Preserving)

---

## 1. Executive Summary & Goals

PM Tool v2.1.0 elevates core agile execution and data intelligence across two primary tracks:
1. **Story Decomposer & Quality Elevation:** Transform automated PRD-to-story decomposition with calibrated prompt architectures, atomic INVEST sizing, explicit positive/negative Gherkin scenarios, and an interactive pre-commit preview studio.
2. **Industry-Standard Dataset Analytics:** Introduce professional analytics tools into Data Studio, including multi-stage funnel conversion tracking, cohort retention heatmaps, statistical outlier detection (Z-scores/IQR), correlation matrices, and linear trend forecasting.

---

## 2. Architecture & Component Blueprint

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PM TOOL v2.1.0 ARCHITECTURE                     │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Core Version & What's New                                           │
│    • version.json (2.1.0, codename: "Atlas")                           │
│    • electron/package.json (2.1.0)                                     │
│    • electron/src/data/whatsNewData.ts (v2.1.0 curated release notes)  │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Agile Story Decomposer Suite (tools/story_decomposer.py)            │
│    • Calibrated INVEST Prompt Matrix & Slicing Heuristics              │
│    • Explicit Given/When/Then (Happy Path, Error, Edge Case)           │
│    • Fibonacci Point Calibration Engine (1, 2, 3, 5, 8, 13)            │
│    • DecomposerModal.tsx: Persona selector, count slider & preview     │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Advanced Analytical Engine (tools/analytics_engine.py & routes.py)  │
│    • Funnel Drop-Off Analytics: Step-by-step conversion & drop-off %   │
│    • Cohort Retention Matrix: Period-over-period retention matrix      │
│    • Statistical Distribution: P25/50/75/90/99, StdDev, IQR, Z-scores │
│    • Correlation Matrix: Pearson/Spearman pairwise coefficient grid    │
│    • Trendline Forecasting: Linear regression trajectory projection    │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Data Studio Analytics Workbench (StudioView.tsx)                    │
│    • 3rd Tab: "Advanced Analytics" workbench                           │
│    • Interactive visualizers for Funnels, Cohorts, and Distributions   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Task & Implementation Checklist

- [x] **Phase 1: Version Bumping & Release Scaffold**
  - [x] Synchronize `version.json` to `2.1.0` ("Atlas").
  - [x] Update `electron/package.json` to `2.1.0`.
  - [x] Scaffold `v2.1.0` entry in `electron/src/data/whatsNewData.ts` with new feature highlights.

- [x] **Phase 2: High-Precision Story Decomposer Overhaul**
  - [x] Upgrade `tools/story_decomposer.py`:
    - Enforced INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable).
    - Multi-scenario acceptance criteria: 3 distinct Given/When/Then scenarios (Happy Path, Validation/Negative, Boundary/Resilience).
    - Calibrated Fibonacci estimation model (1, 2, 3, 5, 8, 13) based on cognitive complexity, schema impact, and risk.
    - Added preview mode (`preview_only=True`) to return synthesized stories without direct DB write.
  - [x] Added `/api/tools/breakdown/commit` endpoint in `routes.py` for batch-committing approved stories.
  - [x] Upgraded `DecomposerModal.tsx`:
    - Added target persona selector (All, End-User, Administrator, API Consumer, DevOps/Platform).
    - Added story count selector (3 to 10 stories).
    - Added interactive pre-commit review card step with individual story selection, point adjustments, and expandable Gherkin criteria inspection before committing.

- [x] **Phase 3: Dataset Analytics Engine (Backend)**
  - [x] Created `tools/analytics_engine.py`:
    - `compute_funnel_analysis(source_id, stage_column, stages, entity_column)` with step-to-step drop-offs.
    - `compute_cohort_retention(source_id, user_column, date_column, period_type, max_periods)` with MoM/WoW/DoD retention heatmaps.
    - `compute_column_statistics(source_id, column_name)` with P25/50/75/90/99, mean, stddev, Tukey fences, and Z-score outlier detection.
    - `compute_correlation_matrix(source_id, columns)` with Pearson pairwise coefficient grid.
    - `compute_trend_forecast(source_id, date_column, metric_column, periods_ahead, aggregation)` with linear regression & $R^2$ fit.
  - [x] Registered REST endpoints in `routes.py`:
    - `POST /api/analytics/funnel`
    - `POST /api/analytics/retention`
    - `POST /api/analytics/statistics`
    - `POST /api/analytics/correlation`
    - `POST /api/analytics/forecast`

- [x] **Phase 4: Data Studio Advanced Analytics Workbench (Frontend)**
  - [x] Added "Advanced Analytics" tab to `StudioView.tsx`.
  - [x] Created specialized analytics workbench component `AdvancedAnalyticsWorkbench.tsx`:
    - Funnel visualization bar chart with drop-off percentages and conversion badges.
    - Retention cohort heatmap table with color intensity mapping.
    - Summary distribution stats card & outlier table inspector.
    - Correlation matrix heatmap grid with strength indicators.
    - Trendline forecasting card with future projected milestones.
  - [x] Connected bridge client methods in `bridge.ts`.

- [x] **Phase 5: Verification & Packaging**
  - [x] Verified analytical engine calculations with comprehensive automated test script (`test_v210.py`).
  - [x] Compiled Vite React SPA bundle (`npm --prefix electron run build:ui`) with 0 errors.
  - [x] Updated `CHANGELOG.md` and `DEV_HANDBOOK.md` with `v2.1.0` release notes.
