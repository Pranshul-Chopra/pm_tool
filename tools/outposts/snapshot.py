# ── tools/outposts/snapshot.py ────────────────────────────────────────────────
# Manages pre-sync safety snapshots and atomic board restores.
# Guarantees that local tasks are never permanently lost when an outpost dictates board state.

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional, Any

from db import get_db, get_tasks, get_project


def _backups_dir() -> Path:
    """Directory for safety backup snapshots."""
    base = os.getenv("LOCALAPPDATA") or str(Path.home() / ".pmtool")
    bdir = Path(base) / "PMTool" / "backups"
    bdir.mkdir(parents=True, exist_ok=True)
    return bdir


def create_pre_sync_snapshot(project_id: int, provider: str = "jira") -> Dict[str, Any]:
    """
    Serializes all current local tasks for a project into a JSON artifact before
    an external outpost dictates board state, then archives existing tasks.
    """
    project = get_project(project_id)
    if not project:
        raise ValueError(f"Project with ID {project_id} not found.")

    tasks = get_tasks(project_id=project_id)
    # Only snapshot tasks that were not previously archived
    active_tasks = [t for t in tasks if t.get("status") != "archived"]

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"pre_{provider}_sync_{project_id}_{timestamp}.json"
    filepath = _backups_dir() / filename

    snapshot_payload = {
        "version": "2.2.5",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "provider": provider,
        "project": {
            "id": project["id"],
            "name": project["name"],
            "domain": project.get("domain", ""),
        },
        "task_count": len(active_tasks),
        "tasks": active_tasks,
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(snapshot_payload, f, indent=2, default=str)

    # In db, mark active local tasks as 'archived' so the active board is clean
    with get_db() as conn:
        with conn:
            conn.execute(
                """
                UPDATE tasks
                SET status = 'archived', updated_at = CURRENT_TIMESTAMP
                WHERE project_id = ? AND status != 'archived'
                """,
                (project_id,),
            )
            conn.execute(
                """
                UPDATE projects
                SET is_outpost_dictated = 1,
                    outpost_provider = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (provider, project_id),
            )

    return {
        "success": True,
        "snapshot_path": str(filepath),
        "filename": filename,
        "task_count": len(active_tasks),
        "timestamp": timestamp,
    }


def restore_pre_sync_snapshot(project_id: int, snapshot_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Restores local tasks from a snapshot file, un-archives them,
    and removes synced external tasks.
    """
    target_file = None
    if snapshot_path and os.path.exists(snapshot_path):
        target_file = Path(snapshot_path)
    else:
        # Locate latest snapshot for this project
        candidates = list(_backups_dir().glob(f"pre_*_sync_{project_id}_*.json"))
        if candidates:
            candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            target_file = candidates[0]

    if not target_file or not target_file.exists():
        raise FileNotFoundError(f"No safety snapshot found for project {project_id}.")

    with open(target_file, "r", encoding="utf-8") as f:
        payload = json.load(f)

    tasks_to_restore = payload.get("tasks", [])

    with get_db() as conn:
        with conn:
            # 1. Remove external tasks imported by the outpost
            conn.execute(
                "DELETE FROM tasks WHERE project_id = ? AND external_provider IS NOT NULL",
                (project_id,),
            )
            # 2. Delete any existing archived tasks for this project that will be restored
            conn.execute(
                "DELETE FROM tasks WHERE project_id = ? AND status = 'archived'",
                (project_id,),
            )
            # 3. Restore all saved tasks
            for t in tasks_to_restore:
                conn.execute(
                    """
                    INSERT INTO tasks (
                        project_id, title, description, status, priority, due_date,
                        story_points, acceptance_criteria, assignee, ticket_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        project_id,
                        t.get("title", "Untitled"),
                        t.get("description", ""),
                        t.get("status", "todo"),
                        t.get("priority", "medium"),
                        t.get("due_date"),
                        t.get("story_points", 0),
                        t.get("acceptance_criteria", ""),
                        t.get("assignee", ""),
                        t.get("ticket_type", "task"),
                    ),
                )
            # 4. Reset project dictation state
            conn.execute(
                """
                UPDATE projects
                SET is_outpost_dictated = 0,
                    outpost_provider = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (project_id,),
            )

    return {
        "success": True,
        "restored_count": len(tasks_to_restore),
        "source_snapshot": target_file.name,
    }


def list_snapshots(project_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """List available safety snapshots on disk."""
    results = []
    pattern = f"pre_*_sync_{project_id}_*.json" if project_id else "pre_*_sync_*.json"
    for p in _backups_dir().glob(pattern):
        try:
            stat = p.stat()
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            results.append({
                "filename": p.name,
                "path": str(p),
                "provider": data.get("provider", "unknown"),
                "task_count": data.get("task_count", 0),
                "created_at": data.get("created_at"),
                "file_size": stat.st_size,
            })
        except Exception:
            continue
    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return results
