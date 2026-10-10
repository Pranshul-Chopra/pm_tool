# ── ports/knowledge_source.py ────────────────────────────────────────────────
# Domain port definition for external knowledge repositories (Notion, GDocs, Local RAG).

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any


@dataclass
class RawDocumentPayload:
    source_id: str
    title: str
    content: str
    source_type: str  # 'disk', 'notion', 'gdocs'
    url: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConnectionDiagnostic:
    provider: str
    healthy: bool
    latency_ms: float
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


class KnowledgeSourcePort(ABC):
    """Abstract port for indexing, chunking, and querying knowledge content."""

    @abstractmethod
    def pull_documents(self, source_id: Any) -> List[RawDocumentPayload]:
        """Pulls raw documents ready for local RAG chunking and indexing."""
        pass

    @abstractmethod
    def test_connection(self, config: Dict[str, Any]) -> ConnectionDiagnostic:
        """Runs a diagnostic handshake test verifying connectivity and credentials."""
        pass
