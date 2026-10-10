# ── adapters/local_artifacts_adapter.py ───────────────────────────────────────
# Local SQLite adapter implementing DocumentRepositoryPort.
# Interacts with %LOCALAPPDATA%\PMTool\artifacts.db.

from typing import List, Optional, Dict, Any

from ports.document_repo import (
    DocumentEntity,
    DocumentDetailEntity,
    RevisionEntity,
    DocumentRepositoryPort,
)
import artifacts_db


class LocalArtifactsAdapter(DocumentRepositoryPort):
    """Local SQLite-backed implementation of DocumentRepositoryPort."""

    def list_documents(
        self,
        project_id: Optional[int] = None,
        doc_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[DocumentEntity]:
        """Lists metadata for stored living documents."""
        raw_docs = artifacts_db.list_artifacts(
            project_id=project_id,
            doc_type=doc_type,
            search=search,
        )
        return [
            DocumentEntity(
                id=d["id"],
                uuid=d["uuid"],
                project_id=d.get("project_id"),
                title=d["title"],
                doc_type=d["doc_type"],
                summary=d.get("summary", "") or "",
                tags=d.get("tags", []),
                is_pinned=d.get("is_pinned", False),
                word_count=d.get("word_count", 0),
                created_at=d["created_at"],
                updated_at=d["updated_at"],
                external_provider=d.get("external_provider"),
                external_id=d.get("external_id"),
                external_url=d.get("external_url"),
                sync_status=d.get("sync_status", "synced") or "synced",
            )
            for d in raw_docs
        ]

    def get_document(self, doc_id: int | str) -> Optional[DocumentDetailEntity]:
        """Retrieves a single living document with full markdown content."""
        d = artifacts_db.get_artifact(doc_id)
        if not d:
            return None
        return DocumentDetailEntity(
            id=d["id"],
            uuid=d["uuid"],
            project_id=d.get("project_id"),
            title=d["title"],
            doc_type=d["doc_type"],
            summary=d.get("summary", "") or "",
            tags=d.get("tags", []),
            is_pinned=d.get("is_pinned", False),
            word_count=d.get("word_count", 0),
            created_at=d["created_at"],
            updated_at=d["updated_at"],
            external_provider=d.get("external_provider"),
            external_id=d.get("external_id"),
            external_url=d.get("external_url"),
            sync_status=d.get("sync_status", "synced") or "synced",
            content=d.get("content", ""),
        )

    def save_document(
        self,
        doc_id: Optional[int],
        content: str,
        title: str,
        doc_type: str = "document",
        tags: Optional[List[str]] = None,
        project_id: Optional[int] = None,
        summary: str = "",
    ) -> DocumentEntity:
        """Creates or updates a document in artifacts.db."""
        if doc_id:
            updated = artifacts_db.update_artifact(
                artifact_id=doc_id,
                title=title,
                content=content,
                doc_type=doc_type,
                project_id=project_id,
                tags=tags,
                summary=summary,
            )
            d = updated or artifacts_db.get_artifact(doc_id)
        else:
            d = artifacts_db.create_artifact(
                title=title,
                content=content,
                doc_type=doc_type,
                project_id=project_id,
                tags=tags,
                summary=summary,
            )

        return DocumentEntity(
            id=d["id"],
            uuid=d["uuid"],
            project_id=d.get("project_id"),
            title=d["title"],
            doc_type=d["doc_type"],
            summary=d.get("summary", "") or "",
            tags=d.get("tags", []),
            is_pinned=d.get("is_pinned", False),
            word_count=d.get("word_count", 0),
            created_at=d["created_at"],
            updated_at=d["updated_at"],
            external_provider=d.get("external_provider"),
            external_id=d.get("external_id"),
            external_url=d.get("external_url"),
            sync_status=d.get("sync_status", "synced") or "synced",
        )

    def publish_revision(self, doc_id: int, summary: str = "Manual snapshot") -> RevisionEntity:
        """Publishes an immutable snapshot revision."""
        rev = artifacts_db.create_artifact_version(doc_id, summary=summary)
        return RevisionEntity(
            id=rev["id"],
            artifact_id=rev["artifact_id"],
            version_num=rev["version_num"],
            title=rev["title"],
            summary=rev.get("summary", "") or "",
            word_count=rev.get("word_count", 0),
            created_at=rev["created_at"],
        )

    def revert_revision(self, doc_id: int, version_num: int) -> Optional[DocumentDetailEntity]:
        """Restores document state to an earlier historical revision."""
        reverted = artifacts_db.revert_to_version(doc_id, version_num)
        if not reverted:
            return None
        return self.get_document(doc_id)

    def delete_document(self, doc_id: int) -> bool:
        """Permanently deletes a document."""
        return artifacts_db.delete_artifact(doc_id)
