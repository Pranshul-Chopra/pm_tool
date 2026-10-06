# ── data_engine.py ─────────────────────────────────────────────────────────
# PM Tool — Data Studio & Analytical Engine
# Ingests tabular datasets (CSV, Excel, JSON, SQLite) into an internal queryable
# store, provides safe read-only SQL execution, and computes user-defined KPIs/charts.

import csv
import json
import os
import re
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import db

ALLOWED_DATASET_EXTENSIONS = {".csv", ".tsv", ".xlsx", ".xls", ".json", ".db", ".sqlite", ".sqlite3"}
DISALLOWED_SQL_KEYWORDS = {
    "insert", "update", "delete", "drop", "alter", "create", "replace",
    "attach", "detach", "truncate", "pragma", "vacuum", "exec", "execute",
    "union", "into", "load_extension"
}
ALLOWED_METRIC_OPS = {"COUNT", "SUM", "AVG", "MIN", "MAX"}


def _get_datasets_dir() -> Path:
    p = db._user_data_dir() / "datasets"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _get_analytics_db_path() -> Path:
    return _get_datasets_dir() / "analytics_store.db"


@contextmanager
def get_analytics_db(read_only: bool = False):
    """Context manager for analytics store SQLite connection."""
    db_path = _get_analytics_db_path()
    if read_only:
        if not db_path.exists():
            # Create if doesn't exist
            conn = sqlite3.connect(str(db_path))
            conn.close()
        uri = f"file:{db_path.as_posix()}?mode=ro"
        con = sqlite3.connect(uri, uri=True, timeout=5.0)
    else:
        con = sqlite3.connect(str(db_path), timeout=10.0)

    con.row_factory = sqlite3.Row
    try:
        yield con
    finally:
        con.close()


def _sanitize_ident(name: str) -> str:
    """Sanitize column or table identifier for safe SQLite identifiers."""
    clean = re.sub(r"[^a-zA-Z0-9_]+", "_", name.strip().lower()).strip("_")
    if not clean or clean[0].isdigit():
        clean = f"col_{clean}" if clean else "col"
    return clean[:48]


def _infer_type(values: List[str]) -> str:
    """Infer column SQLite affinity type from a sample of string values."""
    non_empty = [v.strip() for v in values if v is not None and str(v).strip() != ""]
    if not non_empty:
        return "TEXT"

    is_int = True
    is_real = True
    is_date = True

    date_pattern = re.compile(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$")

    for v in non_empty[:150]:
        if is_int:
            if not re.match(r"^-?\d+$", v):
                is_int = False
        if is_real:
            if not re.match(r"^-?\d+(?:\.\d+)?$", v):
                is_real = False
        if is_date:
            if not date_pattern.match(v):
                is_date = False

    if is_int:
        return "INTEGER"
    if is_real:
        return "REAL"
    if is_date:
        return "DATETIME"
    return "TEXT"


# ── File Ingestion Parsers ───────────────────────────────────────────────────

def _parse_csv_file(file_path: Path) -> Tuple[List[str], List[Dict[str, Any]]]:
    """Parse CSV or TSV file into header names and row dictionaries."""
    delimiter = "\t" if file_path.suffix.lower() == ".tsv" else ","
    rows = []
    headers = []

    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        # Sniff delimiter if standard csv
        first_chunk = f.read(4096)
        f.seek(0)
        if file_path.suffix.lower() != ".tsv":
            try:
                sniffer = csv.Sniffer()
                dialect = sniffer.sniff(first_chunk, delimiters=";,|\t,")
                delimiter = dialect.delimiter
            except Exception:
                delimiter = ","

        reader = csv.reader(f, delimiter=delimiter)
        raw_headers = next(reader, None)
        if not raw_headers:
            return [], []

        headers = [_sanitize_ident(h or f"col_{idx}") for idx, h in enumerate(raw_headers)]
        # Ensure header uniqueness
        seen = set()
        clean_headers = []
        for h in headers:
            base = h
            counter = 1
            while h in seen:
                h = f"{base}_{counter}"
                counter += 1
            seen.add(h)
            clean_headers.append(h)
        headers = clean_headers

        for r in reader:
            if not r or all(c.strip() == "" for c in r):
                continue
            row_dict = {}
            for idx, h in enumerate(headers):
                row_dict[h] = r[idx].strip() if idx < len(r) else ""
            rows.append(row_dict)

    return headers, rows


def _parse_excel_file(file_path: Path) -> Tuple[List[str], List[Dict[str, Any]]]:
    """Parse Excel workbook (.xlsx, .xls) using openpyxl."""
    wb = None
    try:
        import openpyxl
        wb = openpyxl.load_workbook(str(file_path), data_only=True, read_only=True)
        sheet = wb.active
        rows_iter = sheet.iter_rows(values_only=True)
        raw_headers = next(rows_iter, None)
        if not raw_headers:
            return [], []

        headers = [_sanitize_ident(str(h or f"col_{idx}")) for idx, h in enumerate(raw_headers)]
        seen = set()
        clean_headers = []
        for h in headers:
            base = h
            counter = 1
            while h in seen:
                h = f"{base}_{counter}"
                counter += 1
            seen.add(h)
            clean_headers.append(h)
        headers = clean_headers

        rows = []
        for row_vals in rows_iter:
            if not row_vals or all(v is None or str(v).strip() == "" for v in row_vals):
                continue
            row_dict = {}
            for idx, h in enumerate(headers):
                val = row_vals[idx] if idx < len(row_vals) else None
                row_dict[h] = str(val).strip() if val is not None else ""
            rows.append(row_dict)
        return headers, rows
    except Exception as e:
        raise ValueError(f"Failed to parse Excel workbook: {str(e)}")
    finally:
        if wb is not None:
            try:
                wb.close()
            except Exception:
                pass


def _parse_json_file(file_path: Path) -> Tuple[List[str], List[Dict[str, Any]]]:
    """Parse JSON dataset file."""
    data = json.loads(file_path.read_text(encoding="utf-8", errors="replace"))
    if isinstance(data, dict):
        # Find first list of dicts if nested
        for k, v in data.items():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                data = v
                break

    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        raise ValueError("JSON file must contain an array of objects/records.")

    raw_keys = list(data[0].keys())
    headers = [_sanitize_ident(k) for k in raw_keys]

    rows = []
    for item in data:
        if not isinstance(item, dict):
            continue
        row_dict = {}
        for raw_k, clean_k in zip(raw_keys, headers):
            val = item.get(raw_k, "")
            row_dict[clean_k] = str(val).strip() if val is not None else ""
        rows.append(row_dict)

    return headers, rows


# ── Ingestion & Materialization ──────────────────────────────────────────────

def ingest_data_source(
    file_path: str,
    name: str,
    project_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Ingest tabular file (CSV, Excel, JSON, SQLite) into queryable analytics store.
    Generates schema metadata, sample rows, and registers into pmtool.db data_sources.
    """
    src_file = Path(file_path).resolve()
    if not src_file.exists() or not src_file.is_file():
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = src_file.suffix.lower()
    if ext not in ALLOWED_DATASET_EXTENSIONS:
        raise ValueError(f"Unsupported dataset format '{ext}'. Supported: {', '.join(ALLOWED_DATASET_EXTENSIONS)}")

    file_size = src_file.stat().st_size
    clean_name = name.strip() or src_file.stem
    slug = _sanitize_ident(clean_name)
    timestamp = int(time.time())
    table_name = f"ds_{timestamp}_{slug}"[:48]

    headers = []
    rows = []

    # Ingest depending on file type
    if ext in (".csv", ".tsv"):
        headers, rows = _parse_csv_file(src_file)
    elif ext in (".xlsx", ".xls"):
        headers, rows = _parse_excel_file(src_file)
    elif ext == ".json":
        headers, rows = _parse_json_file(src_file)
    elif ext in (".db", ".sqlite", ".sqlite3"):
        # For existing SQLite databases, copy table or inspect
        return _ingest_sqlite_source(src_file, clean_name, project_id)

    if not headers or not rows:
        raise ValueError("Dataset is empty or could not be parsed into tabular rows.")

    # Infer column types & build column schema
    schema_list = []
    col_defs = []
    for h in headers:
        sample_vals = [r.get(h, "") for r in rows[:150]]
        inferred = _infer_type(sample_vals)
        col_defs.append(f'"{h}" {inferred}')

        distinct_samples = list(dict.fromkeys([v for v in sample_vals if v]))[:5]
        schema_list.append({
            "name": h,
            "type": inferred,
            "sample_values": distinct_samples,
        })

    # Materialize table in analytics_store.db
    create_sql = f'CREATE TABLE "{table_name}" (\n  _row_id INTEGER PRIMARY KEY AUTOINCREMENT,\n  ' + ",\n  ".join(col_defs) + "\n);"

    insert_cols = ", ".join(f'"{h}"' for h in headers)
    placeholders = ", ".join("?" for _ in headers)
    insert_sql = f'INSERT INTO "{table_name}" ({insert_cols}) VALUES ({placeholders})'

    with get_analytics_db() as con:
        con.execute(f'DROP TABLE IF EXISTS "{table_name}"')
        con.execute(create_sql)

        batch_size = 1000
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            param_rows = []
            for r in batch:
                param_rows.append([r.get(h, "") for h in headers])
            con.executemany(insert_sql, param_rows)
        con.commit()

    # Save to data_sources table in pmtool.db
    source_record = db.create_data_source(
        name=clean_name,
        source_type=ext.lstrip("."),
        file_path=str(src_file),
        table_name=table_name,
        file_size=file_size,
        row_count=len(rows),
        column_count=len(headers),
        schema_json=json.dumps(schema_list),
        project_id=project_id,
    )

    return source_record


def _copy_sqlite_table_stream(
    src_file: Path,
    target_table: str,
    dest_table: str,
    cols_info: List[Any],
) -> None:
    """Fallback copier: directly streams rows from source DB into analytics store."""
    try:
        src_con = sqlite3.connect(f"file:{src_file.as_posix()}?mode=ro", uri=True)
    except Exception:
        src_con = sqlite3.connect(str(src_file))

    try:
        src_cur = src_con.execute(f'SELECT * FROM "{target_table}"')
        col_names = [d[0] for d in src_cur.description]
        col_defs = [f'"{c["name"]}" {c["type"] or "TEXT"}' for c in cols_info]
        create_sql = f'CREATE TABLE "{dest_table}" (\n  _row_id INTEGER PRIMARY KEY AUTOINCREMENT,\n  ' + ",\n  ".join(col_defs) + "\n);"

        insert_cols = ", ".join(f'"{c}"' for c in col_names)
        placeholders = ", ".join("?" for _ in col_names)
        insert_sql = f'INSERT INTO "{dest_table}" ({insert_cols}) VALUES ({placeholders})'

        with get_analytics_db() as dest_con:
            dest_con.execute(f'DROP TABLE IF EXISTS "{dest_table}"')
            dest_con.execute(create_sql)
            while True:
                batch = src_cur.fetchmany(1000)
                if not batch:
                    break
                dest_con.executemany(insert_sql, batch)
            dest_con.commit()
    finally:
        src_con.close()


def _ingest_sqlite_source(
    src_file: Path,
    clean_name: str,
    project_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Inspect and import an external SQLite database into analytics store."""
    try:
        ext_con = sqlite3.connect(f"file:{src_file.as_posix()}?mode=ro", uri=True)
    except Exception:
        ext_con = sqlite3.connect(str(src_file))

    try:
        ext_con.row_factory = sqlite3.Row
        cur = ext_con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tables = [r["name"] for r in cur.fetchall()]
        if not tables:
            raise ValueError("No user tables found in the provided SQLite database.")

        # Filter out internal/virtual tables, prioritizing normal user tables
        candidate_tables = [
            t for t in tables
            if not any(t.lower().startswith(p) for p in ("sqlite_", "android_metadata", "_"))
            and not any(t.lower().endswith(sfx) for sfx in ("_idx", "_data", "_config", "_docsize", "_content", "_segments", "_segdir"))
        ] or tables

        # Find best table with data
        target_table = candidate_tables[0]
        max_rows = -1
        for tbl in candidate_tables:
            try:
                cnt_cur = ext_con.execute(f'SELECT COUNT(*) as cnt FROM "{tbl}"')
                cnt_val = cnt_cur.fetchone()["cnt"]
                if cnt_val > max_rows:
                    max_rows = cnt_val
                    target_table = tbl
            except Exception:
                continue

        # Inspect columns
        info_cur = ext_con.execute(f'PRAGMA table_info("{target_table}")')
        cols_info = info_cur.fetchall()
        headers = [c["name"] for c in cols_info]
        if not headers:
            raise ValueError(f"Table '{target_table}' has no readable columns.")

        row_cur = ext_con.execute(f'SELECT COUNT(*) as cnt FROM "{target_table}"')
        total_rows = row_cur.fetchone()["cnt"]

        sample_cur = ext_con.execute(f'SELECT * FROM "{target_table}" LIMIT 10')
        sample_rows = sample_cur.fetchall()
    except sqlite3.DatabaseError as db_err:
        raise ValueError(f"Invalid or corrupted SQLite database: {str(db_err)}")
    finally:
        ext_con.close()

    schema_list = []
    for c in cols_info:
        h = c["name"]
        sample_vals = [str(r[h]) for r in sample_rows if r[h] is not None][:5]
        schema_list.append({
            "name": h,
            "type": c["type"] or "TEXT",
            "sample_values": sample_vals,
        })

    # Copy table into analytics store with unique prefix
    timestamp = int(time.time())
    dest_table = f"ds_{timestamp}_{_sanitize_ident(clean_name)}"[:48]

    copied = False
    with get_analytics_db() as dest_con:
        try:
            dest_con.execute("DETACH DATABASE ext_db")
        except Exception:
            pass

        try:
            escaped_path = src_file.as_posix().replace("'", "''")
            dest_con.execute(f"ATTACH DATABASE '{escaped_path}' AS ext_db")
            try:
                dest_con.execute(f'DROP TABLE IF EXISTS "{dest_table}"')
                dest_con.execute(f'CREATE TABLE "{dest_table}" AS SELECT * FROM ext_db."{target_table}"')
                dest_con.commit()
                copied = True
            finally:
                try:
                    dest_con.execute("DETACH DATABASE ext_db")
                except Exception:
                    pass
        except Exception:
            copied = False

    if not copied:
        _copy_sqlite_table_stream(src_file, target_table, dest_table, cols_info)

    source_record = db.create_data_source(
        name=clean_name,
        source_type="sqlite",
        file_path=str(src_file),
        table_name=dest_table,
        file_size=src_file.stat().st_size,
        row_count=total_rows,
        column_count=len(headers),
        schema_json=json.dumps(schema_list),
        project_id=project_id,
    )
    return source_record


# ── Safe Read-Only Query Executor ────────────────────────────────────────────

def execute_safe_query(
    data_source_id: int,
    sql_query: str,
    max_rows: int = 100,
) -> Dict[str, Any]:
    """
    Execute a strictly verified, read-only SELECT query against a connected data source.
    Prevents any SQL mutations, enforces result limits, and isolates execution.
    """
    source = db.get_data_source(data_source_id)
    if not source:
        return {"error": "Data source not found.", "columns": [], "rows": [], "row_count": 0}

    table_name = source["table_name"]
    clean_query = (sql_query or "").strip().rstrip(";")

    # 1. Multi-statement injection guard
    if ";" in clean_query:
        return {"error": "Multiple SQL statements are not permitted.", "columns": [], "rows": [], "row_count": 0}

    # 2. Must begin with SELECT or WITH
    if not re.match(r"^(?:SELECT|WITH)\b", clean_query, re.IGNORECASE):
        return {"error": "Only read-only SELECT or WITH statements are allowed.", "columns": [], "rows": [], "row_count": 0}

    # 3. Disallowed keyword check
    tokens = set(re.findall(r"\b[a-zA-Z]+\b", clean_query.lower()))
    disallowed = tokens.intersection(DISALLOWED_SQL_KEYWORDS)
    if disallowed:
        return {
            "error": f"Prohibited SQL keyword(s) detected: {', '.join(disallowed)}. Only read-only operations permitted.",
            "columns": [],
            "rows": [],
            "row_count": 0,
        }

    # 4. Enforce LIMIT
    has_limit = bool(re.search(r"\bLIMIT\s+\d+", clean_query, re.IGNORECASE))
    final_query = clean_query if has_limit else f"{clean_query} LIMIT {max_rows}"

    start_time = time.time()
    try:
        with get_analytics_db(read_only=True) as con:
            cur = con.execute(final_query)
            columns = [desc[0] for desc in cur.description] if cur.description else []
            rows = [dict(r) for r in cur.fetchall()]
            elapsed_ms = int((time.time() - start_time) * 1000)

            return {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "duration_ms": elapsed_ms,
                "source_name": source["name"],
                "table_name": table_name,
            }
    except Exception as e:
        return {
            "error": f"Query execution failed: {str(e)}",
            "columns": [],
            "rows": [],
            "row_count": 0,
            "duration_ms": int((time.time() - start_time) * 1000),
        }


# ── KPI & Widget Computation ─────────────────────────────────────────────────

def format_metric_value(val: Any, format_type: str = "number") -> str:
    """Format numeric KPI value according to user display preference."""
    if val is None:
        return "—"
    try:
        num = float(val)
    except (ValueError, TypeError):
        return str(val)

    fmt = (format_type or "number").lower()
    if fmt == "currency_usd":
        return f"${num:,.2f}"
    elif fmt == "currency_eur":
        return f"€{num:,.2f}"
    elif fmt == "currency_inr":
        return f"₹{num:,.2f}"
    elif fmt == "percent":
        return f"{num:.1f}%"
    else:
        # Standard number: show integer if whole, else 2 decimals
        return f"{int(num):,}" if num.is_integer() else f"{num:,.2f}"


def compute_widget_data(widget_id: int) -> Dict[str, Any]:
    """Compute live metric data, chart series, or preview for a dashboard widget."""
    widget = db.get_dashboard_widget(widget_id)
    if not widget:
        return {"error": "Widget not found."}

    source = db.get_data_source(widget["data_source_id"])
    if not source:
        return {"error": "Data source not linked."}

    table = source["table_name"]
    w_type = widget.get("widget_type", "kpi_card")
    op = (widget.get("metric_op") or "count").upper()
    if op not in ALLOWED_METRIC_OPS:
        op = "COUNT"

    val_col = widget.get("value_column", "").strip()
    grp_col = widget.get("group_by_column", "").strip()
    filter_sql = (widget.get("filter_sql") or "").strip()

    where_clause = ""
    if filter_sql:
        if ";" in filter_sql or "--" in filter_sql or "/*" in filter_sql:
            filter_sql = ""
        else:
            tokens = set(re.findall(r"\b[a-zA-Z]+\b", filter_sql.lower()))
            if tokens.intersection(DISALLOWED_SQL_KEYWORDS):
                filter_sql = ""
        if filter_sql:
            where_clause = f"WHERE ({filter_sql})"

    with get_analytics_db(read_only=True) as con:
        # Validate column names against actual table schema
        try:
            cur_cols = con.execute(f'PRAGMA table_info("{table}")').fetchall()
            valid_cols = {c["name"] for c in cur_cols if c["name"] != "_row_id"}
        except Exception:
            valid_cols = set()

        if val_col and val_col not in valid_cols:
            val_col = ""
        if grp_col and grp_col not in valid_cols:
            grp_col = ""

        # 1. KPI Card Metric
        if w_type == "kpi_card":
            if op == "COUNT" and not val_col:
                expr = "COUNT(*)"
            else:
                expr = f'{op}("{val_col}")' if val_col else "COUNT(*)"

            query = f'SELECT {expr} AS metric_val FROM "{table}" {where_clause}'
            try:
                row = con.execute(query).fetchone()
                raw_val = row["metric_val"] if row else 0
                display_val = format_metric_value(raw_val, widget.get("format_type", "number"))

                comparison = None
                target = widget.get("target_value")
                if target is not None and isinstance(raw_val, (int, float)) and target != 0:
                    diff_pct = ((raw_val - target) / abs(target)) * 100
                    comparison = {
                        "target": target,
                        "diff_pct": round(diff_pct, 1),
                        "direction": "up" if diff_pct >= 0 else "down",
                        "label": f"{'+' if diff_pct >= 0 else ''}{diff_pct:.1f}% vs target ({format_metric_value(target, widget.get('format_type'))})"
                    }

                return {
                    "widget_id": widget_id,
                    "widget_type": "kpi_card",
                    "title": widget["title"],
                    "value": raw_val,
                    "display_value": display_val,
                    "comparison": comparison,
                    "data_source_name": source["name"],
                }
            except Exception as e:
                return {"widget_id": widget_id, "error": f"Evaluation error: {str(e)}"}

        # 2. Charts (Bar, Line, Pie, Donut)
        elif w_type in ("bar_chart", "line_chart", "pie_chart", "donut_chart"):
            if not grp_col:
                return {"widget_id": widget_id, "error": "Grouping dimension column is required for charts."}

            if op == "COUNT" and not val_col:
                expr = "COUNT(*)"
            else:
                expr = f'{op}("{val_col}")' if val_col else "COUNT(*)"

            query = (
                f'SELECT "{grp_col}" AS dim, {expr} AS val '
                f'FROM "{table}" {where_clause} '
                f'GROUP BY "{grp_col}" '
                f'ORDER BY val DESC LIMIT 12'
            )
            try:
                rows = con.execute(query).fetchall()
                labels = [str(r["dim"]) if r["dim"] is not None else "(empty)" for r in rows]
                values = [float(r["val"] or 0) for r in rows]
                total_val = sum(values)

                # Color palette for charts matching PM Tool dark amber aesthetics
                palette = [
                    "#e8a84c", "#4c97e8", "#5aab7f", "#e85c4c", "#a5b4fc",
                    "#38bdf8", "#fbbf24", "#34d399", "#f472b6", "#c084fc",
                    "#94a3b8", "#7a5820"
                ]

                series = []
                for idx, (lbl, val) in enumerate(zip(labels, values)):
                    pct = round((val / total_val * 100), 1) if total_val > 0 else 0
                    series.append({
                        "label": lbl,
                        "value": val,
                        "display_value": format_metric_value(val, widget.get("format_type", "number")),
                        "percent": pct,
                        "color": palette[idx % len(palette)],
                    })

                return {
                    "widget_id": widget_id,
                    "widget_type": w_type,
                    "title": widget["title"],
                    "labels": labels,
                    "values": values,
                    "series": series,
                    "total": total_val,
                    "display_total": format_metric_value(total_val, widget.get("format_type", "number")),
                    "data_source_name": source["name"],
                }
            except Exception as e:
                return {"widget_id": widget_id, "error": f"Chart error: {str(e)}"}

        # 3. Table View
        elif w_type == "table_view":
            query = f'SELECT * FROM "{table}" {where_clause} LIMIT 50'
            try:
                cur = con.execute(query)
                cols = [desc[0] for desc in cur.description if desc[0] != "_row_id"]
                rows = []
                for r in cur.fetchall():
                    rows.append({c: r[c] for c in cols})

                return {
                    "widget_id": widget_id,
                    "widget_type": "table_view",
                    "title": widget["title"],
                    "columns": cols,
                    "rows": rows,
                    "row_count": len(rows),
                    "data_source_name": source["name"],
                }
            except Exception as e:
                return {"widget_id": widget_id, "error": f"Table view error: {str(e)}"}

    return {"error": "Unsupported widget type."}


# ── AI Copilot Context Grounding ─────────────────────────────────────────────

def get_analytics_context_for_llm(project_id: Optional[int] = None) -> str:
    """
    Construct safe, contextual summary of connected datasets and active dashboard
    KPIs for injection into PM Copilot system prompt.
    """
    sources = db.list_data_sources(project_id=project_id)
    if not sources:
        return ""

    lines = [
        "=======================================================",
        "### CONNECTED DATASETS & BUSINESS INTEGRATIONS (READ-ONLY)",
        "The user has integrated active business data files (CSV/Excel/DB) into PM Tool Data Studio.",
        "You have read-only contextual knowledge of these schemas and metrics to answer analytical questions.",
        "When referencing statistics, cite the dataset name and exact metric values.",
        ""
    ]

    for s in sources[:6]:
        try:
            schema = json.loads(s.get("schema_json") or "[]")
        except Exception:
            schema = []

        col_summary = ", ".join(f"{c['name']} ({c.get('type', 'text')})" for c in schema[:10])
        if len(schema) > 10:
            col_summary += f", ... (+{len(schema)-10} more columns)"

        lines.append(f"- **Dataset: {s['name']}** [Format: {s['source_type'].upper()}, {s['row_count']:,} rows, {s['column_count']} cols]")
        lines.append(f"  • Table: `{s['table_name']}`")
        lines.append(f"  • Schema: {col_summary}")

    # Check for active dashboard KPIs
    dashboards = db.list_dashboards(project_id=project_id)
    if dashboards:
        lines.append("\n### ACTIVE USER-DEFINED DASHBOARD KPIS:")
        for d in dashboards[:3]:
            widgets = db.list_dashboard_widgets(d["id"])
            kpi_widgets = [w for w in widgets if w["widget_type"] == "kpi_card"]
            for w in kpi_widgets[:5]:
                try:
                    computed = compute_widget_data(w["id"])
                    if "display_value" in computed:
                        comp_str = f" ({computed['comparison']['label']})" if computed.get("comparison") else ""
                        lines.append(f"  • {w['title']}: {computed['display_value']}{comp_str} [Source: {computed['data_source_name']}]")
                except Exception:
                    pass

    lines.append("=======================================================")
    return "\n".join(lines)
