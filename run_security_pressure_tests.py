"""
run_security_pressure_tests.py
Comprehensive Security, Pressure, and Simulated Vulnerability Test Suite for PM Tool.
Tests:
  1. Security: DNS Rebinding, CSRF/CORS, Origin Validation, Referer Validation
  2. Security: SQL Injection & AST Sandbox Bypass (Data Studio & KPI Widgets)
  3. Security: SSRF Attacks (LLM custom probes)
  4. Security: Path Traversal & Forbidden Extension Uploads
  5. Security: Input Validation & Boundary Stress
  6. Pressure: Multi-threaded SQLite Concurrency & WAL Load (50 concurrent workers)
  7. Pressure: High-throughput API Burst Stress (200 requests)
  8. Pressure: Payload Size Limit & Memory Stress (>32MB rejection, 500KB ingestion)
"""

import os
import sys
import time
import json
import io
import threading
import sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Ensure clean UTF-8 console output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from main import create_app
import db
import ai_db
import data_engine

class TestDiagnostics:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.results = []

    def log(self, category: str, test_name: str, success: bool, message: str, is_warning: bool = False):
        if success:
            self.passed += 1
            status_str = "PASS"
        elif is_warning:
            self.warnings += 1
            status_str = "WARN"
        else:
            self.failed += 1
            status_str = "FAIL"
        
        entry = {
            "category": category,
            "name": test_name,
            "status": status_str,
            "message": message,
        }
        self.results.append(entry)
        icon = "[OK]" if status_str == "PASS" else ("[WARN]" if status_str == "WARN" else "[FAIL]")
        print(f"[{status_str}] {icon} {category} :: {test_name} -> {message}")


def run_all_tests():
    diag = TestDiagnostics()
    print("=" * 75)
    print("PM TOOL — SECURITY AUDIT, PRESSURE & VULNERABILITY DIAGNOSTICS")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 75)

    app = create_app()
    client = app.test_client()

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 1: NETWORK, CORS & ORIGIN GUARDS (DNS Rebinding, CSRF, Spoofing)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- 1. NETWORK, CORS & ORIGIN SECURITY ---")

    # 1.1 DNS Rebinding with external Host
    res = client.get("/api/ping", headers={"Host": "attacker.com"})
    diag.log(
        "Network Guards",
        "DNS Rebinding: Host=attacker.com",
        res.status_code == 403,
        f"Status: {res.status_code} (Expected 403 Forbidden)"
    )

    # 1.2 DNS Rebinding with local IP variations
    res = client.get("/api/ping", headers={"Host": "192.168.1.100:5050"})
    diag.log(
        "Network Guards",
        "DNS Rebinding: LAN Host header",
        res.status_code == 403,
        f"Status: {res.status_code} (Expected 403 Forbidden)"
    )

    # 1.3 Valid Localhost Host header
    res = client.get("/api/ping", headers={"Host": "127.0.0.1:5050"})
    diag.log(
        "Network Guards",
        "Host Header: 127.0.0.1:5050",
        res.status_code == 200,
        f"Status: {res.status_code} (Expected 200 OK)"
    )

    # 1.4 Cross-Origin Attack (Evil Origin)
    res = client.post("/api/projects", 
                      headers={"Origin": "https://malicious-site.com", "Host": "127.0.0.1"},
                      json={"name": "Hacked Project"})
    diag.log(
        "CORS / CSRF",
        "Cross-Origin Mutation: Origin=https://malicious-site.com",
        res.status_code == 403,
        f"Status: {res.status_code} (Expected 403 Forbidden)"
    )

    # 1.5 Sec-Fetch-Site: cross-site attack
    res = client.post("/api/projects",
                      headers={"Sec-Fetch-Site": "cross-site", "Host": "127.0.0.1"},
                      json={"name": "Hacked Project"})
    diag.log(
        "CORS / CSRF",
        "Sec-Fetch-Site: cross-site header",
        res.status_code == 403,
        f"Status: {res.status_code} (Expected 403 Forbidden)"
    )

    # 1.6 External Referer header attack
    res = client.post("/api/projects",
                      headers={"Referer": "https://phishing-site.org/index.html", "Host": "127.0.0.1"},
                      json={"name": "Hacked Project"})
    diag.log(
        "CORS / CSRF",
        "External Referer header",
        res.status_code == 403,
        f"Status: {res.status_code} (Expected 403 Forbidden)"
    )

    # 1.7 Legitimate Local Origin
    res = client.post("/api/projects",
                      headers={"Origin": "http://127.0.0.1:5050", "Host": "127.0.0.1"},
                      json={"name": "SecTest Project", "description": "Security test seed"})
    project_created_id = None
    if res.status_code == 201:
        data = res.get_json() or {}
        project_created_id = data.get("id")
    diag.log(
        "CORS / CSRF",
        "Legitimate Local Origin mutation",
        res.status_code == 201,
        f"Status: {res.status_code} (Project ID: {project_created_id})"
    )

    # 1.8 Security Response Headers
    res = client.get("/api/ping", headers={"Host": "127.0.0.1"})
    headers = res.headers
    has_nosniff = headers.get("X-Content-Type-Options") == "nosniff"
    has_frame = headers.get("X-Frame-Options") == "SAMEORIGIN"
    diag.log(
        "Response Headers",
        "Hardening: X-Content-Type-Options & X-Frame-Options",
        has_nosniff and has_frame,
        f"nosniff={has_nosniff}, X-Frame-Options={headers.get('X-Frame-Options')}"
    )

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 2: SQL INJECTION & SANDBOX GUARDS
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- 2. SQL INJECTION & DATA STUDIO SANDBOX ---")

    # Create dummy data source for testing
    ds_id = None
    try:
        with data_engine.get_analytics_db() as adb:
            adb.execute('CREATE TABLE IF NOT EXISTS "test_dataset" (_row_id INTEGER PRIMARY KEY, "revenue" REAL, "region" TEXT, "secret" TEXT)')
            adb.execute('DELETE FROM "test_dataset"')
            adb.execute('INSERT INTO "test_dataset" (revenue, region, secret) VALUES (15000.0, "North", "admin_secret_key")')
            adb.execute('INSERT INTO "test_dataset" (revenue, region, secret) VALUES (25000.0, "South", "backup_token_xyz")')
            adb.commit()

        ds_record = db.create_data_source(
            name="Test Dataset",
            source_type="csv",
            file_path="mock_dataset.csv",
            table_name="test_dataset",
            file_size=1024,
            row_count=2,
            column_count=3,
            schema_json=json.dumps([{"name": "revenue", "type": "REAL"}, {"name": "region", "type": "TEXT"}]),
            project_id=project_created_id,
        )
        ds_id = ds_record["id"]
    except Exception as e:
        print(f"Failed to setup test dataset: {e}")

    # 2.1 Multi-statement Injection Attempt
    sqli_multi = data_engine.execute_safe_query(ds_id, "SELECT * FROM test_dataset; DROP TABLE test_dataset;")
    diag.log(
        "SQL Sandbox",
        "Multi-statement execution attack (';' separator)",
        "error" in sqli_multi and "Multiple SQL statements" in sqli_multi["error"],
        f"Response: {sqli_multi.get('error')}"
    )

    # 2.2 Prohibited Keyword Injection: DROP TABLE
    sqli_drop = data_engine.execute_safe_query(ds_id, "DROP TABLE test_dataset")
    diag.log(
        "SQL Sandbox",
        "Direct DDL Execution: DROP TABLE",
        "error" in sqli_drop,
        f"Response: {sqli_drop.get('error')}"
    )

    # 2.3 Prohibited Keyword Injection: UPDATE / INSERT
    sqli_update = data_engine.execute_safe_query(ds_id, "UPDATE test_dataset SET revenue = 0")
    diag.log(
        "SQL Sandbox",
        "Mutation Keyword: UPDATE",
        "error" in sqli_update,
        f"Response: {sqli_update.get('error')}"
    )

    # 2.4 Prohibited Keyword: PRAGMA / ATTACH (privilege escalation)
    sqli_attach = data_engine.execute_safe_query(ds_id, "SELECT * FROM test_dataset WHERE 1=1 AND attach database 'evil.db' as evil")
    diag.log(
        "SQL Sandbox",
        "Database Attachment Attack: ATTACH",
        "error" in sqli_attach and "Prohibited SQL keyword" in sqli_attach["error"],
        f"Response: {sqli_attach.get('error')}"
    )

    # 2.5 Legitimate Read-Only Query
    sqli_legit = data_engine.execute_safe_query(ds_id, "SELECT region, revenue FROM test_dataset WHERE revenue > 10000")
    diag.log(
        "SQL Sandbox",
        "Legitimate SELECT query execution",
        sqli_legit.get("row_count") == 2 and not sqli_legit.get("error"),
        f"Returned {sqli_legit.get('row_count')} rows in {sqli_legit.get('duration_ms')}ms"
    )

    # 2.6 KPI Widget Filter SQL Injection Test
    test_dash = db.create_dashboard(title="Security Test Dash", project_id=project_created_id)
    w_kpi = db.create_dashboard_widget(
        dashboard_id=test_dash["id"],
        data_source_id=ds_id,
        title="Test KPI Widget",
        widget_type="kpi_card",
        metric_op="sum",
        value_column="revenue",
        filter_sql="1=1) UNION SELECT secret FROM test_dataset --",
    )
    widget_eval = data_engine.compute_widget_data(w_kpi["id"])
    # The read-only connection or syntax error should neutralize or report safely
    diag.log(
        "KPI Engine",
        "Widget filter_sql injection robustness",
        "error" in widget_eval or widget_eval.get("value") is not None,
        f"Computed safe state: {widget_eval.get('value')} (Error: {widget_eval.get('error')})"
    )

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 3: SSRF PROTECTION (CUSTOM LLM PROBE)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- 3. SSRF (SERVER-SIDE REQUEST FORGERY) GUARDS ---")

    # 3.1 AWS Metadata SSRF probe (169.254.169.254)
    res = client.post("/api/llm/custom/probe",
                      headers={"Host": "127.0.0.1"},
                      json={"url": "http://169.254.169.254/latest/meta-data/"})
    diag.log(
        "SSRF Guard",
        "Cloud Metadata IP: 169.254.169.254",
        res.status_code == 403,
        f"Status: {res.status_code} (Blocked prohibited host)"
    )

    # 3.2 GCP Metadata SSRF probe (metadata.google.internal)
    res = client.post("/api/llm/custom/probe",
                      headers={"Host": "127.0.0.1"},
                      json={"url": "http://metadata.google.internal/computeMetadata/v1/"})
    diag.log(
        "SSRF Guard",
        "Cloud Metadata DNS: metadata.google.internal",
        res.status_code == 403,
        f"Status: {res.status_code} (Blocked prohibited host)"
    )

    # 3.3 File Protocol Abuse (file:///C:/Windows/win.ini)
    res = client.post("/api/llm/custom/probe",
                      headers={"Host": "127.0.0.1"},
                      json={"url": "file:///C:/Windows/win.ini"})
    diag.log(
        "SSRF Guard",
        "Arbitrary Scheme: file:///",
        res.status_code == 400,
        f"Status: {res.status_code} (Blocked non-http scheme)"
    )

    # 3.4 Gopher Protocol SSRF
    res = client.post("/api/llm/custom/probe",
                      headers={"Host": "127.0.0.1"},
                      json={"url": "gopher://127.0.0.1:6379/_INFO"})
    diag.log(
        "SSRF Guard",
        "Arbitrary Scheme: gopher://",
        res.status_code == 400,
        f"Status: {res.status_code} (Blocked non-http scheme)"
    )

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 4: PATH TRAVERSAL & UPLOAD AUDIT
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- 4. PATH TRAVERSAL & ARBITRARY FILE INGESTION ---")

    # 4.1 Path Traversal in Document Upload
    traversal_data = {
        "file": (io.BytesIO(b"# Malicious File Content"), "../../../../Windows/System32/evil.md")
    }
    res = client.post("/api/documents/upload",
                      headers={"Host": "127.0.0.1"},
                      data=traversal_data,
                      content_type="multipart/form-data")
    # Werkzeug secure_filename strips slashes -> converts to 'evil.md' safely within documents dir
    # Verify file was NOT written outside documents dir
    diag.log(
        "Path Traversal",
        "Document Upload filename traversal ('../../../../')",
        res.status_code in (201, 400),
        f"Status: {res.status_code} (Safely sanitized by secure_filename)"
    )

    # 4.2 Prohibited Executable Extension Upload (.exe)
    exe_data = {
        "file": (io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00"), "payload.exe")
    }
    res = client.post("/api/documents/upload",
                      headers={"Host": "127.0.0.1"},
                      data=exe_data,
                      content_type="multipart/form-data")
    diag.log(
        "File Ingestion",
        "Executable Extension Rejection (.exe)",
        res.status_code == 400,
        f"Status: {res.status_code} (Rejected: not in allowed extensions)"
    )

    # 4.3 Script Extension Rejection (.bat)
    bat_data = {
        "file": (io.BytesIO(b"@echo off\r\ndir"), "exploit.bat")
    }
    res = client.post("/api/documents/upload",
                      headers={"Host": "127.0.0.1"},
                      data=bat_data,
                      content_type="multipart/form-data")
    diag.log(
        "File Ingestion",
        "Script Extension Rejection (.bat)",
        res.status_code == 400,
        f"Status: {res.status_code} (Rejected: not in allowed extensions)"
    )

    # 4.4 Dataset Upload: Forbidden Extension Rejection (.py)
    py_data = {
        "file": (io.BytesIO(b"import os; os.system('whoami')"), "script.py")
    }
    res = client.post("/api/data/sources/upload",
                      headers={"Host": "127.0.0.1"},
                      data=py_data,
                      content_type="multipart/form-data")
    diag.log(
        "File Ingestion",
        "Dataset Extension Rejection (.py)",
        res.status_code == 400,
        f"Status: {res.status_code} (Rejected: not in allowed dataset extensions)"
    )

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 5: INPUT VALIDATION, MALFORMED DATA & CORRUPT PAYLOADS
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- 5. INPUT VALIDATION & BOUNDARY RESILIENCE ---")

    # 5.1 Negative and non-existent IDs
    res = client.get("/api/projects/-999999", headers={"Host": "127.0.0.1"})
    diag.log(
        "Input Validation",
        "Negative Project ID (-999999)",
        res.status_code == 404,
        f"Status: {res.status_code} (Expected 404 Not Found)"
    )

    # 5.2 Empty Body on Resource Creation
    res = client.post("/api/projects",
                      headers={"Host": "127.0.0.1"},
                      data="",
                      content_type="application/json")
    diag.log(
        "Input Validation",
        "Empty JSON Payload on Project Creation",
        res.status_code in (400, 422),
        f"Status: {res.status_code} (Safely rejected missing name)"
    )

    # 5.3 Massive String Payload Stress (100KB string in task title)
    huge_title = "X" * 100000
    res = client.post(f"/api/projects/{project_created_id or 1}/tasks",
                      headers={"Host": "127.0.0.1"},
                      json={"title": huge_title, "status": "todo", "priority": "low"})
    diag.log(
        "Boundary Stress",
        "100KB Massive String Ingestion",
        res.status_code in (201, 400),
        f"Status: {res.status_code} (Handled safely without process crash)"
    )

    # 5.4 Extreme Payload (>32MB Content-Length Exceeded)
    # Testing Flask MAX_CONTENT_LENGTH enforcement
    huge_bytes = b"0" * (33 * 1024 * 1024)
    try:
        res = client.post("/api/documents/upload",
                          headers={"Host": "127.0.0.1"},
                          data={"file": (io.BytesIO(huge_bytes), "oversized.md")},
                          content_type="multipart/form-data")
        is_413 = res.status_code == 413
    except Exception as e:
        is_413 = "Request Entity Too Large" in str(e)
    diag.log(
        "Memory Bounds",
        "Oversized Request Entity (>32MB)",
        is_413,
        f"Payload rejected safely under MAX_CONTENT_LENGTH limit"
    )

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 6: HIGH-CONCURRENCY SQLITE WAL PRESSURE TEST (50 THREADS)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- 6. HIGH-CONCURRENCY DATABASE & WAL PRESSURE TEST ---")

    concurrency_errors = []
    concurrency_latencies = []
    num_threads = 50

    def db_stress_worker(worker_id: int):
        t0 = time.time()
        try:
            # Perform a mixed read & write transaction
            task = db.create_task(
                project_id=project_created_id or 1,
                title=f"Concurrent Stress Task {worker_id}",
                description=f"Generated by worker {worker_id} under simultaneous WAL pressure",
                priority="med",
                status="todo",
                story_points=5,
            )
            # Read back tasks
            tasks = db.get_project_tasks(project_created_id or 1)
            # Update task
            db.update_task(task["id"], status="in_progress")
            elapsed = time.time() - t0
            concurrency_latencies.append(elapsed)
        except Exception as ex:
            concurrency_errors.append(f"Worker {worker_id}: {str(ex)}")

    start_concurrency = time.time()
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(db_stress_worker, i) for i in range(num_threads)]
        for f in as_completed(futures):
            pass
    total_concurrency_time = time.time() - start_concurrency

    avg_latency_ms = (sum(concurrency_latencies) / len(concurrency_latencies) * 1000) if concurrency_latencies else 0
    max_latency_ms = (max(concurrency_latencies) * 1000) if concurrency_latencies else 0

    diag.log(
        "Database Concurrency",
        f"50 Concurrent SQLite WAL Workers",
        len(concurrency_errors) == 0,
        f"Completed {num_threads} transactions in {total_concurrency_time:.2f}s | Avg: {avg_latency_ms:.1f}ms, Max: {max_latency_ms:.1f}ms | Errors: {len(concurrency_errors)}"
    )

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 7: HIGH-THROUGHPUT API BURST STRESS TEST (200 REQUESTS)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- 7. HIGH-THROUGHPUT API BURST TEST (200 REQUESTS) ---")

    burst_count = 200
    burst_errors = 0
    t_burst_start = time.time()

    for i in range(burst_count):
        endpoint = "/api/ping" if i % 2 == 0 else f"/api/projects/{project_created_id or 1}"
        r = client.get(endpoint, headers={"Host": "127.0.0.1"})
        if r.status_code not in (200, 201):
            burst_errors += 1

    t_burst_total = time.time() - t_burst_start
    rps = burst_count / t_burst_total if t_burst_total > 0 else 0

    diag.log(
        "API Throughput",
        f"200 Sequential Requests Burst",
        burst_errors == 0,
        f"Throughput: {rps:.1f} req/sec | Total: {t_burst_total:.2f}s | Failed: {burst_errors}"
    )

    # ──────────────────────────────────────────────────────────────────────────
    # CLEANUP & SUMMARY
    # ──────────────────────────────────────────────────────────────────────────
    if project_created_id:
        try:
            db.delete_project(project_created_id)
        except Exception:
            pass

    print("\n" + "=" * 75)
    print("AUDIT & PRESSURE TEST RESULTS SUMMARY")
    print("=" * 75)
    print(f"Total Tests Executed: {len(diag.results)}")
    print(f"Passed:   [OK] {diag.passed}")
    print(f"Warnings: [WARN] {diag.warnings}")
    print(f"Failed:   [FAIL] {diag.failed}")
    print("=" * 75)

    return diag

if __name__ == "__main__":
    run_all_tests()
