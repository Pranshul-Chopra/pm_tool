# ── tools/story_decomposer.py ──────────────────────────────────────────────────
# PM Tool — Deterministic PRD to Agile Story Decomposer Tool
# Transforms PRDs and product initiatives into structured user stories with
# acceptance criteria, priority, and story points, saving directly to pmtool.db.

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
) -> Dict[str, Any]:
    """
    Decompose product requirements, PRD text, or project goals into granular user stories:
      1. Gathers context from project metadata and/or raw PRD input text.
      2. Invokes LLM Gateway to generate structured agile user stories with
         Given/When/Then acceptance criteria, priority, and Fibonacci story points.
      3. Deterministically persists generated stories into pmtool.db as tasks.
      4. Audits execution into ai_context.db (tool_runs).

    Args:
        project_id: Target project ID to associate stories with.
        prd_text: Raw PRD text, functional spec, or bulleted requirements.
        conversation_id: Active conversation ID for audit logging.

    Returns:
        Dict containing success status, list of created tasks, and count.
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
            input_data={"project_id": project_id, "prd_length": len(prd_text or "")},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    system_prompt = (
        "You are an expert Principal Product Manager and Technical Scrum Master.\n"
        "Your task is to analyze the provided PRD or project requirements and decompose them "
        "into 4 to 8 high-leverage, well-scoped Agile user stories ready for sprint execution.\n\n"
        "RULES:\n"
        "1. Every story title MUST follow: 'As a [persona], I want [action] so that [outcome]'.\n"
        "2. Include concrete 'acceptance_criteria' with Given/When/Then or verifiable checklist bullet points.\n"
        "3. Assign realistic 'priority': 'critical', 'high', 'medium', or 'low'.\n"
        "4. Assign Fibonacci 'story_points': 1, 2, 3, 5, or 8.\n"
        "5. Output ONLY a valid JSON array of story objects with no introductory or concluding text.\n\n"
        "JSON SCHEMA:\n"
        "[\n"
        "  {\n"
        "    \"title\": \"As a [persona], I want [capability] so that [value]\",\n"
        "    \"description\": \"2-3 sentences explaining technical scope, edge cases, and architectural dependencies.\",\n"
        "    \"acceptance_criteria\": \"- Given [precondition], When [action], Then [verifiable outcome]\\n- Given [error scenario], When [action], Then [fallback]\",\n"
        "    \"priority\": \"high\",\n"
        "    \"story_points\": 3\n"
        "  }\n"
        "]"
    )

    user_prompt = (
        f"REQUIREMENTS SPECIFICATION TO DECOMPOSE:\n\n{doc_context}\n\n"
        "Produce the JSON array of agile user stories now."
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
        # Match JSON block or array
        match = re.search(r"\[\s*\{.*\}\s*\]", raw_output, re.DOTALL)
        if match:
            stories_data = json.loads(match.group(0))
        else:
            stories_data = json.loads(raw_output)
    except Exception as e:
        # Fallback: attempt json code fence cleanup
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

    # Deterministically write each story to database
    created_tasks = []
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
            pts = int(item.get("story_points") or 0)
        except (ValueError, TypeError):
            pts = 0

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

    duration_ms = int((time.time() - start_time) * 1000)
    ai_db.record_tool_run(
        tool_name="story_decomposer",
        input_data={"project_id": project_id, "source_length": len(doc_context)},
        output_data={"created_count": len(created_tasks), "task_ids": [t["id"] for t in created_tasks]},
        duration_ms=duration_ms,
        status="success",
        conversation_id=conversation_id,
    )

    return {
        "success": True,
        "count": len(created_tasks),
        "created_tasks": created_tasks,
        "project_id": project_id,
        "project_name": proj.get("name") if proj else None,
        "duration_ms": duration_ms,
    }
