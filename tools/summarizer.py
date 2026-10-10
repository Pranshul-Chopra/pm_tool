# ── tools/summarizer.py ────────────────────────────────────────────────────────
# PM Tool — Deterministic Document Summarizer Tool
# Synthesizes comprehensive, structured Markdown briefs from company documents
# and deterministically persists output to user-specified filesystem paths.

import os
import time
import hashlib
from pathlib import Path
from typing import Dict, Any, Optional
import db
import ai_db
from llm import gateway as llm_gateway
from rag.parsers import parse_file


ALLOWED_DOCUMENT_EXTENSIONS = {".txt", ".text", ".md", ".markdown", ".pdf", ".docx", ".csv", ".json"}

def _is_restricted_path(p: Path) -> bool:
    s = str(p.resolve()).lower()
    for blocked in (r"c:\windows", r"c:\program files", r"c:\program files (x86)", "/etc", "/usr", "/bin", "/sbin"):
        if s.startswith(blocked):
            return True
    return False


def summarize_document(
    file_path: str,
    output_path: str,
    focus: Optional[str] = None,
    project_id: Optional[int] = None,
    conversation_id: Optional[str] = None,
    max_tokens: int = 16384,
) -> Dict[str, Any]:
    """
    Deterministic Document Summarization Tool:
      1. Validates and parses the source document.
      2. Generates an executive-grade structured PM Markdown summary via LLM Gateway.
      3. Deterministically writes the resulting Markdown file to the exact target path.
      4. Verifies byte count and SHA256 integrity.
      5. Audits execution into ai_context.db (tool_runs).

    Args:
        file_path: Absolute or relative path to source document (txt, md, pdf, docx, csv, json).
        output_path: Target filesystem path where the .md file must be saved.
        focus: Optional focus directive (e.g. 'executive', 'technical', 'roadmap', 'risks').
        project_id: Optional project context ID.
        conversation_id: Optional active conversation thread ID for telemetry.

    Returns:
        Dict containing success status, output_path, sha256, byte count, summary text, and audit run_id.
    """
    start_time = time.time()
    src = Path(file_path).resolve()

    # 1. Validate source file path and extension
    if src.suffix.lower() not in ALLOWED_DOCUMENT_EXTENSIONS:
        err_msg = f"Disallowed or unsupported source file type '{src.suffix}'. Only standard documentation formats (.md, .txt, .pdf, .docx, .csv, .json) are permitted."
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="document_summarizer",
            input_data={"file_path": file_path, "output_path": output_path, "focus": focus},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    if _is_restricted_path(src):
        err_msg = "Access to operating system system directories is restricted."
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="document_summarizer",
            input_data={"file_path": file_path, "output_path": output_path, "focus": focus},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    if not src.exists() or not src.is_file():
        err_msg = f"Source document not found or inaccessible: {file_path}"
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="document_summarizer",
            input_data={"file_path": file_path, "output_path": output_path, "focus": focus},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    # 2. Parse document contents
    try:
        sections = parse_file(src)
    except Exception as e:
        err_msg = f"Failed to parse source document: {str(e)}"
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="document_summarizer",
            input_data={"file_path": str(src), "output_path": output_path},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    if not sections:
        err_msg = "Document parsed into empty content. No readable text found."
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="document_summarizer",
            input_data={"file_path": str(src), "output_path": output_path},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    # Combine extracted sections
    extracted_text_blocks = []
    total_words = 0
    for s in sections:
        title = s.get("section_title", "").strip()
        body = s.get("content", "").strip()
        if body:
            block = f"### {title}\n{body}" if title else body
            extracted_text_blocks.append(block)
            total_words += len(body.split())
            if total_words > 30000:
                extracted_text_blocks.append("\n...(content truncated for context budget)...")
                break

    combined_doc_text = "\n\n".join(extracted_text_blocks)

    # 3. Validate target output destination
    clean_out = str(output_path).strip()
    if not clean_out:
        clean_out = str(src.parent / f"{src.stem}_summary.md")
    elif not clean_out.lower().endswith(".md"):
        clean_out += ".md"

    out_file = Path(clean_out).resolve()
    if _is_restricted_path(out_file):
        err_msg = "Writing to restricted operating system directories is prohibited."
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="document_summarizer",
            input_data={"file_path": str(src), "output_path": str(out_file)},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    try:
        out_file.parent.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        err_msg = f"Failed to prepare destination directory '{out_file.parent}': {str(e)}"
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="document_summarizer",
            input_data={"file_path": str(src), "output_path": str(out_file)},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    # 4. Construct professional summarizer prompt
    focus_directive = ""
    if focus:
        focus_directive = f"\nSPECIAL FOCUS INSTRUCTION: Emphasize aspects regarding '{focus}'."

    system_prompt = (
        "You are PM Copilot, a Principal Product Manager and Technical Architect.\n"
        "Your task is to analyze the source document and produce an executive-ready, highly rigorous, "
        "and structured Markdown summary.\n"
        "Preserve concrete metrics, architecture names, constraints, timelines, and trade-offs.\n"
        "Do NOT invent fictional facts. Distill the provided source text faithfully into clean GitHub Flavored Markdown.\n"
        f"{focus_directive}\n\n"
        "Structure the markdown output with these exact headers:\n"
        "# Executive Document Brief: [Document Name]\n\n"
        "## 1. Executive Summary & Objective\n"
        "- High-level business purpose, strategic thesis, and core problems addressed.\n\n"
        "## 2. Core Architecture & System Specifications\n"
        "- Technical components, data flows, integration contracts, or process mechanics.\n\n"
        "## 3. Key Decisions, Constraints & Trade-Offs\n"
        "- Architectural choices, evaluated alternatives, dependencies, and boundaries.\n\n"
        "## 4. Success Metrics & Quantitative Acceptance Criteria\n"
        "- Measurable KPIs, SLAs, performance baselines, and quality gates.\n\n"
        "## 5. Identified Risks, Blockers & Open Questions\n"
        "- Security considerations, failure modes, cross-team blockers, and unvalidated assumptions.\n\n"
        "## 6. Actionable Next Steps & Engineering Tasks\n"
        "- Concrete, assignable action items with priority indicators [P0, P1, P2]."
    )

    user_prompt = (
        f"Document Filename: {src.name}\n"
        f"Original File Type: {src.suffix}\n\n"
        "DOCUMENT CONTENT:\n"
        f"{combined_doc_text}"
    )

    # 5. Call LLM Gateway with extended token limit for comprehensive file generation
    llm_res = llm_gateway.call_llm(
        db_module=db,
        system_prompt=system_prompt,
        message=user_prompt,
        history=[],
        max_tokens=max_tokens,
    )

    if "error" in llm_res:
        err_msg = f"AI summarization failed: {llm_res.get('error')}"
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="document_summarizer",
            input_data={"file_path": str(src), "output_path": str(out_file)},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    raw_summary = llm_res.get("response", "").strip()
    if not raw_summary:
        err_msg = "Model returned empty summary response."
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="document_summarizer",
            input_data={"file_path": str(src), "output_path": str(out_file)},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    # 6. Format deterministic markdown document with metadata frontmatter
    timestamp_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    header_frontmatter = (
        "---\n"
        f"source_file: {src.name}\n"
        f"source_path: {str(src)}\n"
        f"generated_at: {timestamp_iso}\n"
        f"model_provider: {llm_res.get('provider', 'ai')}\n"
        f"model_name: {llm_res.get('model', 'default')}\n"
        "---\n\n"
    )
    final_md_content = header_frontmatter + raw_summary

    # 7. Deterministically write file to disk
    try:
        tmp_file = out_file.with_suffix(".tmp")
        tmp_file.write_text(final_md_content, encoding="utf-8")
        os.replace(tmp_file, out_file)
        
        file_bytes = out_file.stat().st_size
        sha256 = hashlib.sha256(out_file.read_bytes()).hexdigest()
    except Exception as e:
        err_msg = f"Failed writing summary to target path '{out_file}': {str(e)}"
        duration_ms = int((time.time() - start_time) * 1000)
        ai_db.record_tool_run(
            tool_name="document_summarizer",
            input_data={"file_path": str(src), "output_path": str(out_file)},
            output_data={"error": err_msg},
            duration_ms=duration_ms,
            status="error",
            conversation_id=conversation_id,
        )
        return {"success": False, "error": err_msg}

    duration_ms = int((time.time() - start_time) * 1000)

    # 8. Record successful deterministic execution in ai_context.db
    run_id = ai_db.record_tool_run(
        tool_name="document_summarizer",
        input_data={
            "source_file": str(src),
            "output_path": str(out_file),
            "focus": focus,
            "project_id": project_id,
        },
        output_data={
            "status": "success",
            "bytes_written": file_bytes,
            "sha256": sha256,
            "provider": llm_res.get("provider"),
            "model": llm_res.get("model"),
        },
        duration_ms=duration_ms,
        status="success",
        conversation_id=conversation_id,
    )

    return {
        "success": True,
        "source_file": str(src),
        "filename": src.name,
        "output_path": str(out_file),
        "output_filename": out_file.name,
        "bytes_written": file_bytes,
        "sha256": sha256,
        "summary": raw_summary,
        "provider": llm_res.get("provider"),
        "model": llm_res.get("model"),
        "duration_ms": duration_ms,
        "tool_run_id": run_id,
    }
