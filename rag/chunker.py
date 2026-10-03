# ── rag/chunker.py ────────────────────────────────────────────────────────────
# Section-aware document chunker for RAG retrieval.

import re
from typing import List, Dict, Any


def chunk_sections(
    sections: List[Dict[str, Any]],
    target_words: int = 400,
    overlap_words: int = 50,
) -> List[Dict[str, Any]]:
    """
    Chunk parsed sections into semantic retrieval chunks.
    Ensures headers/sections are preserved and chunks do not exceed reasonable LLM context sizes.
    """
    chunks = []

    for sec in sections:
        title = sec.get("section_title", "").strip()
        content = sec.get("content", "").strip()
        if not content:
            continue

        words = content.split()
        if len(words) <= target_words + overlap_words:
            # Section fits comfortably in a single chunk
            chunks.append({
                "section_title": title,
                "content": content,
                "token_count": int(len(words) * 1.3),
            })
        else:
            # Split long sections into paragraphs with sliding overlap
            paragraphs = content.split("\n\n")
            current_chunk_words = []
            current_paragraphs = []

            for p in paragraphs:
                p_words = p.split()
                if len(current_chunk_words) + len(p_words) > target_words and current_paragraphs:
                    chunk_text = "\n\n".join(current_paragraphs)
                    chunks.append({
                        "section_title": title,
                        "content": chunk_text,
                        "token_count": int(len(current_chunk_words) * 1.3),
                    })
                    # Keep overlap from the end
                    overlap = current_chunk_words[-overlap_words:] if len(current_chunk_words) > overlap_words else []
                    current_paragraphs = [" ".join(overlap), p] if overlap else [p]
                    current_chunk_words = overlap + p_words
                else:
                    current_paragraphs.append(p)
                    current_chunk_words.extend(p_words)

            if current_paragraphs:
                chunk_text = "\n\n".join(current_paragraphs)
                chunks.append({
                    "section_title": title,
                    "content": chunk_text,
                    "token_count": int(len(current_chunk_words) * 1.3),
                })

    return chunks
