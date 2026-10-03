# ── rag/chunker.py ────────────────────────────────────────────────────────────
# Section-aware, semantic document chunker for RAG retrieval.
# Handles sentence boundaries, code fence integrity, context prefixing, and debris filtering.

import re
from typing import List, Dict, Any, Optional

SENTENCE_SPLIT_REGEX = re.compile(r'(?<=[.!?])\s+(?=[A-Z0-9"\'`(\[])')


def _split_text_to_sentences(text: str) -> List[str]:
    """Split text into sentences while respecting common sentence terminators."""
    if not text.strip():
        return []
    if len(text.split()) < 30:
        return [text.strip()]

    raw_sentences = SENTENCE_SPLIT_REGEX.split(text)
    clean = []
    for s in raw_sentences:
        s_str = s.strip()
        if s_str:
            clean.append(s_str)
    return clean if clean else [text.strip()]


def _balance_code_fences(text: str, carried_lang: Optional[str] = None) -> tuple[str, Optional[str]]:
    """
    Ensure code fences are not left hanging unclosed in a chunk.
    If a chunk opens a fence without closing it, cleanly close it and return the language
    so the subsequent chunk can re-open the fence.
    """
    lines = text.splitlines()
    in_fence = False
    open_lang = "text"

    if carried_lang is not None:
        lines.insert(0, f"```{carried_lang}")
        in_fence = True
        open_lang = carried_lang

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("```"):
            if in_fence:
                in_fence = False
            else:
                in_fence = True
                open_lang = stripped[3:].strip() or "text"

    next_carried = None
    if in_fence:
        lines.append("```")
        next_carried = open_lang

    return "\n".join(lines), next_carried


def chunk_sections(
    sections: List[Dict[str, Any]],
    target_words: int = 380,
    overlap_words: int = 50,
) -> List[Dict[str, Any]]:
    """
    Chunk parsed sections into fine-tuned, semantic retrieval chunks.
    Features:
      - Hierarchical context tagging (preserves section titles in chunk content)
      - Sentence-boundary awareness (never cuts mid-sentence or mid-word)
      - Code fence balancing (safely closes and reopens ``` blocks across chunk boundaries)
      - Clean sliding overlap using complete sentences
      - Debris suppression (filters out tiny useless fragments)
    """
    chunks: List[Dict[str, Any]] = []
    carried_code_lang: Optional[str] = None

    for sec in sections:
        title = (sec.get("section_title") or "").strip()
        raw_content = (sec.get("content") or "").strip()
        if not raw_content:
            continue

        # Filter pure whitespace or trivial noise
        if len(raw_content) < 8:
            continue

        words = raw_content.split()
        total_words = len(words)

        # Context header to prepend if title is informative
        context_prefix = ""
        if title and not title.lower().startswith("section ") and not title.lower() in ("document content", "overview"):
            context_prefix = f"[{title}]\n"

        if total_words <= target_words + overlap_words:
            # Fits in one chunk comfortably
            chunk_body = f"{context_prefix}{raw_content}".strip()
            balanced_text, carried_code_lang = _balance_code_fences(chunk_body, carried_code_lang)
            chunks.append({
                "section_title": title or "General",
                "content": balanced_text,
                "token_count": int(len(balanced_text.split()) * 1.3),
            })
            continue

        # Split long sections by paragraphs
        paragraphs = [p.strip() for p in raw_content.split("\n\n") if p.strip()]

        # Expand any paragraph exceeding target_words into sentence units
        units: List[str] = []
        for p in paragraphs:
            p_words = len(p.split())
            if p_words > target_words // 2:
                sentences = _split_text_to_sentences(p)
                units.extend(sentences)
            else:
                units.append(p)

        current_units: List[str] = []
        current_word_count = 0

        for unit in units:
            unit_words = len(unit.split())
            if current_word_count + unit_words > target_words and current_units:
                # Flush current chunk
                chunk_body = "\n\n".join(current_units)
                if context_prefix and not chunk_body.startswith("["):
                    chunk_body = f"{context_prefix}{chunk_body}"

                balanced_text, carried_code_lang = _balance_code_fences(chunk_body, carried_code_lang)

                # Check minimum content threshold to avoid noise
                if len(balanced_text.split()) >= 15 or len(chunks) == 0:
                    chunks.append({
                        "section_title": title or "General",
                        "content": balanced_text,
                        "token_count": int(len(balanced_text.split()) * 1.3),
                    })

                # Calculate sentence/unit-based overlap
                overlap_units: List[str] = []
                overlap_count = 0
                for rev_u in reversed(current_units):
                    u_cnt = len(rev_u.split())
                    if overlap_count + u_cnt <= overlap_words:
                        overlap_units.insert(0, rev_u)
                        overlap_count += u_cnt
                    else:
                        break

                current_units = overlap_units + [unit]
                current_word_count = overlap_count + unit_words
            else:
                current_units.append(unit)
                current_word_count += unit_words

        if current_units:
            chunk_body = "\n\n".join(current_units)
            if context_prefix and not chunk_body.startswith("["):
                chunk_body = f"{context_prefix}{chunk_body}"

            balanced_text, carried_code_lang = _balance_code_fences(chunk_body, carried_code_lang)
            if len(balanced_text.split()) >= 10 or len(chunks) == 0:
                chunks.append({
                    "section_title": title or "General",
                    "content": balanced_text,
                    "token_count": int(len(balanced_text.split()) * 1.3),
                })

    return chunks
