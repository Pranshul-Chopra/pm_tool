"""
pm_tool.workspace_context
~~~~~~~~~~~~~~~~~~~~~~~~~
Live workspace context extraction, filtering, and serialization engine.
Provides contextual visibility into active projects, sprint backlog tickets
(governed by organization AI ticket access policies), indexed documents,
and connected datasets & telemetry widgets.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
import db


def get_workspace_context(
    project_id: Optional[int] = None,
    user_query: Optional[str] = None
) -> Dict[str, Any]:
    """
    Extract and structure live workspace data for context injection.
    Applies organization AI ticket access and creation policies.
    """
    # 1. Fetch AI Ticket Policy
    policy = db.get_ai_ticket_policy()
    access_scope = policy.get("access_scope", "all")  # 'all', 'internal_only', 'external_only', 'none'
    creation_allowed = policy.get("creation_allowed", True)

    # 2. Projects
    all_projects = db.get_projects()
    active_projects: List[Dict[str, Any]] = []
    target_project = None
    for p in all_projects:
        proj_dict = dict(p) if hasattr(p, "keys") else p
        active_projects.append({
            "id": proj_dict.get("id"),
            "name": proj_dict.get("name"),
            "domain": proj_dict.get("domain", "General"),
            "health": proj_dict.get("health", "planning"),
            "priority": proj_dict.get("priority", "medium"),
            "progress_pct": proj_dict.get("progress_pct", 0),
            "owner": proj_dict.get("owner", ""),
            "target_date": proj_dict.get("target_date", ""),
            "tech_stack": proj_dict.get("tech_stack", ""),
            "description": proj_dict.get("description", ""),
        })
        if project_id and proj_dict.get("id") == project_id:
            target_project = active_projects[-1]

    # If no target project matched by ID but projects exist, default target
    if not target_project and active_projects:
        target_project = active_projects[0]

    # 3. Tasks / Tickets with Policy-based filtering
    open_tickets: List[Dict[str, Any]] = []
    completed_count = 0

    if access_scope == "none":
        # Policy completely restricts ticket access
        open_tickets = []
        ticket_access_status = "restricted"
    else:
        raw_tasks = db.get_tasks(project_id=project_id) if project_id else db.get_tasks()
        ticket_access_status = "allowed"

        for t in raw_tasks:
            t_dict = dict(t) if hasattr(t, "keys") else t
            t_status = (t_dict.get("status") or "todo").lower()
            t_type = (t_dict.get("ticket_type") or "internal").lower()

            if t_status == "done":
                completed_count += 1
                continue

            # Scope filtering
            if access_scope == "internal_only" and t_type == "external":
                continue
            if access_scope == "external_only" and t_type != "external":
                continue

            open_tickets.append({
                "id": t_dict.get("id"),
                "project_id": t_dict.get("project_id"),
                "title": t_dict.get("title", ""),
                "description": t_dict.get("description", ""),
                "status": t_status,
                "priority": (t_dict.get("priority") or "med").lower(),
                "ticket_type": t_type,
                "story_points": t_dict.get("story_points", 0),
                "acceptance_criteria": t_dict.get("acceptance_criteria", ""),
                "assignee": t_dict.get("assignee", ""),
                "due_date": t_dict.get("due_date", ""),
            })

    # 4. Knowledge Base Documents
    all_docs = db.list_documents(project_id=project_id) if project_id else db.list_documents()
    doc_summaries: List[Dict[str, Any]] = []
    matched_docs: List[Dict[str, Any]] = []

    q_lower = (user_query or "").strip().lower()
    for d in all_docs:
        d_dict = dict(d) if hasattr(d, "keys") else d
        fname = d_dict.get("filename", "Untitled")
        summary = {
            "id": d_dict.get("id"),
            "project_id": d_dict.get("project_id"),
            "filename": fname,
            "file_type": d_dict.get("file_type", ""),
            "word_count": d_dict.get("word_count", 0),
            "chunk_count": d_dict.get("chunk_count", 0),
            "created_at": d_dict.get("created_at", ""),
        }
        doc_summaries.append(summary)

        # Keyword matching against user query
        if q_lower and fname:
            fname_clean = fname.lower()
            words = [w for w in re.findall(r"\b\w+\b", fname_clean) if len(w) > 2]
            if fname_clean in q_lower or any(w in q_lower for w in words):
                matched_docs.append(summary)

    # 5. Connected Datasets & Telemetry Widgets
    datasets: List[Dict[str, Any]] = []
    widgets: List[Dict[str, Any]] = []
    try:
        import data_engine
        ds_list = data_engine.list_datasets(project_id=project_id) if project_id else data_engine.list_datasets()
        for ds in ds_list:
            ds_dict = dict(ds) if hasattr(ds, "keys") else ds
            datasets.append({
                "id": ds_dict.get("id"),
                "name": ds_dict.get("name"),
                "file_type": ds_dict.get("file_type"),
                "row_count": ds_dict.get("row_count", 0),
                "column_count": ds_dict.get("column_count", 0),
                "table_name": ds_dict.get("table_name", ""),
            })

        w_list = data_engine.list_dashboard_widgets(project_id=project_id) if project_id else data_engine.list_dashboard_widgets()
        for w in w_list:
            w_dict = dict(w) if hasattr(w, "keys") else w
            widgets.append({
                "id": w_dict.get("id"),
                "title": w_dict.get("title"),
                "widget_type": w_dict.get("widget_type"),
                "operation": w_dict.get("operation"),
                "target_column": w_dict.get("target_column"),
                "format_type": w_dict.get("format_type"),
            })
    except Exception:
        pass

    return {
        "policy": {
            "access_scope": access_scope,
            "creation_allowed": creation_allowed,
            "status": ticket_access_status,
        },
        "target_project": target_project,
        "projects": active_projects,
        "open_tickets": open_tickets,
        "completed_tickets_count": completed_count,
        "docs": doc_summaries,
        "matched_docs": matched_docs[:5],
        "datasets": datasets,
        "kpis": widgets,
    }


def format_workspace_context_for_prompt(
    ctx: Dict[str, Any],
    active_project_id: Optional[int] = None
) -> str:
    """
    Format extracted workspace context into dense, structured Markdown
    for system prompt injection and tool execution guidance.
    """
    lines: List[str] = [
        "=======================================================",
        "### 🌐 LIVE ENTERPRISE WORKSPACE CONTEXT",
    ]

    # Target Project
    tp = ctx.get("target_project")
    if tp:
        lines.append(f"**ACTIVE PROJECT**: **{tp.get('name', '').upper()}** (ID: {tp.get('id')})")
        lines.append(f"- Domain: {tp.get('domain')} | Health: {tp.get('health', '').upper()} | Priority: {tp.get('priority', '').upper()}")
        if tp.get("owner"):
            lines.append(f"- Lead PM / Owner: {tp['owner']}")
        if tp.get("target_date"):
            lines.append(f"- Target Launch Timeline: {tp['target_date']}")
        if tp.get("tech_stack"):
            lines.append(f"- Architecture / Tech Stack: {tp['tech_stack']}")
        if tp.get("description"):
            lines.append(f"- Core Overview: {tp['description']}")

    # Other Projects
    all_projs = ctx.get("projects") or []
    if len(all_projs) > 1:
        other_projs = [p for p in all_projs if not tp or p.get("id") != tp.get("id")]
        lines.append(f"\n**All Active Projects ({len(all_projs)} registered)**:")
        for op in other_projs[:5]:
            lines.append(f"- Project #{op['id']}: **{op['name']}** [{op.get('health', 'active')}] ({op.get('progress_pct', 0)}% progress)")

    # Tickets / Backlog with Policy Awareness
    policy = ctx.get("policy", {})
    scope = policy.get("access_scope", "all")
    creation_allowed = policy.get("creation_allowed", True)

    lines.append(f"\n### 🎫 SPRINT TICKETS & BACKLOG (Scope: `{scope.upper()}`):")
    if scope == "none":
        lines.append("⚠️ **ORGANIZATION PRIVACY POLICY**: AI ticket access is strictly RESTRICTED by policy.")
        lines.append("You do not have visibility into sprint backlog tickets. Do not attempt to guess or cite specific tickets.")
    else:
        open_tickets = ctx.get("open_tickets") or []
        if open_tickets:
            lines.append(f"Currently {len(open_tickets)} open sprint ticket(s) visible:")
            for tk in open_tickets[:15]:
                prio = tk.get("priority", "med").upper()
                ttype = tk.get("ticket_type", "internal").upper()
                status = tk.get("status", "todo").upper()
                pts = f" [{tk['story_points']} pts]" if tk.get("story_points") else ""
                assignee = f" (Assignee: {tk['assignee']})" if tk.get("assignee") else ""
                due = f" (Due: {tk['due_date']})" if tk.get("due_date") else ""
                lines.append(f"- [#{tk.get('id')}] [{prio}] [{ttype}] [{status}]{pts} **{tk.get('title')}**{assignee}{due}")
        else:
            lines.append("- No open tickets found in the current scope.")

    # Knowledge Base Documents
    docs = ctx.get("docs") or []
    if docs:
        lines.append(f"\n### 📚 INDEXED KNOWLEDGE BASE ({len(docs)} documents):")
        for d in docs[:8]:
            lines.append(f"- 📄 **{d['filename']}** ({d['file_type'].upper()}, ~{d['word_count']} words, ID: {d['id']})")

    # Datasets & KPIs
    datasets = ctx.get("datasets") or []
    kpis = ctx.get("kpis") or []
    if datasets or kpis:
        lines.append("\n### 📊 DATA STUDIO & TELEMETRY:")
        if datasets:
            lines.append(f"- Connected Datasets ({len(datasets)}): " + ", ".join(f"`{ds['name']}` ({ds['row_count']} rows)" for ds in datasets[:5]))
        if kpis:
            lines.append(f"- Active KPI Widgets ({len(kpis)}): " + ", ".join(f"**{w['title']}** [{w['widget_type']}]" for w in kpis[:4]))

    # Ticket Action Protocol Instructions
    lines.append("\n### ⚡ ACTION EXECUTION PROTOCOL (Ticket Creation & Backlog Management):")
    if creation_allowed:
        lines.append(
            "You ARE AUTHORIZED to propose and create sprint tickets directly on the Sprint Board.\n"
            "Whenever the user asks you to:\n"
            "- 'Make a ticket', 'add a task', 'create a story', 'create ticket for...'\n"
            "- Break down or decompose requirements into Jira / Agile backlog items\n"
            "- Execute `/plan` (Sprint planning mode)\n\n"
            "You MUST output structured action proposal blocks in the following fenced format:\n"
            "```action:create_ticket\n"
            "{\n"
            '  "title": "Clear, concise user story or ticket title",\n'
            '  "description": "Thorough description of what must be built or fixed...",\n'
            '  "priority": "urgent" | "high" | "med" | "low",\n'
            '  "status": "todo",\n'
            '  "story_points": 3,\n'
            '  "ticket_type": "internal" | "external",\n'
            f'  "project_id": {tp.get("id", 1) if tp else 1},\n'
            '  "assignee": "Frontend / Backend / QA",\n'
            '  "acceptance_criteria": "Given [context] / When [action] / Then [expected outcome]"\n'
            "}\n"
            "```\n"
            "The chat UI will automatically parse these action blocks into interactive 1-Click Action Cards with an '⚡ Apply to Sprint Board' button.\n"
            "You may output multiple action blocks when breaking down several stories or sprint tasks."
        )
    else:
        lines.append(
            "🚫 TICKET CREATION PRIVILEGE IS DISABLED by organization policy in Settings.\n"
            "If the user asks you to create tickets or tasks, inform them politely: "
            "'Ticket creation is currently disabled under AI Policies. You can enable ticket creation anytime in Settings > AI Agent Ticket Access & Execution Policy.'"
        )

    lines.append("=======================================================")
    return "\n".join(lines)
