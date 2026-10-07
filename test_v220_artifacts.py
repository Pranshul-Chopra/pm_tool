"""
PM Tool v2.2.0 Automated Verification Suite:
Validates dedicated artifacts.db, FTS5 search, version snapshots,
chat promotion, and REST API endpoints.
"""

import os
import json
import sqlite3
from pathlib import Path
import main
import artifacts_db
import db
import ai_db

def run_tests():
    print("=" * 60)
    print("PM Tool v2.2.0 Verification: Artifacts & Onboarding")
    print("=" * 60)

    # 1. Three-Database Segregation Verification
    print("\n[1/5] Verifying 3-Database Architectural Segregation...")
    pm_path = db.DB_PATH
    ai_path = ai_db.AI_DB_PATH
    art_path = artifacts_db.ARTIFACTS_DB_PATH

    print(f"  pmtool.db:     {pm_path}")
    print(f"  ai_context.db: {ai_path}")
    print(f"  artifacts.db:  {art_path}")

    assert pm_path != art_path, "pmtool.db and artifacts.db must be distinct files!"
    assert ai_path != art_path, "ai_context.db and artifacts.db must be distinct files!"
    print("  [OK] Strict database file separation confirmed.")

    # 2. artifacts.db Schema & Table Verification
    print("\n[2/5] Verifying artifacts.db Schema & Tables...")
    artifacts_db.init_artifacts_db()
    with artifacts_db.get_artifacts_db() as conn:
        tables = [r["name"] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        print(f"  Tables found in artifacts.db: {tables}")
        assert "artifacts" in tables
        assert "artifact_versions" in tables
    print("  [OK] artifacts and artifact_versions tables verified.")

    # 3. Direct DB CRUD, Versions, and FTS5 Verification
    print("\n[3/5] Verifying CRUD, Word Counting, FTS5 & Snapshot Reversion...")
    test_doc = artifacts_db.create_artifact(
        title="Payment Gateway Integration RFC",
        content="# Payment Gateway RFC\n\nDetailed technical specifications for Stripe and PayPal webhooks.",
        doc_type="rfc",
        tags=["fintech", "payments"],
        summary="Payment infrastructure RFC"
    )
    doc_id = test_doc["id"]
    print(f"  Created document id={doc_id}, uuid={test_doc['uuid']}, words={test_doc['word_count']}")
    assert test_doc["word_count"] > 5

    # Update with version snapshot
    updated_doc = artifacts_db.update_artifact(
        doc_id,
        content="# Payment Gateway RFC\n\nUpdated with idempotent webhook replay defense and signature validation.",
        create_version=True,
        version_summary="Added webhook replay protection"
    )
    assert updated_doc["word_count"] > 10

    # Versions list
    versions = artifacts_db.list_artifact_versions(doc_id)
    print(f"  Recorded {len(versions)} revision snapshots.")
    assert len(versions) == 2

    # FTS5 search
    fts_results = artifacts_db.list_artifacts(search="idempotent")
    print(f"  FTS5 search for 'idempotent' matched: {len(fts_results)} doc(s)")
    assert len(fts_results) >= 1

    # Pin toggle
    pinned_doc = artifacts_db.toggle_pin_artifact(doc_id)
    assert pinned_doc["is_pinned"] is True
    print("  [OK] Pin toggling verified.")

    # Restore Version 1
    reverted_doc = artifacts_db.restore_artifact_version(doc_id, 1)
    assert "Stripe and PayPal" in reverted_doc["content"]
    print("  [OK] Historical revision snapshot reversion verified.")

    # 4. REST API Endpoints Verification via Flask Test Client
    print("\n[4/5] Testing REST API Endpoints...")
    app = main.create_app()
    client = app.test_client()

    # GET /api/artifacts
    res = client.get("/api/artifacts")
    assert res.status_code == 200
    data = res.get_json()
    assert "artifacts" in data
    assert "stats" in data
    print(f"  GET /api/artifacts: {data['count']} docs, stats={data['stats']}")

    # POST /api/artifacts/from-chat (Copilot promotion)
    res = client.post("/api/artifacts/from-chat", json={
        "content": "# Unified Authentication Architecture PRD\n\nRequirements for OAuth 2.0 PKCE and multi-factor authentication."
    })
    assert res.status_code == 201
    chat_doc = res.get_json()["artifact"]
    print(f"  POST /api/artifacts/from-chat: {chat_doc['doc_type'].upper()} '{chat_doc['title']}' created.")
    assert chat_doc["doc_type"] == "prd"
    assert "Authentication" in chat_doc["title"]

    # Export formats
    for fmt in ["docx", "markdown", "html"]:
        res_exp = client.get(f"/api/artifacts/{chat_doc['id']}/export/{fmt}")
        assert res_exp.status_code == 200, f"Export as {fmt} failed with {res_exp.status_code}"
        assert len(res_exp.data) > 0
        print(f"  [OK] Export as {fmt.upper()} generated {len(res_exp.data)} bytes.")

    # 5. Cleanup
    print("\n[5/5] Cleaning Up Test Records...")
    artifacts_db.delete_artifact(doc_id)
    artifacts_db.delete_artifact(chat_doc["id"])
    print("  [OK] Cleanup complete.")

    print("\n" + "=" * 60)
    print("ALL v2.2.0 ARTIFACTS & DATABASE TESTS PASSED SUCCESSFULLY! [OK]")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
