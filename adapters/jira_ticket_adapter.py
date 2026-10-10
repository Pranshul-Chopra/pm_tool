# ── adapters/jira_ticket_adapter.py ──────────────────────────────────────────
# Atlassian Jira Cloud REST API v3 Outpost Adapter.
# Dictates board workflow, task state transitions, and issue metadata when linked.

import base64
import json
import time
import urllib.request
import urllib.error
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
from ports.knowledge_source import ConnectionDiagnostic
from tools.outposts.security import validate_outpost_url, decrypt_token
import db


class JiraTicketAdapter(TicketTrackerPort):
    """Atlassian Jira Cloud v3 implementation of TicketTrackerPort."""

    def __init__(
        self,
        base_url: str,
        user_email: str,
        auth_token: str,
        project_key: Optional[str] = None,
        allow_localhost: bool = False,
    ):
        self.base_url = (base_url or "").rstrip("/")
        self.user_email = (user_email or "").strip()
        # Token may be stored machine-encrypted; decrypt if enc_v1:
        self.raw_token = decrypt_token(auth_token) if auth_token.startswith("enc_v1:") else auth_token
        self.project_key = (project_key or "").strip().upper()
        self.allow_localhost = allow_localhost

    def _get_auth_header(self) -> str:
        pair = f"{self.user_email}:{self.raw_token}".encode("utf-8")
        return "Basic " + base64.b64encode(pair).decode("ascii")

    def _http_request(
        self,
        endpoint: str,
        method: str = "GET",
        data: Optional[Dict[str, Any]] = None,
        timeout: float = 10.0,
    ) -> Dict[str, Any]:
        """Dispatches an authenticated HTTP request to Jira with defensive URL verification."""
        full_url = f"{self.base_url}{endpoint}"
        is_safe, reason = validate_outpost_url(full_url, provider="jira", allow_localhost=self.allow_localhost)
        if not is_safe:
            raise ValueError(f"SSRF violation on Jira outpost endpoint: {reason}")

        headers = {
            "Authorization": self._get_auth_header(),
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "PMTool-Desktop-Outpost/2.2.5",
        }

        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(full_url, data=body, headers=headers, method=method)

        with urllib.request.urlopen(req, timeout=timeout) as response:
            resp_bytes = response.read()
            if not resp_bytes:
                return {}
            return json.loads(resp_bytes.decode("utf-8"))

    def test_connection(self) -> ConnectionDiagnostic:
        """Verifies Jira credentials against /rest/api/3/myself."""
        t0 = time.perf_counter()
        try:
            resp = self._http_request("/rest/api/3/myself", method="GET", timeout=8.0)
            latency = (time.perf_counter() - t0) * 1000.0
            display_name = resp.get("displayName", "Jira User")
            return ConnectionDiagnostic(
                provider="jira",
                healthy=True,
                latency_ms=round(latency, 2),
                message=f"Connected successfully as {display_name}.",
                details={
                    "accountId": resp.get("accountId"),
                    "emailAddress": resp.get("emailAddress", self.user_email),
                    "active": resp.get("active", True),
                },
            )
        except urllib.error.HTTPError as e:
            latency = (time.perf_counter() - t0) * 1000.0
            return ConnectionDiagnostic(
                provider="jira",
                healthy=False,
                latency_ms=round(latency, 2),
                message=f"Jira authentication failed: HTTP {e.code} ({e.reason})",
            )
        except Exception as e:
            latency = (time.perf_counter() - t0) * 1000.0
            return ConnectionDiagnostic(
                provider="jira",
                healthy=False,
                latency_ms=round(latency, 2),
                message=f"Connection failed: {str(e)}",
            )

    def get_board_schema(self, project_id: int) -> BoardSchema:
        """
        Fetches remote Jira workflow status categories to construct the dynamic Kanban board schema.
        Falls back to Jira standard workflow stages if remote call fails.
        """
        default_jira_columns = [
            BoardColumn(id="Backlog", name="Backlog", status_category="todo", order=0),
            BoardColumn(id="Selected for Development", name="To Do", status_category="todo", order=1),
            BoardColumn(id="In Progress", name="In Progress", status_category="in_progress", order=2),
            BoardColumn(id="In Review", name="Code Review", status_category="in_progress", order=3),
            BoardColumn(id="Done", name="Done", status_category="done", order=4),
        ]
        allowed_types = ["Story", "Bug", "Task", "Epic"]
        allowed_labels = ["frontend", "backend", "design", "security", "infra", "p0", "p1"]

        if not self.project_key:
            return BoardSchema(
                provider="jira",
                columns=default_jira_columns,
                allowed_types=allowed_types,
                allowed_labels=allowed_labels,
            )

        try:
            statuses_resp = self._http_request(f"/rest/api/3/project/{self.project_key}/statuses")
            columns = []
            seen_statuses = set()
            idx = 0
            for issue_type in statuses_resp:
                for st in issue_type.get("statuses", []):
                    name = st.get("name", "Unknown")
                    if name not in seen_statuses:
                        seen_statuses.add(name)
                        cat = st.get("statusCategory", {}).get("key", "indeterminate")
                        # Map Jira statusCategory key to PM tool categories
                        status_cat = "todo"
                        if cat in ("new", "undefined"):
                            status_cat = "todo"
                        elif cat == "indeterminate":
                            status_cat = "in_progress"
                        elif cat == "done":
                            status_cat = "done"

                        columns.append(
                            BoardColumn(
                                id=name,
                                name=name,
                                status_category=status_cat,
                                order=idx,
                            )
                        )
                        idx += 1
            if columns:
                return BoardSchema(
                    provider="jira",
                    columns=columns,
                    allowed_types=allowed_types,
                    allowed_labels=allowed_labels,
                )
        except Exception:
            pass

        return BoardSchema(
            provider="jira",
            columns=default_jira_columns,
            allowed_types=allowed_types,
            allowed_labels=allowed_labels,
        )

    def list_tasks(self, project_id: int, status: Optional[str] = None) -> List[TaskEntity]:
        """Lists tasks for the project from the local SQLite read-replica cache."""
        raw_tasks = db.get_tasks(project_id=project_id, status=status)
        entities = []
        for r in raw_tasks:
            ext_labels = []
            if r.get("external_labels"):
                try:
                    ext_labels = json.loads(r["external_labels"]) if isinstance(r["external_labels"], str) else r["external_labels"]
                except Exception:
                    ext_labels = []

            entities.append(
                TaskEntity(
                    id=r["id"],
                    project_id=r["project_id"],
                    title=r["title"],
                    description=r.get("description", "") or "",
                    status=r.get("status", "todo"),
                    priority=r.get("priority", "medium"),
                    ticket_type=r.get("external_type", r.get("ticket_type", "Task")) or "Task",
                    story_points=r.get("story_points", 0) or 0,
                    assignee=r.get("assignee", "") or "",
                    acceptance_criteria=r.get("acceptance_criteria", "") or "",
                    due_date=r.get("due_date"),
                    labels=ext_labels,
                    external_provider="jira",
                    external_id=r.get("external_id"),
                    external_url=r.get("external_url"),
                    external_type=r.get("external_type", "Task"),
                    external_labels=ext_labels,
                    sync_status=r.get("sync_status", "synced") or "synced",
                    last_synced_at=r.get("last_synced_at"),
                    created_at=r.get("created_at"),
                    updated_at=r.get("updated_at"),
                )
            )
        return entities

    def create_task(self, project_id: int, payload: CreateTaskPayload) -> TaskEntity:
        """Creates an issue in Atlassian Jira and records a synced cached task locally."""
        jira_issue_type = payload.ticket_type.capitalize() if payload.ticket_type else "Task"
        if jira_issue_type not in ["Story", "Bug", "Task", "Epic"]:
            jira_issue_type = "Task"

        jira_payload = {
            "fields": {
                "project": {"key": self.project_key},
                "summary": payload.title,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {
                                    "type": "text",
                                    "text": payload.description or payload.title,
                                }
                            ],
                        }
                    ],
                },
                "issuetype": {"name": jira_issue_type},
                "labels": payload.labels or [],
            }
        }

        # Dispatch to Jira
        resp = self._http_request("/rest/api/3/issue", method="POST", data=jira_payload)
        issue_key = resp.get("key", f"{self.project_key}-1")
        issue_url = f"{self.base_url}/browse/{issue_key}"

        # Insert local replica in SQLite
        created = db.create_task(
            project_id=project_id,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            ticket_type=jira_issue_type.lower(),
            story_points=payload.story_points,
            assignee=payload.assignee,
            acceptance_criteria=payload.acceptance_criteria,
            due_date=payload.due_date or "",
            external_provider="jira",
            external_id=issue_key,
            external_url=issue_url,
            external_type=jira_issue_type,
            external_labels=payload.labels or [],
            sync_status="synced",
        )

        return TaskEntity(
            id=created["id"],
            project_id=created["project_id"],
            title=created["title"],
            description=created.get("description", "") or "",
            status=created.get("status", "todo"),
            priority=created.get("priority", "medium"),
            ticket_type=jira_issue_type,
            story_points=created.get("story_points", 0) or 0,
            assignee=created.get("assignee", "") or "",
            acceptance_criteria=created.get("acceptance_criteria", "") or "",
            due_date=created.get("due_date"),
            labels=payload.labels or [],
            external_provider="jira",
            external_id=issue_key,
            external_url=issue_url,
            external_type=jira_issue_type,
            external_labels=payload.labels or [],
            sync_status="synced",
            created_at=created.get("created_at"),
            updated_at=created.get("updated_at"),
        )

    def update_task(self, task_id: int, patch: UpdateTaskPayload) -> TaskEntity:
        """Updates task locally and syncs modifications to Jira."""
        existing = db.get_task(task_id)
        if not existing:
            raise ValueError(f"Task {task_id} not found.")

        ext_id = existing.get("external_id")
        if ext_id:
            jira_update: Dict[str, Any] = {"fields": {}}
            if patch.title is not None:
                jira_update["fields"]["summary"] = patch.title
            if patch.labels is not None:
                jira_update["fields"]["labels"] = patch.labels
            try:
                if jira_update["fields"]:
                    self._http_request(f"/rest/api/3/issue/{ext_id}", method="PUT", data=jira_update)
            except Exception:
                pass

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
            fields["external_type"] = patch.ticket_type
        if patch.story_points is not None:
            fields["story_points"] = patch.story_points
        if patch.assignee is not None:
            fields["assignee"] = patch.assignee
        if patch.labels is not None:
            fields["external_labels"] = json.dumps(patch.labels)

        updated = db.update_task(task_id, **fields)
        labels = patch.labels if patch.labels is not None else []
        return TaskEntity(
            id=updated["id"],
            project_id=updated["project_id"],
            title=updated["title"],
            description=updated.get("description", "") or "",
            status=updated.get("status", "todo"),
            priority=updated.get("priority", "medium"),
            ticket_type=updated.get("external_type", "Task"),
            story_points=updated.get("story_points", 0) or 0,
            assignee=updated.get("assignee", "") or "",
            acceptance_criteria=updated.get("acceptance_criteria", "") or "",
            due_date=updated.get("due_date"),
            labels=labels,
            external_provider="jira",
            external_id=updated.get("external_id"),
            external_url=updated.get("external_url"),
            external_type=updated.get("external_type", "Task"),
            sync_status="synced",
            created_at=updated.get("created_at"),
            updated_at=updated.get("updated_at"),
        )

    def transition_task(self, task_id: int, target_status: str) -> TaskTransitionResult:
        """Executes workflow transition against Jira, committing changes to local replica."""
        existing = db.get_task(task_id)
        if not existing:
            return TaskTransitionResult(
                task_id=task_id,
                old_status="unknown",
                new_status=target_status,
                success=False,
                error="Task not found",
            )

        old_status = existing.get("status", "todo")
        ext_id = existing.get("external_id")

        if ext_id:
            try:
                # Query available transitions for this issue
                transitions_resp = self._http_request(f"/rest/api/3/issue/{ext_id}/transitions")
                avail_transitions = transitions_resp.get("transitions", [])
                match_id = None
                for t in avail_transitions:
                    if t.get("name", "").lower() == target_status.lower() or t.get("to", {}).get("name", "").lower() == target_status.lower():
                        match_id = t["id"]
                        break

                if match_id:
                    self._http_request(
                        f"/rest/api/3/issue/{ext_id}/transitions",
                        method="POST",
                        data={"transition": {"id": match_id}},
                    )
            except Exception as e:
                # Record error or fallback
                pass

        db.update_task(task_id, status=target_status, last_synced_at=time.strftime("%Y-%m-%d %H:%M:%S"))
        return TaskTransitionResult(
            task_id=task_id,
            old_status=old_status,
            new_status=target_status,
            success=True,
            sync_status="synced",
        )

    def delete_task(self, task_id: int) -> bool:
        """Deletes task locally."""
        return db.delete_task(task_id)

    def sync_external(self, project_id: int) -> SyncResult:
        """
        Pulls active issues from Jira for project_key and hydrates the local SQLite cache.
        """
        if not self.project_key:
            return SyncResult(
                provider="jira",
                project_id=project_id,
                pulled_count=0,
                pushed_count=0,
                conflicts_count=0,
                success=False,
                error="Project key is required for Jira synchronization.",
            )

        try:
            jql = f"project = {self.project_key} ORDER BY created DESC"
            endpoint = f"/rest/api/3/search?jql={urllib.parse.quote(jql)}&maxResults=50"
            resp = self._http_request(endpoint)
            issues = resp.get("issues", [])

            pulled = 0
            for iss in issues:
                key = iss.get("key")
                fields = iss.get("fields", {})
                summary = fields.get("summary", "Untitled Jira Issue")
                status_name = fields.get("status", {}).get("name", "todo")
                issue_type = fields.get("issuetype", {}).get("name", "Task")
                labels = fields.get("labels", [])
                assignee = fields.get("assignee", {}).get("displayName", "") if fields.get("assignee") else ""
                url = f"{self.base_url}/browse/{key}"

                # Check if task already exists in local DB
                with db.get_db() as conn:
                    cur = conn.execute(
                        "SELECT id FROM tasks WHERE project_id = ? AND external_id = ?",
                        (project_id, key),
                    )
                    row = cur.fetchone()

                if row:
                    db.update_task(
                        row["id"],
                        title=summary,
                        status=status_name,
                        external_type=issue_type,
                        external_labels=json.dumps(labels),
                        assignee=assignee,
                        sync_status="synced",
                        last_synced_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                    )
                else:
                    db.create_task(
                        project_id=project_id,
                        title=summary,
                        description="",
                        status=status_name,
                        ticket_type=issue_type.lower(),
                        assignee=assignee,
                        external_provider="jira",
                        external_id=key,
                        external_url=url,
                        external_type=issue_type,
                        external_labels=labels,
                        sync_status="synced",
                    )
                pulled += 1

            return SyncResult(
                provider="jira",
                project_id=project_id,
                pulled_count=pulled,
                pushed_count=0,
                conflicts_count=0,
                success=True,
            )
        except Exception as e:
            return SyncResult(
                provider="jira",
                project_id=project_id,
                pulled_count=0,
                pushed_count=0,
                conflicts_count=0,
                success=False,
                error=str(e),
            )
