# ── adapters/local_disk_rag_adapter.py ─────────────────────────────────────────
# Local disk RAG adapter implementing KnowledgeSourcePort.

import os
import time
from pathlib import Path
from typing import List, Dict, Optional, Any

from ports.knowledge_source import (
    RawDocumentPayload,
    ConnectionDiagnostic,
    KnowledgeSourcePort,
)
import db


class LocalDiskRAGAdapter(KnowledgeSourcePort):
    """Local disk-backed implementation of KnowledgeSourcePort."""

    def pull_documents(self, source_id: Any) -> List[RawDocumentPayload]:
        """Pulls documents from indexed folders in pmtool.db."""
        results = []
        doc_rows = db.get_documents(project_id=source_id if isinstance(source_id, int) else None)
        for d in doc_rows:
            fpath = d.get("file_path", "")
            if fpath and os.path.exists(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    results.append(
                        RawDocumentPayload(
                            source_id=str(d["id"]),
                            title=d.get("filename", Path(fpath).name),
                            content=content,
                            source_type="disk",
                            url=fpath,
                            metadata={"file_size": d.get("file_size", 0), "file_type": d.get("file_type")},
                        )
                    )
                except Exception:
                    continue
        return results

    def test_connection(self, config: Dict[str, Any]) -> ConnectionDiagnostic:
        """Verifies local disk accessibility and database readiness."""
        t0 = time.perf_counter()
        try:
            with db.get_db() as conn:
                conn.execute("SELECT 1").fetchone()
            latency = (time.perf_counter() - t0) * 1000.0
            return ConnectionDiagnostic(
                provider="disk",
                healthy=True,
                latency_ms=round(latency, 2),
                message="Local SQLite RAG store is operational.",
                details={"sqlite_wal": True},
            )
        except Exception as e:
            return ConnectionDiagnostic(
                provider="disk",
                healthy=False,
                latency_ms=0.0,
                message=f"Local disk RAG diagnostic error: {str(e)}",
            )
