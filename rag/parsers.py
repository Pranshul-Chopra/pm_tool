# ── rag/parsers.py ────────────────────────────────────────────────────────────
# Document parsers for Markdown, Plaintext, PDF, Word (.docx), CSV, and JSON.

import os
from pathlib import Path
from typing import List, Dict, Any


def parse_markdown(file_path: Path) -> List[Dict[str, Any]]:
    """
    Parse a Markdown file into structured sections based on headers (#, ##, ###).
    Returns a list of {"section_title": str, "content": str}.
    """
    text = file_path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()

    sections = []
    current_title = "Overview"
    current_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith(("# ", "## ", "### ", "#### ")):
            if current_lines:
                content = "\n".join(current_lines).strip()
                if content:
                    sections.append({"section_title": current_title, "content": content})
                current_lines = []
            current_title = stripped.lstrip("#").strip()
        else:
            current_lines.append(line)

    if current_lines:
        content = "\n".join(current_lines).strip()
        if content:
            sections.append({"section_title": current_title, "content": content})

    return sections if sections else [{"section_title": "Document Content", "content": text.strip()}]


def parse_plaintext(file_path: Path) -> List[Dict[str, Any]]:
    """Parse a plain text file into logical sections by double-line breaks."""
    text = file_path.read_text(encoding="utf-8", errors="replace")
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        return []

    sections = []
    chunk_buffer = []
    word_count = 0

    for p in paragraphs:
        chunk_buffer.append(p)
        word_count += len(p.split())
        if word_count >= 300:
            sections.append({
                "section_title": f"Section {len(sections) + 1}",
                "content": "\n\n".join(chunk_buffer)
            })
            chunk_buffer = []
            word_count = 0

    if chunk_buffer:
        sections.append({
            "section_title": f"Section {len(sections) + 1}",
            "content": "\n\n".join(chunk_buffer)
        })

    return sections


def parse_pdf(file_path: Path) -> List[Dict[str, Any]]:
    """Parse a PDF document page-by-page using pypdf."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(file_path))
        sections = []

        for idx, page in enumerate(reader.pages):
            text = (page.extract_text() or "").strip()
            if text:
                sections.append({
                    "section_title": f"Page {idx + 1}",
                    "content": text
                })
        return sections
    except Exception as e:
        return [{"section_title": "PDF Extraction Error", "content": f"Failed to parse PDF: {str(e)}"}]


def parse_docx(file_path: Path) -> List[Dict[str, Any]]:
    """Parse a Microsoft Word (.docx) document using python-docx."""
    try:
        import docx
        doc = docx.Document(str(file_path))
        sections = []
        current_title = "Document Body"
        current_lines = []

        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            # Check for Word heading styles
            if para.style.name.startswith("Heading"):
                if current_lines:
                    sections.append({
                        "section_title": current_title,
                        "content": "\n\n".join(current_lines)
                    })
                    current_lines = []
                current_title = text
            else:
                current_lines.append(text)

        # Extract table text
        for table in doc.tables:
            table_lines = []
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    table_lines.append(row_text)
            if table_lines:
                current_lines.append("\n".join(table_lines))

        if current_lines:
            sections.append({
                "section_title": current_title,
                "content": "\n\n".join(current_lines)
            })

        return sections if sections else [{"section_title": "Overview", "content": "(Empty document)"}]
    except Exception as e:
        return [{"section_title": "DOCX Extraction Error", "content": f"Failed to parse Word document: {str(e)}"}]


def parse_csv(file_path: Path) -> List[Dict[str, Any]]:
    """Parse a CSV data file into structured rows."""
    import csv
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            rows = list(reader)
            if not rows:
                return []
            header = rows[0]
            header_line = " | ".join(header)
            data_lines = []
            for r in rows[1:100]:  # limit first 100 rows per file
                data_lines.append(" | ".join(r))

            content = f"Columns: {header_line}\n\nRows:\n" + "\n".join(data_lines)
            return [{"section_title": f"CSV Dataset: {file_path.name}", "content": content}]
    except Exception as e:
        return [{"section_title": "CSV Parse Error", "content": str(e)}]


def parse_json(file_path: Path) -> List[Dict[str, Any]]:
    """Parse a JSON file into formatted markdown."""
    import json
    try:
        data = json.loads(file_path.read_text(encoding="utf-8", errors="replace"))
        content = json.dumps(data, indent=2)
        if len(content) > 10000:
            content = content[:10000] + "\n...(truncated)"
        return [{"section_title": f"JSON: {file_path.name}", "content": content}]
    except Exception as e:
        return [{"section_title": "JSON Parse Error", "content": str(e)}]


def parse_file(file_path: Path) -> List[Dict[str, Any]]:
    """Universal dispatcher to parse any supported document type."""
    ext = file_path.suffix.lower()
    if ext in (".md", ".markdown"):
        return parse_markdown(file_path)
    elif ext in (".txt", ".text", ".rst", ".log"):
        return parse_plaintext(file_path)
    elif ext == ".pdf":
        return parse_pdf(file_path)
    elif ext == ".docx":
        return parse_docx(file_path)
    elif ext == ".csv":
        return parse_csv(file_path)
    elif ext == ".json":
        return parse_json(file_path)
    else:
        # Fallback to plain text reading
        try:
            return parse_plaintext(file_path)
        except Exception:
            return []
