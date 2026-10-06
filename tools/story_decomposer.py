# ── tools/story_decomposer.py ──────────────────────────────────────────────────
# PM Tool — Deterministic PRD to Agile Story Decomposer Tool (v2.1.0 Atlas)
# Transforms PRDs and initiatives into high-precision Agile user stories adhering
# to INVEST principles, explicit positive/negative Gherkin scenarios, and calibrated
# Fibonacci story point estimation. Supports live pre-commit preview.

import json
import re
import time
from typing import Dict, Any, Optional, List
import db
import ai_db
from llm import gateway as llm_gateway


def decompose_prd_to_stories(
    project_id: Optional[int] = None,
    prd_text: Optional[str] = None,
    conversation_id: Optional[str] = None,
    target_persona: Optional[str] = None,
    story_count: Optional[int] = 5,
    preview_only: bool = False,
) -> Dict[str, Any]:
    """
    Decompose product requirements or PRD specifications into granular, INVEST-grade user stories.

    Args:
        project_id: Target project ID to associate stories with.
        prd_text: Raw PRD text, feature specification, or bulleted requirements.
        conversation_id: Active conversation ID for audit logging.
        target_persona: Optional persona filter (e.g., 'End-User', 'Admin', 'API Consumer', 'All').
        story_count: Target number of discrete user stories (3-10, default 5).
        preview_only: If True, returns synthesized stories without persisting to pmtool.db.

    Returns:
        Dict containing success status, list of stories/tasks, and metadata.
    """
    start_time = time.time()
    proj = None
    if project_id:
        proj = db.get_project(project_id)

    # Validate input context
    doc_context = (prd_text or "").strip()
    if not doc_context and proj:
        # Build context from project attributes
        doc_context = (
            f"Project: {proj.get('name', 'Untitled')}\n"
            f"Domain: {proj.get('domain', 'Platform')}\n"
            f"Strategic Goals / OKRs: {proj.get('goals', 'N/A')}\n"
            f"Tech Stack: {proj.get('tech_stack', 'N/A')}\n"
            f"Overview: {proj.get('description', 'N/A')}\n"
        )

    if not doc_context:
        err_msg = "No PRD text or valid project context provided for decomposition."
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="story_decomposer",
            input_data={"project_id": project_id, "prd_length": 0},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    # Sanitize count
    count = max(3, min(int(story_count or 5), 10))
    persona_directive = (
        f"Focus decomposition specifically through the perspective of the '{target_persona}' persona where applicable."
        if target_persona and target_persona.lower() not in ("all", "any", "general")
        else "Span relevant stakeholder personas (e.g. End-User, Administrator, Platform/API Engineer)."
    )

    system_prompt = (
        "You are an elite Principal Technical Product Manager and Agile Enterprise Coach.\n"
        "Your task is to analyze the provided PRD / specification and decompose it into high-precision, "
        f"strictly calibrated Agile user stories (aim for approximately {count} stories).\n\n"
        "AGILE QUALITY STANDARDS (INVEST):\n"
        "1. Independent: Avoid cross-story execution deadlocks; slice stories vertically.\n"
        "2. Negotiable & Valuable: Clearly capture the user benefit and measurable value proposition.\n"
        "3. Estimable & Small: Scope each story so it can be completed within a single sprint iteration.\n"
        "4. Testable: Acceptance criteria must contain verifiable, automated-test-ready scenarios.\n\n"
        f"PERSONA GUIDANCE:\n{persona_directive}\n\n"
        "ACCEPTANCE CRITERIA MANDATE (Gherkin Format):\n"
        "Each story's 'acceptance_criteria' MUST contain at least THREE distinct scenarios:\n"
        "- Scenario 1 (Happy Path / Primary Flow): Given [precondition], When [action], Then [verifiable outcome]\n"
        "- Scenario 2 (Validation / Negative Flow): Given [invalid input or state], When [action], Then [clear error response without side effects]\n"
        "- Scenario 3 (Edge Case / Non-Functional): Given [boundary condition or system limit], When [action], Then [graceful fallback or retry]\n\n"
        "FIBONACCI STORY POINT CALIBRATION:\n"
        "- 1 pt: Trivial change, text update, minimal CSS/config tweak.\n"
        "- 2 pts: Standard UI form or simple CRUD API using existing patterns.\n"
        "- 3 pts: Moderate feature with validation logic, state management, or multi-field forms.\n"
        "- 5 pts: Complex component requiring schema change, external service, or async workflow.\n"
        "- 8 pts: Architectural module, heavy concurrency, encryption, or multi-system integration.\n\n"
        "OUTPUT REQUIREMENT:\n"
        "Respond ONLY with a valid JSON array of story objects matching the schema below. No markdown backticks outside JSON, no prose.\n\n"
        "JSON SCHEMA:\n"
        "[\n"
        "  {\n"
        "    \"title\": \"As a [persona], I want [capability] so that [business value]\",\n"
        "    \"persona\": \"End-User\",\n"
        "    \"description\": \"2-3 clear sentences describing technical scope, architecture, and expected behavior.\",\n"
        "    \"acceptance_criteria\": \"#### Scenario 1: Happy Path\\n- Given [precondition], When [action], Then [outcome]\\n\\n#### Scenario 2: Validation & Error Handling\\n- Given [invalid state], When [attempt], Then [error message]\\n\\n#### Scenario 3: Boundary & Resilience\\n- Given [edge case], When [triggered], Then [graceful handling]\",\n"
        "    \"priority\": \"high\",\n"
        "    \"story_points\": 3,\n"
        "    \"risk_level\": \"medium\",\n"
        "    \"tags\": [\"frontend\", \"api\"]\n"
        "  }\n"
        "]"
    )

    user_prompt = (
        f"PROJECT METADATA:\n"
        f"- Target Project: {proj.get('name', 'General') if proj else 'General'}\n"
        f"- Tech Stack: {proj.get('tech_stack', 'Modern Full-Stack') if proj else 'Modern Full-Stack'}\n"
        f"- Target Count: {count} stories\n\n"
        f"REQUIREMENTS SPECIFICATION TO DECOMPOSE:\n\n{doc_context}\n\n"
        f"Generate the {count} INVEST-grade user stories now."
    )

    llm_res = llm_gateway.call_llm(
        db_module=db,
        system_prompt=system_prompt,
        message=user_prompt,
        history=[],
        max_tokens=8192,
        temperature=0.2,
    )

    if "error" in llm_res:
        err_msg = f"AI decomposition failed: {llm_res.get('error')}"
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="story_decomposer",
            input_data={"project_id": project_id},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {
            "success": False,
            "error": err_msg,
            "setup_required": llm_res.get("setup_required", False),
        }

    raw_output = llm_res.get("response", "").strip()

    # Extract JSON array
    stories_data: List[Dict[str, Any]] = []
    try:
        match = re.search(r"\[\s*\{.*\}\s*\]", raw_output, re.DOTALL)
        if match:
            stories_data = json.loads(match.group(0))
        else:
            stories_data = json.loads(raw_output)
    except Exception as e:
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_output, flags=re.MULTILINE)
        cleaned = re.sub(r"```\s*$", "", cleaned, flags=re.MULTILINE).strip()
        try:
            stories_data = json.loads(cleaned)
        except Exception:
            err_msg = f"Failed to parse structured stories from model response: {str(e)}"
            duration_ms = int((time.time() - start_time) * 1000)
            ai_db.record_tool_run(
                tool_name="story_decomposer",
                input_data={"project_id": project_id},
                output_data={"error": err_msg, "raw_response": raw_output[:500]},
                duration_ms=duration_ms,
                status="error",
                conversation_id=conversation_id,
            )
            return {"success": False, "error": err_msg, "raw_response": raw_output}

    if not isinstance(stories_data, list) or not stories_data:
        err_msg = "Model did not return a valid non-empty list of stories."
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="story_decomposer",
            input_data={"project_id": project_id},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    # Normalize story items
    normalized_stories = []
    for item in stories_data:
        title = (item.get("title") or "").strip()
        if not title:
            continue
        description = (item.get("description") or "").strip()
        criteria = (item.get("acceptance_criteria") or "").strip()
        prio = (item.get("priority") or "medium").lower().strip()
        if prio not in ("critical", "high", "medium", "low"):
            prio = "medium"
        try:
            pts = int(item.get("story_points") or 3)
            if pts not in (1, 2, 3, 5, 8, 13):
                pts = 3
        except (ValueError, TypeError):
            pts = 3

        risk = (item.get("risk_level") or "medium").lower().strip()
        persona = (item.get("persona") or "End-User").strip()
        tags = item.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]

        normalized_stories.append({
            "title": title,
            "description": description,
            "acceptance_criteria": criteria,
            "priority": prio,
            "story_points": pts,
            "persona": persona,
            "risk_level": risk,
            "tags": tags,
        })

    duration_ms = int((time.time() - start_time) * 1000)

    # If preview_only is requested, return without database persistence
    if preview_only:
        ai_db.record_tool_run(
            tool_name="story_decomposer",
            input_data={"project_id": project_id, "mode": "preview", "count": len(normalized_stories)},
            output_data={"preview_count": len(normalized_stories)},
            duration_ms=duration_ms,
            status="success",
            conversation_id=conversation_id,
        )
        return {
            "success": True,
            "preview": True,
            "count": len(normalized_stories),
            "stories": normalized_stories,
            "project_id": project_id,
            "project_name": proj.get("name") if proj else None,
            "duration_ms": duration_ms,
        }

    # Deterministically write each story to database
    created_tasks = commit_decomposed_stories(project_id, normalized_stories)

    ai_db.record_tool_run(
        tool_name="story_decomposer",
        input_data={"project_id": project_id, "mode": "commit", "source_length": len(doc_context)},
        output_data={"created_count": len(created_tasks), "task_ids": [t["id"] for t in created_tasks]},
        duration_ms=duration_ms,
        status="success",
        conversation_id=conversation_id,
    )

    return {
        "success": True,
        "preview": False,
        "count": len(created_tasks),
        "created_tasks": created_tasks,
        "project_id": project_id,
        "project_name": proj.get("name") if proj else None,
        "duration_ms": duration_ms,
    }


def commit_decomposed_stories(project_id: Optional[int], stories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Commit a batch of approved decomposed stories to pmtool.db as Sprint tasks.
    """
    created_tasks = []
    for item in stories:
        title = (item.get("title") or "").strip()
        if not title:
            continue
        description = (item.get("description") or "").strip()
        criteria = (item.get("acceptance_criteria") or "").strip()
        prio = (item.get("priority") or "medium").lower().strip()
        if prio not in ("critical", "high", "medium", "low"):
            prio = "medium"
        try:
            pts = int(item.get("story_points") or 3)
        except (ValueError, TypeError):
            pts = 3

        task = db.create_task(
            project_id=project_id,
            title=title,
            description=description,
            status="todo",
            priority=prio,
            story_points=pts,
            acceptance_criteria=criteria,
        )
        created_tasks.append(task)
    return created_tasks
