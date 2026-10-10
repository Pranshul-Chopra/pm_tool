# ── adapters/local_ticket_adapter.py ──────────────────────────────────────────
# Local SQLite adapter implementing TicketTrackerPort.
# Provides 100% contract parity with remote outposts even when completely offline.

import json
from typing import List, Optional, Dict, Any

from ports.ticket_tracker import (
    BoardColumn,
    BoardSchema,
    TaskEntity,
    CreateTaskPayload,
    UpdateTaskPayload,
    TaskTransitionResult,
    SyncResult,
    TicketTrackerPort,
)
import db


DEFAULT_LOCAL_COLUMNS = [
    BoardColumn(id="todo", name="To Do", status_category="todo", order=0),
    BoardColumn(id="in_progress", name="In Progress", status_category="in_progress", order=1),
    BoardColumn(id="blocked", name="Blocked", status_category="blocked", order=2),
    BoardColumn(id="done", name="Done", status_category="done", order=3),
]

ALLOWED_TYPES = ["task", "story", "bug", "epic"]
ALLOWED_LABELS = ["frontend", "backend", "design", "security", "infra", "p0", "p1"]


class LocalTicketAdapter(TicketTrackerPort):
    """Local SQLite-backed implementation of TicketTrackerPort."""

    def get_board_schema(self, project_id: int) -> BoardSchema:
        """Returns the local 4-column agile board schema."""
        return BoardSchema(
            provider="local",
            columns=DEFAULT_LOCAL_COLUMNS,
            allowed_types=ALLOWED_TYPES,
            allowed_labels=ALLOWED_LABELS,
        )

    def list_tasks(self, project_id: int, status: Optional[str] = None) -> List[TaskEntity]:
        """Lists tasks for the given project, mapping SQLite rows to TaskEntity instances."""
        raw_tasks = db.get_tasks(project_id=project_id, status=status)
        entities = []
        for r in raw_tasks:
            # Parse external_labels if stored as JSON
            ext_labels = []
            if r.get("external_labels"):
                try:
                    ext_labels = json.loads(r["external_labels"]) if isinstance(r["external_labels"], str) else r["external_labels"]
                except Exception:
                    ext_labels = []

            # Derive local labels (can be empty list or tags)
            labels = ext_labels if ext_labels else []

            entities.append(
                TaskEntity(
                    id=r["id"],
                    project_id=r["project_id"],
                    title=r["title"],
                    description=r.get("description", "") or "",
                    status=r.get("status", "todo"),
                    priority=r.get("priority", "medium"),
                    ticket_type=r.get("ticket_type", "task") or "task",
                    story_points=r.get("story_points", 0) or 0,
                    assignee=r.get("assignee", "") or "",
                    acceptance_criteria=r.get("acceptance_criteria", "") or "",
                    due_date=r.get("due_date"),
                    labels=labels,
                    external_provider=r.get("external_provider"),
                    external_id=r.get("external_id"),
                    external_url=r.get("external_url"),
                    external_type=r.get("external_type"),
                    external_labels=ext_labels,
                    sync_status=r.get("sync_status", "synced") or "synced",
                    last_synced_at=r.get("last_synced_at"),
                    created_at=r.get("created_at"),
                    updated_at=r.get("updated_at"),
                )
            )
        return entities

    def create_task(self, project_id: int, payload: CreateTaskPayload) -> TaskEntity:
        """Creates a local task in pmtool.db."""
        created = db.create_task(
            project_id=project_id,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            ticket_type=payload.ticket_type,
            story_points=payload.story_points,
            assignee=payload.assignee,
            acceptance_criteria=payload.acceptance_criteria,
            due_date=payload.due_date or "",
            external_labels=payload.labels,
        )
        return TaskEntity(
            id=created["id"],
            project_id=created["project_id"],
            title=created["title"],
            description=created.get("description", "") or "",
            status=created.get("status", "todo"),
            priority=created.get("priority", "medium"),
            ticket_type=created.get("ticket_type", "task") or "task",
            story_points=created.get("story_points", 0) or 0,
            assignee=created.get("assignee", "") or "",
            acceptance_criteria=created.get("acceptance_criteria", "") or "",
            due_date=created.get("due_date"),
            labels=payload.labels,
            external_provider=None,
            external_id=None,
            external_url=None,
            external_type=None,
            external_labels=payload.labels,
            sync_status="synced",
            created_at=created.get("created_at"),
            updated_at=created.get("updated_at"),
        )

    def update_task(self, task_id: int, patch: UpdateTaskPayload) -> TaskEntity:
        """Updates a local task."""
        fields: Dict[str, Any] = {}
        if patch.title is not None:
            fields["title"] = patch.title
        if patch.description is not None:
            fields["description"] = patch.description
        if patch.status is not None:
            fields["status"] = patch.status
        if patch.priority is not None:
            fields["priority"] = patch.priority
        if patch.ticket_type is not None:
            fields["ticket_type"] = patch.ticket_type
        if patch.story_points is not None:
            fields["story_points"] = patch.story_points
        if patch.assignee is not None:
            fields["assignee"] = patch.assignee
        if patch.acceptance_criteria is not None:
            fields["acceptance_criteria"] = patch.acceptance_criteria
        if patch.due_date is not None:
            fields["due_date"] = patch.due_date
        if patch.labels is not None:
            fields["external_labels"] = json.dumps(patch.labels)

        updated = db.update_task(task_id, **fields)
        if not updated:
            raise ValueError(f"Task {task_id} not found.")

        labels = patch.labels if patch.labels is not None else []
        return TaskEntity(
            id=updated["id"],
            project_id=updated["project_id"],
            title=updated["title"],
            description=updated.get("description", "") or "",
            status=updated.get("status", "todo"),
            priority=updated.get("priority", "medium"),
            ticket_type=updated.get("ticket_type", "task") or "task",
            story_points=updated.get("story_points", 0) or 0,
            assignee=updated.get("assignee", "") or "",
            acceptance_criteria=updated.get("acceptance_criteria", "") or "",
            due_date=updated.get("due_date"),
            labels=labels,
            external_provider=updated.get("external_provider"),
            external_id=updated.get("external_id"),
            external_url=updated.get("external_url"),
            external_type=updated.get("external_type"),
            sync_status=updated.get("sync_status", "synced") or "synced",
            created_at=updated.get("created_at"),
            updated_at=updated.get("updated_at"),
        )

    def transition_task(self, task_id: int, target_status: str) -> TaskTransitionResult:
        """Executes a workflow state transition locally in SQLite."""
        existing = db.get_task(task_id)
        if not existing:
            return TaskTransitionResult(
                task_id=task_id,
                old_status="unknown",
                new_status=target_status,
                success=False,
                error=f"Task {task_id} not found",
            )

        old_status = existing.get("status", "todo")
        updated = db.update_task(task_id, status=target_status)
        if not updated:
            return TaskTransitionResult(
                task_id=task_id,
                old_status=old_status,
                new_status=target_status,
                success=False,
                error="Failed to persist status transition to SQLite",
            )

        return TaskTransitionResult(
            task_id=task_id,
            old_status=old_status,
            new_status=target_status,
            success=True,
            sync_status="synced",
        )

    def delete_task(self, task_id: int) -> bool:
        """Deletes a task locally."""
        return db.delete_task(task_id)

    def sync_external(self, project_id: int) -> SyncResult:
        """Local mode is self-authoritative and always synchronized."""
        return SyncResult(
            provider="local",
            project_id=project_id,
            pulled_count=0,
            pushed_count=0,
            conflicts_count=0,
            success=True,
        )
