# ── tools/analytics_engine.py ──────────────────────────────────────────────────
# PM Tool — Advanced Industry Analytical Tools Engine (v2.1.0 Atlas)
# Implements Cohort Retention Matrices, Funnel Drop-Off Analytics, Statistical
# Distributions with Z-Score Outlier Detection, Pairwise Correlation Matrices,
# and Metric Trendline Forecasting for ingested SQLite datasets.

import math
import sqlite3
import time
from typing import Any, Dict, List, Optional, Tuple
import db
import data_engine


def get_dataset_table_info(source_id: int) -> Tuple[str, List[Dict[str, Any]]]:
    """Retrieve the physical table name and schema for a data source."""
    source = db.get_data_source(source_id)
    if not source:
        raise ValueError(f"Data source {source_id} not found.")
    table_name = source["table_name"]
    import json
    schema = []
    try:
        raw_schema = source.get("schema_json") or "[]"
        schema = json.loads(raw_schema)
    except Exception:
        schema = []
    return table_name, schema


# ── 1. Funnel Drop-Off Analytics ──────────────────────────────────────────────

def compute_funnel_analysis(
    source_id: int,
    stage_column: str,
    stages: List[str],
    entity_column: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Compute multi-stage conversion funnel and drop-off analytics.

    Args:
        source_id: Data source ID.
        stage_column: Column name containing the funnel stages/events.
        stages: Ordered list of stage values (e.g. ['visit', 'signup', 'active', 'paid']).
        entity_column: Optional unique ID column (e.g. 'user_id'); if omitted, counts rows.

    Returns:
        Structured funnel steps with counts, conversion %, drop-off %, and overall rate.
    """
    start_time = time.time()
    table_name, _ = get_dataset_table_info(source_id)
    if not stages:
        return {"error": "At least one funnel stage must be specified."}

    funnel_steps = []
    top_count = 0
    prev_count = 0

    with data_engine.get_analytics_db(read_only=True) as con:
        for idx, stage in enumerate(stages):
            stage_val = str(stage).strip()
            if entity_column:
                query = f'SELECT COUNT(DISTINCT "{entity_column}") as cnt FROM "{table_name}" WHERE "{stage_column}" = ?'
            else:
                query = f'SELECT COUNT(*) as cnt FROM "{table_name}" WHERE "{stage_column}" = ?'

            cur = con.execute(query, (stage_val,))
            count = cur.fetchone()["cnt"]

            if idx == 0:
                top_count = count
                conversion_from_top = 100.0 if count > 0 else 0.0
                conversion_from_prev = 100.0 if count > 0 else 0.0
                drop_off_count = 0
                drop_off_rate = 0.0
            else:
                conversion_from_top = round((count / top_count * 100.0), 2) if top_count > 0 else 0.0
                conversion_from_prev = round((count / prev_count * 100.0), 2) if prev_count > 0 else 0.0
                drop_off_count = max(0, prev_count - count)
                drop_off_rate = round((drop_off_count / prev_count * 100.0), 2) if prev_count > 0 else 0.0

            funnel_steps.append({
                "stage": stage_val,
                "step_order": idx + 1,
                "count": count,
                "conversion_from_top": conversion_from_top,
                "conversion_from_previous": conversion_from_prev,
                "drop_off_count": drop_off_count,
                "drop_off_rate": drop_off_rate,
            })
            prev_count = count

    overall_conversion = funnel_steps[-1]["conversion_from_top"] if funnel_steps else 0.0
    elapsed_ms = int((time.time() - start_time) * 1000)

    return {
        "success": True,
        "source_id": source_id,
        "stage_column": stage_column,
        "entity_column": entity_column,
        "steps": funnel_steps,
        "total_top_conversions": top_count,
        "final_step_conversions": prev_count,
        "overall_conversion_rate": overall_conversion,
        "duration_ms": elapsed_ms,
    }


# ── 2. Cohort Retention Matrix ────────────────────────────────────────────────

def compute_cohort_retention(
    source_id: int,
    user_column: str,
    date_column: str,
    period_type: str = "month",
    max_periods: int = 6,
) -> Dict[str, Any]:
    """
    Compute period-over-period cohort retention matrix (MoM / WoW).

    Args:
        source_id: Data source ID.
        user_column: User or account identifier column.
        date_column: Event or activity timestamp column.
        period_type: 'month' (default), 'week', or 'day'.
        max_periods: Maximum number of subsequent periods to compute (default 6).

    Returns:
        Matrix of cohorts with initial size and retention percentages per period.
    """
    start_time = time.time()
    table_name, _ = get_dataset_table_info(source_id)

    # SQLite period formatting
    if period_type == "week":
        date_fmt = "strftime('%Y-W%W', \"{date_col}\")"
        period_label = "Week"
    elif period_type == "day":
        date_fmt = "strftime('%Y-%m-%d', \"{date_col}\")"
        period_label = "Day"
    else:
        date_fmt = "strftime('%Y-%m', \"{date_col}\")"
        period_label = "Month"

    period_expr = date_fmt.format(date_col=date_column)

    with data_engine.get_analytics_db(read_only=True) as con:
        # 1. Fetch user first activity (cohort assignment) and all user activity periods
        cohort_query = f"""
            WITH user_events AS (
                SELECT "{user_column}" as uid, {period_expr} as p
                FROM "{table_name}"
                WHERE "{user_column}" IS NOT NULL AND "{date_column}" IS NOT NULL AND "{date_column}" != ''
                GROUP BY uid, p
            ),
            user_cohorts AS (
                SELECT uid, MIN(p) as cohort_p
                FROM user_events
                GROUP BY uid
            )
            SELECT uc.cohort_p, ue.p as active_p, COUNT(DISTINCT uc.uid) as active_users
            FROM user_cohorts uc
            JOIN user_events ue ON uc.uid = ue.uid
            GROUP BY uc.cohort_p, ue.p
            ORDER BY uc.cohort_p ASC, ue.p ASC
        """
        try:
            cur = con.execute(cohort_query)
            rows = cur.fetchall()
        except sqlite3.DatabaseError as e:
            return {"error": f"Failed to compute retention query: {str(e)}"}

    if not rows:
        return {"error": "No valid event dates or user records found to construct cohorts."}

    # Group by cohort
    cohort_data: Dict[str, Dict[str, int]] = {}
    distinct_periods = sorted(list(set(r["cohort_p"] for r in rows)))

    for r in rows:
        c_period = r["cohort_p"]
        act_period = r["active_p"]
        cnt = r["active_users"]
        if c_period not in cohort_data:
            cohort_data[c_period] = {}
        cohort_data[c_period][act_period] = cnt

    cohort_matrix = []
    for c_period in distinct_periods:
        # Determine period index relative to cohort start
        c_idx = distinct_periods.index(c_period)
        cohort_size = cohort_data[c_period].get(c_period, 0)
        if cohort_size == 0:
            continue

        retention_list = []
        for offset in range(max_periods):
            target_idx = c_idx + offset
            if target_idx < len(distinct_periods):
                target_p = distinct_periods[target_idx]
                active_cnt = cohort_data[c_period].get(target_p, 0)
                pct = round((active_cnt / cohort_size) * 100.0, 1)
                retention_list.append(pct)
            else:
                retention_list.append(None)

        cohort_matrix.append({
            "cohort": c_period,
            "cohort_size": cohort_size,
            "retention": retention_list,
        })

    period_headers = [f"{period_label} {i}" for i in range(max_periods)]
    elapsed_ms = int((time.time() - start_time) * 1000)

    return {
        "success": True,
        "source_id": source_id,
        "period_type": period_type,
        "period_headers": period_headers,
        "cohorts": cohort_matrix,
        "total_cohorts": len(cohort_matrix),
        "duration_ms": elapsed_ms,
    }


# ── 3. Statistical Distributions & Outlier Detection ──────────────────────────

def compute_column_statistics(
    source_id: int,
    column_name: str,
) -> Dict[str, Any]:
    """
    Compute comprehensive statistical distribution metrics and Tukey's fences / Z-score outliers.
    """
    start_time = time.time()
    table_name, _ = get_dataset_table_info(source_id)

    with data_engine.get_analytics_db(read_only=True) as con:
        # Fetch non-null numeric values
        query = f"""
            SELECT CAST("{column_name}" AS REAL) as val, _row_id
            FROM "{table_name}"
            WHERE "{column_name}" IS NOT NULL AND "{column_name}" != ''
            ORDER BY val ASC
        """
        try:
            cur = con.execute(query)
            data = [(r["val"], r["_row_id"]) for r in cur.fetchall() if r["val"] is not None]
        except sqlite3.DatabaseError as e:
            return {"error": f"Failed to read numerical column: {str(e)}"}

    if not data:
        return {"error": f"Column '{column_name}' contains no valid numerical values."}

    values = [d[0] for d in data]
    n = len(values)
    total_sum = sum(values)
    mean = total_sum / n

    # Percentiles
    def get_percentile(p: float) -> float:
        idx = (p / 100.0) * (n - 1)
        lower = int(math.floor(idx))
        upper = int(math.ceil(idx))
        if lower == upper:
            return values[lower]
        weight = idx - lower
        return values[lower] * (1 - weight) + values[upper] * weight

    min_val = values[0]
    max_val = values[-1]
    p25 = round(get_percentile(25), 4)
    median = round(get_percentile(50), 4)
    p75 = round(get_percentile(75), 4)
    p90 = round(get_percentile(90), 4)
    p99 = round(get_percentile(99), 4)

    # Variance & Standard Deviation
    variance = sum((x - mean) ** 2 for x in values) / (n - 1) if n > 1 else 0.0
    std_dev = math.sqrt(variance)

    # Interquartile Range (IQR) & Tukey's Outlier Bounds
    iqr = p75 - p25
    lower_bound = p25 - 1.5 * iqr
    upper_bound = p75 + 1.5 * iqr

    # Outlier Detection (Tukey + Z-Score |Z| > 3)
    outliers = []
    for val, row_id in data:
        z_score = (val - mean) / std_dev if std_dev > 0 else 0.0
        is_iqr_outlier = val < lower_bound or val > upper_bound
        is_z_outlier = abs(z_score) > 3.0

        if is_iqr_outlier or is_z_outlier:
            outliers.append({
                "row_id": row_id,
                "value": round(val, 4),
                "z_score": round(z_score, 2),
                "outlier_type": "high" if val > upper_bound else "low",
            })

    elapsed_ms = int((time.time() - start_time) * 1000)

    return {
        "success": True,
        "source_id": source_id,
        "column": column_name,
        "count": n,
        "mean": round(mean, 4),
        "median": median,
        "min": round(min_val, 4),
        "max": round(max_val, 4),
        "std_dev": round(std_dev, 4),
        "variance": round(variance, 4),
        "p25": p25,
        "p75": p75,
        "p90": p90,
        "p99": p99,
        "iqr": round(iqr, 4),
        "lower_fence": round(lower_bound, 4),
        "upper_fence": round(upper_bound, 4),
        "outlier_count": len(outliers),
        "outlier_percentage": round((len(outliers) / n) * 100.0, 2),
        "sample_outliers": outliers[:20],
        "duration_ms": elapsed_ms,
    }


# ── 4. Pairwise Feature Correlation Matrix ────────────────────────────────────

def compute_correlation_matrix(
    source_id: int,
    columns: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Compute pairwise Pearson correlation coefficients across numerical columns.
    """
    start_time = time.time()
    table_name, schema = get_dataset_table_info(source_id)

    # Determine numerical columns if not provided
    with data_engine.get_analytics_db(read_only=True) as con:
        if not columns:
            cur = con.execute(f'PRAGMA table_info("{table_name}")')
            cols_info = cur.fetchall()
            cand_cols = [c["name"] for c in cols_info if c["name"] != "_row_id"]

            # Filter columns that cast to numerical
            valid_cols = []
            for col in cand_cols:
                try:
                    t_cur = con.execute(f'SELECT COUNT(*) as cnt FROM "{table_name}" WHERE CAST("{col}" AS REAL) != 0.0 OR "{col}" = "0"')
                    if t_cur.fetchone()["cnt"] > 0:
                        valid_cols.append(col)
                except Exception:
                    continue
            columns = valid_cols[:8]  # Limit to top 8 for clean matrix display

        if len(columns) < 2:
            return {"error": "At least two numerical columns are required to compute correlations."}

        # Fetch column vectors
        select_cols = ", ".join(f'CAST("{c}" AS REAL) as "{c}"' for c in columns)
        query = f'SELECT {select_cols} FROM "{table_name}" WHERE ' + " AND ".join(f'"{c}" IS NOT NULL AND "{c}" != \'\'' for c in columns)
        cur = con.execute(query)
        rows = cur.fetchall()

    n = len(rows)
    if n < 3:
        return {"error": "Insufficient valid rows to compute statistical correlation."}

    # Extract arrays
    col_arrays = {c: [r[c] for r in rows if r[c] is not None] for c in columns}
    means = {c: sum(col_arrays[c]) / n for c in columns}
    stds = {
        c: math.sqrt(sum((x - means[c]) ** 2 for x in col_arrays[c]) / (n - 1)) if n > 1 else 0.0
        for c in columns
    }

    matrix = []
    pair_details = []

    for col1 in columns:
        row_vals = []
        for col2 in columns:
            if col1 == col2:
                r_val = 1.0
            else:
                std_prod = stds[col1] * stds[col2]
                if std_prod > 0:
                    cov = sum((x - means[col1]) * (y - means[col2]) for x, y in zip(col_arrays[col1], col_arrays[col2])) / (n - 1)
                    r_val = max(-1.0, min(1.0, cov / std_prod))
                else:
                    r_val = 0.0

            r_rounded = round(r_val, 3)
            row_vals.append(r_rounded)

            if columns.index(col1) < columns.index(col2):
                strength = "Strong" if abs(r_val) >= 0.7 else "Moderate" if abs(r_val) >= 0.3 else "Weak"
                direction = "Positive" if r_val > 0 else "Negative"
                pair_details.append({
                    "col1": col1,
                    "col2": col2,
                    "correlation": r_rounded,
                    "relationship": f"{strength} {direction}" if abs(r_val) >= 0.3 else "Negligible",
                })

        matrix.append(row_vals)

    pair_details.sort(key=lambda p: abs(p["correlation"]), reverse=True)
    elapsed_ms = int((time.time() - start_time) * 1000)

    return {
        "success": True,
        "source_id": source_id,
        "columns": columns,
        "matrix": matrix,
        "top_pairs": pair_details,
        "sample_size": n,
        "duration_ms": elapsed_ms,
    }


# ── 5. Linear Trendline & Forecasting ─────────────────────────────────────────

def compute_trend_forecast(
    source_id: int,
    date_column: str,
    metric_column: str,
    periods_ahead: int = 5,
    aggregation: str = "sum",
) -> Dict[str, Any]:
    """
    Compute linear regression trendline and project forward trajectory milestones.
    """
    start_time = time.time()
    table_name, _ = get_dataset_table_info(source_id)

    agg_op = "SUM" if aggregation.lower() == "sum" else "AVG" if aggregation.lower() == "avg" else "COUNT"

    with data_engine.get_analytics_db(read_only=True) as con:
        # Group by date period (e.g. daily/monthly)
        query = f"""
            SELECT "{date_column}" as dt, {agg_op}(CAST("{metric_column}" AS REAL)) as val
            FROM "{table_name}"
            WHERE "{date_column}" IS NOT NULL AND "{date_column}" != '' AND "{metric_column}" IS NOT NULL
            GROUP BY dt
            ORDER BY dt ASC
        """
        try:
            cur = con.execute(query)
            rows = cur.fetchall()
        except sqlite3.DatabaseError as e:
            return {"error": f"Failed to execute time-series query: {str(e)}"}

    if len(rows) < 3:
        return {"error": "At least 3 sequential time-series data points are required to compute trend forecasts."}

    historical = [{"date": r["dt"], "value": round(r["val"], 2)} for r in rows]
    n = len(historical)
    x_vals = list(range(n))
    y_vals = [h["value"] for h in historical]

    x_mean = sum(x_vals) / n
    y_mean = sum(y_vals) / n

    denom = sum((x - x_mean) ** 2 for x in x_vals)
    if denom == 0:
        slope = 0.0
        intercept = y_mean
    else:
        slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, y_vals)) / denom
        intercept = y_mean - slope * x_mean

    # R-squared goodness of fit
    ss_tot = sum((y - y_mean) ** 2 for y in y_vals)
    ss_res = sum((y - (slope * x + intercept)) ** 2 for x, y in zip(x_vals, y_vals))
    r_squared = round(1.0 - (ss_res / ss_tot), 3) if ss_tot > 0 else 0.0

    # Project forward
    forecast = []
    periods_count = max(1, min(periods_ahead, 12))
    for step in range(1, periods_count + 1):
        future_x = n - 1 + step
        pred_y = round(max(0.0, slope * future_x + intercept), 2)
        forecast.append({
            "period_step": step,
            "label": f"+{step} Periods",
            "forecasted_value": pred_y,
        })

    elapsed_ms = int((time.time() - start_time) * 1000)

    return {
        "success": True,
        "source_id": source_id,
        "date_column": date_column,
        "metric_column": metric_column,
        "historical": historical,
        "forecast": forecast,
        "trend_slope": round(slope, 3),
        "trend_intercept": round(intercept, 2),
        "r_squared": r_squared,
        "trend_direction": "Upward" if slope > 0 else "Downward" if slope < 0 else "Flat",
        "duration_ms": elapsed_ms,
    }
