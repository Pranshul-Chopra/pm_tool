# ── ports/document_repo.py ───────────────────────────────────────────────────
# Domain port definition for living documents, PRDs, and architecture specs.

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any


@dataclass
class DocumentEntity:
    id: int
    uuid: str
    project_id: Optional[int]
    title: str
    doc_type: str
    summary: str
    tags: List[str]
    is_pinned: bool
    word_count: int
    created_at: str
    updated_at: str
    external_provider: Optional[str] = None
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    sync_status: str = "synced"


@dataclass
class DocumentDetailEntity(DocumentEntity):
    content: str = ""


@dataclass
class RevisionEntity:
    id: int
    artifact_id: int
    version_num: int
    title: str
    summary: str
    word_count: int
    created_at: str


class DocumentRepositoryPort(ABC):
    """Abstract port for living documents, PRDs, and architecture specs."""

    @abstractmethod
    def list_documents(
        self,
        project_id: Optional[int] = None,
        doc_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[DocumentEntity]:
        """Lists metadata for stored living documents."""
        pass

    @abstractmethod
    def get_document(self, doc_id: int | str) -> Optional[DocumentDetailEntity]:
        """Retrieves a single living document with full content."""
        pass

    @abstractmethod
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
        """Creates or updates a document."""
        pass

    @abstractmethod
    def publish_revision(self, doc_id: int, summary: str = "Manual snapshot") -> RevisionEntity:
        """Publishes an immutable snapshot revision."""
        pass

    @abstractmethod
    def revert_revision(self, doc_id: int, version_num: int) -> Optional[DocumentDetailEntity]:
        """Restores document state to an earlier historical revision."""
        pass

    @abstractmethod
    def delete_document(self, doc_id: int) -> bool:
        """Permanently deletes a document."""
        pass
