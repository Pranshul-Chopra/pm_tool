# ── test_v225_outposts.py ─────────────────────────────────────────────────────
# Automated verification suite for PM Tool v2.2.5 ("Outpost & Nexus").
# Tests Hexagonal Ports, SSRF Security Perimeters, Snapshot Rollbacks, and Adapters.

import json
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

import db
import artifacts_db
from ports.ticket_tracker import (
    BoardColumn,
    BoardSchema,
    TaskEntity,
    CreateTaskPayload,
    UpdateTaskPayload,
    TicketTrackerPort,
)
from ports.document_repo import (
    DocumentEntity,
    DocumentRepositoryPort,
)
from ports.knowledge_source import KnowledgeSourcePort
from adapters.local_ticket_adapter import LocalTicketAdapter
from adapters.local_artifacts_adapter import LocalArtifactsAdapter
from adapters.local_disk_rag_adapter import LocalDiskRAGAdapter
from adapters.jira_ticket_adapter import JiraTicketAdapter
from adapters.notion_document_adapter import NotionDocumentAdapter
from adapters.gdocs_document_adapter import GDocsDocumentAdapter
from tools.outposts.security import (
    validate_outpost_url,
    encrypt_token,
    decrypt_token,
    mask_token,
)
from tools.outposts.snapshot import (
    create_pre_sync_snapshot,
    restore_pre_sync_snapshot,
    list_snapshots,
)


class TestV225Outposts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.init_db()
        artifacts_db.init_artifacts_db()

    def test_01_database_schema_v8_and_outpost_vault(self):
        """Verify schema version 8, outpost_configs, and transaction tables."""
        with db.get_db() as conn:
            cur = conn.execute("SELECT MAX(version) FROM schema_version")
            ver = cur.fetchone()[0]
            self.assertGreaterEqual(ver, 8, "Schema version must be at least 8.")

            # Test outpost_configs CRUD
            db.set_outpost_config(
                provider="jira",
                base_url="https://acme-corp.atlassian.net",
                auth_token="test_token_secret_12345",
                user_email="pm@acme.com",
                project_key="ACME",
                is_active=1,
            )
            cfg = db.get_outpost_config("jira")
            self.assertIsNotNone(cfg)
            self.assertEqual(cfg["project_key"], "ACME")
            self.assertEqual(cfg["base_url"], "https://acme-corp.atlassian.net")

            all_cfgs = db.get_all_outpost_configs()
            self.assertTrue(any(c["provider"] == "jira" for c in all_cfgs))

    def test_02_ssrf_security_defenses(self):
        """Test strict SSRF blocking against loopbacks, metadata IPs, and RFC 1918."""
        # Loopback
        safe, msg = validate_outpost_url("http://127.0.0.1:8080")
        self.assertFalse(safe, "Loopback HTTP must be blocked")

        safe, msg = validate_outpost_url("https://localhost/api")
        self.assertFalse(safe, "Localhost must be blocked")

        # Cloud metadata IP
        safe, msg = validate_outpost_url("https://169.254.169.254/latest/meta-data/")
        self.assertFalse(safe, "Cloud metadata IP 169.254.169.254 must be blocked")

        # CRLF injection
        safe, msg = validate_outpost_url("https://safe.atlassian.net\r\nInjected-Header: evil")
        self.assertFalse(safe, "CRLF must be blocked")

        # Insecure protocol
        safe, msg = validate_outpost_url("http://myorg.atlassian.net")
        self.assertFalse(safe, "Plain http must be rejected in production")

        # Valid public HTTPS Jira URL
        safe, msg = validate_outpost_url("https://jira.atlassian.com", provider="jira")
        self.assertTrue(safe, f"Valid Jira URL should pass: {msg}")

    def test_03_credential_encryption_and_masking(self):
        """Test PBKDF2 keystream encryption and UI masking."""
        raw = "atlassian_api_token_secret_998877"
        enc = encrypt_token(raw)
        self.assertTrue(enc.startswith("enc_v1:"), "Ciphertext must have enc_v1 prefix")
        dec = decrypt_token(enc)
        self.assertEqual(raw, dec, "Decrypted token must match original")

        masked = mask_token(raw)
        self.assertTrue(masked.startswith("••••••••••••"), "Masked token must obscure secret")
        self.assertTrue(masked.endswith("8877"), "Masked token must preserve last 4 chars")

    def test_04_hexagonal_port_contract_parity(self):
        """Verify LocalTicketAdapter implements all TicketTrackerPort methods."""
        adapter = LocalTicketAdapter()
        self.assertIsInstance(adapter, TicketTrackerPort)

        # Create project
        proj = db.create_project(name="Hexagonal Test Initiative", domain="Fintech")
        proj_id = proj["id"]

        # Board schema
        schema = adapter.get_board_schema(proj_id)
        self.assertEqual(schema.provider, "local")
        self.assertEqual(len(schema.columns), 4)

        # Create task
        payload = CreateTaskPayload(
            title="Implement Transaction Signing Port",
            description="Secure local transaction signing",
            priority="high",
            ticket_type="story",
            story_points=5,
            labels=["security", "backend"],
        )
        task = adapter.create_task(proj_id, payload)
        self.assertIsInstance(task, TaskEntity)
        self.assertEqual(task.story_points, 5)

        # Transition task
        trans_res = adapter.transition_task(task.id, "in_progress")
        self.assertTrue(trans_res.success)
        self.assertEqual(trans_res.new_status, "in_progress")

        # List tasks
        tasks = adapter.list_tasks(proj_id)
        self.assertGreaterEqual(len(tasks), 1)

        # Clean up task
        adapter.delete_task(task.id)

    def test_05_pre_sync_safety_snapshot_and_rollback(self):
        """Verify pre-sync safety backup snapshot creation, task clearing, and atomic restore."""
        proj = db.create_project(name="Snapshot Test Workspace", domain="Core")
        proj_id = proj["id"]

        # Seed local tasks
        t1 = db.create_task(project_id=proj_id, title="Pre-sync Task 1", status="todo", story_points=3)
        t2 = db.create_task(project_id=proj_id, title="Pre-sync Task 2", status="in_progress", story_points=5)

        # Execute pre-sync snapshot
        snap = create_pre_sync_snapshot(project_id=proj_id, provider="jira")
        self.assertTrue(snap["success"])
        self.assertEqual(snap["task_count"], 2)
        self.assertTrue(os.path.exists(snap["snapshot_path"]))

        # Verify active board is cleared (tasks archived)
        active_tasks = db.get_tasks(project_id=proj_id, status="todo")
        self.assertEqual(len(active_tasks), 0, "Active board tasks should be archived.")

        # Simulate Jira adding a remote task
        db.create_task(
            project_id=proj_id,
            title="Imported Jira Task",
            external_provider="jira",
            external_id="PROJ-101",
            status="todo",
        )

        # Now test 1-Click Restore Snapshot
        restore_res = restore_pre_sync_snapshot(project_id=proj_id, snapshot_path=snap["snapshot_path"])
        self.assertTrue(restore_res["success"])
        self.assertEqual(restore_res["restored_count"], 2)

        # Verify restored board
        current_tasks = db.get_tasks(project_id=proj_id)
        titles = [t["title"] for t in current_tasks]
        self.assertIn("Pre-sync Task 1", titles)
        self.assertIn("Pre-sync Task 2", titles)
        self.assertNotIn("Imported Jira Task", titles, "Remote tasks should be purged on snapshot restore")

    def test_06_local_artifacts_and_disk_rag_adapters(self):
        """Verify DocumentRepositoryPort and KnowledgeSourcePort implementations."""
        doc_adapter = LocalArtifactsAdapter()
        self.assertIsInstance(doc_adapter, DocumentRepositoryPort)

        rag_adapter = LocalDiskRAGAdapter()
        self.assertIsInstance(rag_adapter, KnowledgeSourcePort)

        # Save document
        doc = doc_adapter.save_document(
            doc_id=None,
            title="Outpost Architecture Specification",
            content="# Outposts & Nexus\nHexagonal architecture verified.",
            doc_type="rfc",
            tags=["architecture", "v2.2.5"],
            summary="Specifying ports & adapters",
        )
        self.assertIsInstance(doc, DocumentEntity)
        self.assertEqual(doc.doc_type, "rfc")

        # Snapshot version
        rev = doc_adapter.publish_revision(doc.id, summary="Snapshot v2")
        self.assertEqual(rev.version_num, 2)

        # Test diagnostic
        diag = rag_adapter.test_connection({})
        self.assertTrue(diag.healthy)
        self.assertEqual(diag.provider, "disk")

        # Clean up doc
        doc_adapter.delete_document(doc.id)

    @patch("adapters.jira_ticket_adapter.JiraTicketAdapter._http_request")
    def test_07_mocked_jira_outpost_adapter(self, mock_http):
        """Verify JiraTicketAdapter methods with mocked Atlassian Cloud responses."""
        # 1. Test connection
        mock_http.return_value = {
            "accountId": "jira-acc-123",
            "displayName": "Alex Product Lead",
            "emailAddress": "alex@acme.com",
            "active": True,
        }
        jira = JiraTicketAdapter(
            base_url="https://acme.atlassian.net",
            user_email="alex@acme.com",
            auth_token="dummy_token",
            project_key="ACME",
            allow_localhost=True,
        )
        diag = jira.test_connection()
        self.assertTrue(diag.healthy)
        self.assertIn("Alex Product Lead", diag.message)

        # 2. Board schema
        mock_http.return_value = [
            {
                "statuses": [
                    {"name": "Backlog", "statusCategory": {"key": "new"}},
                    {"name": "In Development", "statusCategory": {"key": "indeterminate"}},
                    {"name": "Shipped", "statusCategory": {"key": "done"}},
                ]
            }
        ]
        schema = jira.get_board_schema(project_id=1)
        self.assertEqual(schema.provider, "jira")
        self.assertEqual(len(schema.columns), 3)

        # 3. Create issue
        mock_http.return_value = {"id": "10001", "key": "ACME-42"}
        proj = db.create_project(name="Jira Adapter Test", domain="Web")
        created_entity = jira.create_task(
            project_id=proj["id"],
            payload=CreateTaskPayload(title="Fix Jira Outbound Webhook", ticket_type="bug"),
        )
        self.assertEqual(created_entity.external_id, "ACME-42")
        self.assertEqual(created_entity.external_provider, "jira")


if __name__ == "__main__":
    print("=" * 60)
    print("PM Tool v2.2.5 Verification: Outposts, Hexagonal Ports & SSRF")
    print("=" * 60)
    unittest.main(verbosity=2)
