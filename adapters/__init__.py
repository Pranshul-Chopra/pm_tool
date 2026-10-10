# ── adapters/__init__.py ─────────────────────────────────────────────────────
# Outpost and Local Adapters for PM Tool v2.2.5 ("Outpost & Nexus").

from .local_ticket_adapter import LocalTicketAdapter
from .local_artifacts_adapter import LocalArtifactsAdapter
from .local_disk_rag_adapter import LocalDiskRAGAdapter
from .jira_ticket_adapter import JiraTicketAdapter
from .notion_document_adapter import NotionDocumentAdapter
from .gdocs_document_adapter import GDocsDocumentAdapter

__all__ = [
    "LocalTicketAdapter",
    "LocalArtifactsAdapter",
    "LocalDiskRAGAdapter",
    "JiraTicketAdapter",
    "NotionDocumentAdapter",
    "GDocsDocumentAdapter",
]
