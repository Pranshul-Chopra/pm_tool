# ── ports/ticket_tracker.py ──────────────────────────────────────────────────
# Domain port definition for all backlog, task, and board operations.

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any


@dataclass
class BoardColumn:
    id: str
    name: str
    status_category: str  # 'todo', 'in_progress', 'blocked', 'done'
    order: int


@dataclass
class BoardSchema:
    provider: str  # 'local' | 'jira'
    columns: List[BoardColumn]
    allowed_types: List[str]  # e.g. ['task', 'story', 'bug', 'epic']
    allowed_labels: List[str]


@dataclass
class TaskEntity:
    id: int
    project_id: int
    title: str
    description: str = ""
    status: str = "todo"
    priority: str = "medium"
    ticket_type: str = "task"
    story_points: int = 0
    assignee: str = ""
    acceptance_criteria: str = ""
    due_date: Optional[str] = None
    labels: List[str] = field(default_factory=list)
    external_provider: Optional[str] = None
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    external_type: Optional[str] = None
    external_labels: List[str] = field(default_factory=list)
    sync_status: str = "synced"
    last_synced_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class CreateTaskPayload:
    title: str
    description: str = ""
    status: str = "todo"
    priority: str = "medium"
    ticket_type: str = "task"
    story_points: int = 0
    assignee: str = ""
    acceptance_criteria: str = ""
    due_date: Optional[str] = None
    labels: List[str] = field(default_factory=list)


@dataclass
class UpdateTaskPayload:
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    ticket_type: Optional[str] = None
    story_points: Optional[int] = None
    assignee: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    due_date: Optional[str] = None
    labels: Optional[List[str]] = None


@dataclass
class TaskTransitionResult:
    task_id: int
    old_status: str
    new_status: str
    success: bool
    sync_status: str = "synced"
    error: Optional[str] = None


@dataclass
class SyncResult:
    provider: str
    project_id: int
    pulled_count: int
    pushed_count: int
    conflicts_count: int
    success: bool
    error: Optional[str] = None


class TicketTrackerPort(ABC):
    """Abstract port for all board and backlog operations."""

    @abstractmethod
    def get_board_schema(self, project_id: int) -> BoardSchema:
        """Returns the active board columns, workflow transitions, and allowed labels."""
        pass

    @abstractmethod
    def list_tasks(self, project_id: int, status: Optional[str] = None) -> List[TaskEntity]:
        """Lists tasks matching criteria."""
        pass

    @abstractmethod
    def create_task(self, project_id: int, payload: CreateTaskPayload) -> TaskEntity:
        """Creates a new task/story."""
        pass

    @abstractmethod
    def update_task(self, task_id: int, patch: UpdateTaskPayload) -> TaskEntity:
        """Updates task title, description, points, or labels."""
        pass

    @abstractmethod
    def transition_task(self, task_id: int, target_status: str) -> TaskTransitionResult:
        """Executes a workflow state transition."""
        pass

    @abstractmethod
    def delete_task(self, task_id: int) -> bool:
        """Deletes or archives a task."""
        pass

    @abstractmethod
    def sync_external(self, project_id: int) -> SyncResult:
        """Refreshes state from authoritative backend."""
        pass
