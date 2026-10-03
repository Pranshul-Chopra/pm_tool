# ── rag/engine.py ─────────────────────────────────────────────────────────────
# Ingestion and Retrieval orchestrator for PM Tool local document RAG.

import os
from pathlib import Path
from typing import List, Dict, Any, Optional

import db
import ai_db
from rag.parsers import parse_file
from rag.chunker import chunk_sections

SUPPORTED_EXTENSIONS = {".md", ".markdown", ".txt", ".text", ".pdf", ".docx", ".csv", ".json"}
IGNORE_DIRECTORIES = {".git", "node_modules", "venv", "__pycache__", ".idea", ".vscode", "dist", "build"}


def scan_and_ingest_directory(
    dir_path: str,
    project_id: Optional[int] = None,
    recursive: bool = True,
) -> Dict[str, Any]:
    """
    Scan a local directory, parse all supported product documents,
    extract semantic sections, and index chunks into ai_context.db.
    """
    path_obj = Path(dir_path)
    if not path_obj.exists() or not path_obj.is_dir():
        return {
            "error": f"Directory not found or inaccessible: {dir_path}",
            "scanned": 0,
            "indexed": 0,
            "skipped": 0,
            "errors": [],
        }

    scanned = 0
    indexed = 0
    updated = 0
    skipped = 0
    errors = []

    files_to_process = []
    if recursive:
        for root, dirs, files in os.walk(path_obj):
            # Prune ignored directories
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRECTORIES and not d.startswith(".")]
            for f in files:
                ext = Path(f).suffix.lower()
                if ext in SUPPORTED_EXTENSIONS:
                    files_to_process.append(Path(root) / f)
    else:
        for f in path_obj.iterdir():
            if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS:
                files_to_process.append(f)

    for file_path in files_to_process:
        scanned += 1
        try:
            stat = file_path.stat()
            file_size = stat.st_size
            last_mod = stat.st_mtime
            abs_path = str(file_path.resolve())

            # Check if document is already indexed and unchanged
            existing = db.get_document_by_path(abs_path)
            if existing and existing.get("file_size") == file_size and abs(existing.get("last_modified", 0) - last_mod) < 0.5:
                skipped += 1
                continue

            # Parse document into structured sections
            sections = parse_file(file_path)
            if not sections:
                skipped += 1
                continue

            # Break into semantic retrieval chunks
            chunks = chunk_sections(sections)
            if not chunks:
                skipped += 1
                continue

            # 1. Upsert document record in pm_tool.db
            doc_record = db.upsert_document(
                file_path=abs_path,
                filename=file_path.name,
                file_type=file_path.suffix.lower(),
                file_size=file_size,
                last_modified=last_mod,
                project_id=project_id,
                chunk_count=len(chunks),
                status="indexed",
            )

            # 2. Insert chunks and FTS5 full-text index in ai_context.db
            ai_db.insert_document_chunks(
                doc_id=doc_record["id"],
                file_path=abs_path,
                filename=file_path.name,
                chunks=chunks,
                project_id=project_id,
            )

            if existing:
                updated += 1
            else:
                indexed += 1

        except Exception as e:
            errors.append({"file": str(file_path), "error": str(e)})

    # Also register folder path in doc_folders if successful
    try:
        db.add_doc_folder(
            folder_path=str(path_obj.resolve()),
            project_id=project_id,
            label=path_obj.name,
            recursive=recursive,
        )
    except Exception:
        pass

    return {
        "folder": str(path_obj.resolve()),
        "scanned": scanned,
        "indexed": indexed,
        "updated": updated,
        "skipped": skipped,
        "total_documents": len(db.list_documents()),
        "errors": errors,
    }


def ingest_single_file(file_path: str, project_id: Optional[int] = None) -> Dict[str, Any]:
    """Parse and index a single document file."""
    path_obj = Path(file_path)
    if not path_obj.exists() or not path_obj.is_file():
        return {"error": f"File not found: {file_path}"}

    try:
        stat = path_obj.stat()
        sections = parse_file(path_obj)
        chunks = chunk_sections(sections)

        abs_path = str(path_obj.resolve())
        doc_record = db.upsert_document(
            file_path=abs_path,
            filename=path_obj.name,
            file_type=path_obj.suffix.lower(),
            file_size=stat.st_size,
            last_modified=stat.st_mtime,
            project_id=project_id,
            chunk_count=len(chunks),
            status="indexed",
        )

        ai_db.insert_document_chunks(
            doc_id=doc_record["id"],
            file_path=abs_path,
            filename=path_obj.name,
            chunks=chunks,
            project_id=project_id,
        )

        return {"document": doc_record, "chunks_count": len(chunks)}
    except Exception as e:
        return {"error": str(e)}


def retrieve_context(query: str, project_id: Optional[int] = None, top_k: int = 4) -> List[Dict[str, Any]]:
    """Retrieve the top-k most relevant evidence passages for a query."""
    return ai_db.search_chunks_bm25(query=query, project_id=project_id, limit=top_k)


def format_retrieved_context_for_prompt(chunks: List[Dict[str, Any]]) -> str:
    """Format retrieved document chunks as clean citations to inject into the LLM prompt."""
    if not chunks:
        return ""

    lines = [
        "\n=======================================================",
        "### VERIFIED EVIDENCE RETRIEVED FROM LOCAL COMPANY DOCUMENTS:",
        "Use the following excerpts as factual grounding for your response.",
        "Always cite the source document name when referencing these facts.",
        "=======================================================",
    ]

    for i, c in enumerate(chunks, 1):
        lines.append(f"\n[EVIDENCE CHUNK #{i}]")
        lines.append(f"- **Document**: {c.get('filename')}")
        if c.get("section_title"):
            lines.append(f"- **Section**: {c.get('section_title')}")
        lines.append(f"- **Path**: {c.get('file_path')}")
        lines.append(f"- **Content**:\n{c.get('content', '').strip()}\n")

    lines.append("=======================================================")
    lines.append("Cite relevant document names clearly (e.g. `[Source: document.md]`) in your final recommendations.")
    return "\n".join(lines)
