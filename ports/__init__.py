# ── ports/__init__.py ────────────────────────────────────────────────────────
# Hexagonal architecture domain ports for PM Tool v2.2.5 ("Outpost & Nexus").

from .ticket_tracker import (
    BoardColumn,
    BoardSchema,
    TaskEntity,
    CreateTaskPayload,
    UpdateTaskPayload,
    TaskTransitionResult,
    SyncResult,
    TicketTrackerPort,
)
from .document_repo import (
    DocumentEntity,
    DocumentDetailEntity,
    RevisionEntity,
    DocumentRepositoryPort,
)
from .knowledge_source import (
    RawDocumentPayload,
    ConnectionDiagnostic,
    KnowledgeSourcePort,
)

__all__ = [
    "BoardColumn",
    "BoardSchema",
    "TaskEntity",
    "CreateTaskPayload",
    "UpdateTaskPayload",
    "TaskTransitionResult",
    "SyncResult",
    "TicketTrackerPort",
    "DocumentEntity",
    "DocumentDetailEntity",
    "RevisionEntity",
    "DocumentRepositoryPort",
    "RawDocumentPayload",
    "ConnectionDiagnostic",
    "KnowledgeSourcePort",
]
