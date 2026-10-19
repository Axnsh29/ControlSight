from pathlib import Path
import csv
import sqlite3

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="ControlSight API",
    description=(
        "Backend API for the ControlSight "
        "project controls intelligence platform"
    ),
    version="1.1.0",
)


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATABASE_PATH = (
    PROJECT_ROOT
    / "data"
    / "database"
    / "controlsight.db"
)

PROCESSED_DATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
)

ETL_AUDIT_PATH = (
    PROCESSED_DATA_PATH
    / "etl_audit_report.csv"
)

FRONTEND_PATH = (
    PROJECT_ROOT
    / "src"
    / "frontend"
)


# ============================================================
# ATTENTION SCORE METHODOLOGY
# ============================================================

ATTENTION_SCORE_LIMITS = {
    "cost": 30,
    "progress": 25,
    "critical_schedule": 25,
    "procurement": 15,
    "data_quality": 5,
}

ATTENTION_SCORE_MAXIMUM = sum(
    ATTENTION_SCORE_LIMITS.values()
)

ATTENTION_THRESHOLDS = {
    "critical": 60,
    "watch": 30,
}

ATTENTION_SCORE_DESCRIPTION = (
    "Rules-based management attention index. "
    "The score represents prioritisation severity and "
    "is not a probability of project failure."
)


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_db_connection():
    """
    Open a SQLite connection to the ControlSight
    analytical database.
    """

    if not DATABASE_PATH.exists():
        raise FileNotFoundError(
            f"Database not found at: {DATABASE_PATH}"
        )

    connection = sqlite3.connect(
        DATABASE_PATH
    )

    connection.row_factory = sqlite3.Row

    return connection


# ============================================================
# VALIDATION METRICS
# ============================================================

def get_validation_metrics():
    """
    Read the ETL audit report and calculate transparent
    validation counts.

    Validation Pass Rate =
        accepted analytical rows / source operational rows
    """

    if not ETL_AUDIT_PATH.exists():

        return {
            "source_rows": None,
            "accepted_rows": None,
            "quarantined_rows": None,
            "validation_pass_rate": None,
            "formula": (
                "accepted_rows / source_rows * 100"
            ),
            "source": "etl_audit_report.csv",
            "available": False,
        }

    source_rows = 0
    accepted_rows = 0

    with ETL_AUDIT_PATH.open(
        "r",
        encoding="utf-8",
        newline="",
    ) as file:

        reader = csv.DictReader(
            file
        )

        for row in reader:

            try:
                source_rows += int(
                    float(
                        row.get(
                            "input_rows",
                            0,
                        )
                        or 0
                    )
                )
            except (
                TypeError,
                ValueError,
            ):
                pass

            try:
                accepted_rows += int(
                    float(
                        row.get(
                            "output_rows",
                            0,
                        )
                        or 0
                    )
                )
            except (
                TypeError,
                ValueError,
            ):
                pass

    quarantined_rows = max(
        source_rows
        -
        accepted_rows,
        0,
    )

    if source_rows > 0:

        validation_pass_rate = round(
            accepted_rows
            /
            source_rows
            *
            100,
            2,
        )

    else:

        validation_pass_rate = None

    return {
        "source_rows": source_rows,
        "accepted_rows": accepted_rows,
        "quarantined_rows": quarantined_rows,
        "validation_pass_rate": (
            validation_pass_rate
        ),
        "formula": (
            "accepted_rows / source_rows * 100"
        ),
        "source": "etl_audit_report.csv",
        "available": True,
    }


# ============================================================
# FRONTEND
# ============================================================

@app.get("/")
def dashboard():
    """
    Serve the ControlSight management dashboard.
    """

    return FileResponse(
        FRONTEND_PATH
        / "index.html"
    )


app.mount(
    "/css",
    StaticFiles(
        directory=(
            FRONTEND_PATH
            / "css"
        )
    ),
    name="css",
)

app.mount(
    "/js",
    StaticFiles(
        directory=(
            FRONTEND_PATH
            / "js"
        )
    ),
    name="js",
)


# ============================================================
# PORTFOLIO KPIs
# ============================================================

@app.get("/api/kpis")
def get_portfolio_kpis():
    """
    Return portfolio-level management KPIs.
    """

    try:

        with get_db_connection() as connection:

            row = connection.execute(
                """
                SELECT *
                FROM report_portfolio_kpis
                LIMIT 1
                """
            ).fetchone()

            if row is None:

                raise HTTPException(
                    status_code=404,
                    detail=(
                        "No portfolio KPI record found"
                    ),
                )

            return dict(
                row
            )

    except FileNotFoundError as error:

        raise HTTPException(
            status_code=500,
            detail=str(
                error
            ),
        ) from error


# ============================================================
# PROJECT PORTFOLIO
# ============================================================

@app.get("/api/projects")
def get_projects():
    """
    Return project-level management scorecards.
    """

    with get_db_connection() as connection:

        rows = connection.execute(
            """
            SELECT
                project_code,
                project_name,
                approved_budget,
                actual_cost_to_date,
                forecast_at_completion,
                forecast_variance,
                forecast_variance_pct,
                planned_progress_pct,
                actual_progress_pct,
                progress_variance_pct,
                health_status,
                management_status,
                total_procurement_items,
                delayed_items,
                critical_delays

            FROM report_management_scorecard

            ORDER BY project_code
            """
        ).fetchall()

        return [
            dict(
                row
            )
            for row in rows
        ]


# ============================================================
# DATA QUALITY
# ============================================================

@app.get("/api/data-quality")
def get_data_quality():
    """
    Return the data-quality issue register, grouped issue
    summary and transparent validation counts.

    Important distinction:

    - quarantined_rows = invalid source records excluded
      from the controlled analytical layer.

    - issue_events = validation/data-quality observations
      logged by the ETL process.

    One source row may generate more than one issue event,
    so issue_events do not have to equal quarantined_rows.
    """

    with get_db_connection() as connection:

        issues = connection.execute(
            """
            SELECT
                issue_id,
                dataset,
                row_index,
                issue_type,
                column_name,
                value,
                message

            FROM fact_data_quality

            ORDER BY issue_id
            """
        ).fetchall()

        summary = connection.execute(
            """
            SELECT
                dataset,
                issue_type,
                COUNT(*) AS issue_count

            FROM fact_data_quality

            GROUP BY
                dataset,
                issue_type

            ORDER BY
                dataset,
                issue_type
            """
        ).fetchall()

        validation = (
            get_validation_metrics()
        )

        issue_events = len(
            issues
        )

        return {
            "source_rows": (
                validation[
                    "source_rows"
                ]
            ),
            "accepted_rows": (
                validation[
                    "accepted_rows"
                ]
            ),
            "quarantined_rows": (
                validation[
                    "quarantined_rows"
                ]
            ),
            "issue_events": (
                issue_events
            ),
            "total_issues": (
                issue_events
            ),
            "validation_pass_rate": (
                validation[
                    "validation_pass_rate"
                ]
            ),
            "validation_formula": (
                validation[
                    "formula"
                ]
            ),
            "validation_source": (
                validation[
                    "source"
                ]
            ),
            "validation_metrics_available": (
                validation[
                    "available"
                ]
            ),
            "definitions": {
                "source_rows": (
                    "Operational records presented "
                    "to the ETL validation layer."
                ),
                "accepted_rows": (
                    "Records accepted into the "
                    "controlled analytical layer."
                ),
                "quarantined_rows": (
                    "Invalid source records excluded "
                    "from the controlled analytical "
                    "layer."
                ),
                "issue_events": (
                    "Validation observations logged "
                    "during ETL. Multiple issue events "
                    "may relate to one source record."
                ),
                "validation_pass_rate": (
                    "Accepted rows divided by source "
                    "rows, expressed as a percentage."
                ),
            },
            "summary": [
                dict(
                    row
                )
                for row in summary
            ],
            "issues": [
                dict(
                    row
                )
                for row in issues
            ],
        }


# ============================================================
# COST ANOMALIES
# ============================================================

@app.get("/api/cost-anomalies")
def get_cost_anomalies():
    """
    Return cost records explicitly flagged for
    management/data-quality investigation.
    """

    with get_db_connection() as connection:

        rows = connection.execute(
            """
            SELECT
                fc.project_code,
                dp.project_name,
                fc.package_code,
                fc.date_key,
                fc.planned_cost,
                fc.actual_cost,

                fc.actual_cost
                    - fc.planned_cost
                    AS cost_over_plan,

                ROUND(
                    fc.actual_cost
                    / NULLIF(
                        fc.planned_cost,
                        0
                    ),
                    2
                ) AS actual_to_plan_ratio,

                fc.forecast_at_completion,
                fc.cost_anomaly_flag

            FROM fact_cost fc

            LEFT JOIN dim_project dp
                ON fc.project_code
                = dp.project_code

            WHERE fc.cost_anomaly_flag = 1

            ORDER BY fc.date_key DESC
            """
        ).fetchall()

        return {
            "total_anomalies": len(
                rows
            ),
            "anomalies": [
                dict(
                    row
                )
                for row in rows
            ],
        }


# ============================================================
# PROJECT COST TREND
# ============================================================

@app.get(
    "/api/projects/{project_code}/cost-trend"
)
def get_project_cost_trend(
    project_code: str
):
    """
    Return cumulative cost performance by reporting period.

    Planned, actual and committed costs are monthly flows
    and are accumulated through time.

    Forecast at Completion is a reporting snapshot and is
    aggregated only within each reporting period, never
    across reporting periods.
    """

    with get_db_connection() as connection:

        rows = connection.execute(
            """
            WITH monthly_cost AS (

                SELECT
                    fc.project_code,
                    dd.date,
                    dd.year_month,

                    SUM(
                        fc.planned_cost
                    ) AS monthly_planned_cost,

                    SUM(
                        fc.actual_cost
                    ) AS monthly_actual_cost,

                    SUM(
                        fc.committed_cost
                    ) AS monthly_committed_cost,

                    SUM(
                        fc.forecast_at_completion
                    ) AS forecast_at_completion,

                    SUM(
                        fc.cost_anomaly_flag
                    ) AS anomaly_count

                FROM fact_cost fc

                LEFT JOIN dim_date dd
                    ON fc.date_key
                    = dd.date_key

                WHERE fc.project_code = ?

                GROUP BY
                    fc.project_code,
                    dd.date,
                    dd.year_month
            )

            SELECT
                project_code,
                date,
                year_month,

                ROUND(
                    monthly_planned_cost,
                    2
                ) AS monthly_planned_cost,

                ROUND(
                    monthly_actual_cost,
                    2
                ) AS monthly_actual_cost,

                ROUND(
                    monthly_committed_cost,
                    2
                ) AS monthly_committed_cost,

                ROUND(
                    SUM(
                        monthly_planned_cost
                    ) OVER (
                        ORDER BY date
                    ),
                    2
                ) AS cumulative_planned_cost,

                ROUND(
                    SUM(
                        monthly_actual_cost
                    ) OVER (
                        ORDER BY date
                    ),
                    2
                ) AS cumulative_actual_cost,

                ROUND(
                    SUM(
                        monthly_committed_cost
                    ) OVER (
                        ORDER BY date
                    ),
                    2
                ) AS cumulative_committed_cost,

                ROUND(
                    forecast_at_completion,
                    2
                ) AS forecast_at_completion,

                anomaly_count

            FROM monthly_cost

            ORDER BY date
            """,
            (
                project_code,
            ),
        ).fetchall()

        if not rows:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Project {project_code} "
                    "not found"
                ),
            )

        return {
            "project_code": (
                project_code
            ),
            "periods": len(
                rows
            ),
            "cost_trend": [
                dict(
                    row
                )
                for row in rows
            ],
        }


# ============================================================
# PROJECT PROGRESS TREND
# ============================================================

@app.get(
    "/api/projects/{project_code}/progress-trend"
)
def get_project_progress_trend(
    project_code: str
):
    """
    Return planned versus actual progress through time.
    """

    with get_db_connection() as connection:

        rows = connection.execute(
            """
            SELECT
                fp.project_code,
                dd.date,
                dd.year_month,
                fp.planned_progress_pct,
                fp.actual_progress_pct,
                fp.progress_variance_pct,
                fp.behind_schedule_flag

            FROM fact_progress fp

            LEFT JOIN dim_date dd
                ON fp.date_key
                = dd.date_key

            WHERE fp.project_code = ?

            ORDER BY dd.date
            """,
            (
                project_code,
            ),
        ).fetchall()

        if not rows:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Project {project_code} "
                    "not found"
                ),
            )

        return {
            "project_code": (
                project_code
            ),
            "periods": len(
                rows
            ),
            "progress_trend": [
                dict(
                    row
                )
                for row in rows
            ],
        }


# ============================================================
# PROJECT SCHEDULE RISK
# ============================================================

@app.get(
    "/api/projects/{project_code}/schedule-risk"
)
def get_project_schedule_risk(
    project_code: str
):
    """
    Return schedule activity detail and
    schedule-risk summary.
    """

    with get_db_connection() as connection:

        activities = connection.execute(
            """
            SELECT
                activity_id,
                wbs_code,
                activity_name,
                discipline,
                percent_complete,
                status,
                is_critical,
                start_delay_days,
                finish_delay_days,
                delayed_activity_flag

            FROM fact_schedule

            WHERE project_code = ?

            ORDER BY
                is_critical DESC,
                delayed_activity_flag DESC,
                finish_delay_days DESC
            """,
            (
                project_code,
            ),
        ).fetchall()

        if not activities:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Project {project_code} "
                    "not found"
                ),
            )

        summary = connection.execute(
            """
            SELECT
                COUNT(*)
                    AS total_activities,

                SUM(
                    CASE
                        WHEN is_critical = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS critical_activities,

                SUM(
                    CASE
                        WHEN delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS delayed_activities,

                SUM(
                    CASE
                        WHEN is_critical = 1
                        AND delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS critical_delayed_activities,

                ROUND(
                    AVG(
                        percent_complete
                    ),
                    2
                ) AS average_completion_pct

            FROM fact_schedule

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()

        return {
            "project_code": (
                project_code
            ),
            "summary": dict(
                summary
            ),
            "activities": [
                dict(
                    row
                )
                for row in activities
            ],
        }


# ============================================================
# PROJECT PROCUREMENT RISK
# ============================================================

@app.get(
    "/api/projects/{project_code}/procurement-risk"
)
def get_project_procurement_risk(
    project_code: str
):
    """
    Return procurement delivery exposure and
    supplier-level detail.
    """

    with get_db_connection() as connection:

        items = connection.execute(
            """
            SELECT
                fp.procurement_id,
                fp.package_code,
                fp.vendor_id,
                dv.vendor_name,
                fp.category,
                fp.package_value,
                fp.status,
                fp.criticality,
                fp.delivery_delay_days,
                fp.delayed_delivery_flag,
                fp.critical_delay_flag

            FROM fact_procurement fp

            LEFT JOIN dim_vendor dv
                ON fp.vendor_id
                = dv.vendor_id

            WHERE fp.project_code = ?

            ORDER BY
                fp.critical_delay_flag DESC,
                fp.delayed_delivery_flag DESC,
                fp.delivery_delay_days DESC
            """,
            (
                project_code,
            ),
        ).fetchall()

        if not items:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Project {project_code} "
                    "not found"
                ),
            )

        summary = connection.execute(
            """
            SELECT
                COUNT(*)
                    AS total_items,

                SUM(
                    CASE
                        WHEN delayed_delivery_flag = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS delayed_items,

                SUM(
                    CASE
                        WHEN critical_delay_flag = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS critical_delays,

                ROUND(
                    AVG(
                        CASE
                            WHEN delayed_delivery_flag = 1
                            THEN delivery_delay_days
                        END
                    ),
                    1
                ) AS avg_delay_days,

                ROUND(
                    SUM(
                        CASE
                            WHEN delayed_delivery_flag = 1
                            THEN package_value
                            ELSE 0
                        END
                    ),
                    2
                ) AS delayed_value

            FROM fact_procurement

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()

        return {
            "project_code": (
                project_code
            ),
            "summary": dict(
                summary
            ),
            "procurement_items": [
                dict(
                    row
                )
                for row in items
            ],
        }


# ============================================================
# PROJECT EXECUTIVE OVERVIEW
# ============================================================

@app.get(
    "/api/projects/{project_code}/overview"
)
def get_project_overview(
    project_code: str
):
    """
    Return the executive overview for a selected project.
    """

    with get_db_connection() as connection:

        project = connection.execute(
            """
            SELECT
                project_code,
                project_name,
                approved_budget,
                actual_cost_to_date,
                forecast_at_completion,
                forecast_variance,
                forecast_variance_pct,
                planned_progress_pct,
                actual_progress_pct,
                progress_variance_pct,
                health_status,
                management_status,
                total_procurement_items,
                delayed_items,
                critical_delays

            FROM report_management_scorecard

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()

        if project is None:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Project {project_code} "
                    "not found"
                ),
            )

        schedule = connection.execute(
            """
            SELECT
                COUNT(*)
                    AS total_activities,

                SUM(
                    CASE
                        WHEN is_critical = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS critical_activities,

                SUM(
                    CASE
                        WHEN delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS delayed_activities,

                SUM(
                    CASE
                        WHEN is_critical = 1
                        AND delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS critical_delayed_activities

            FROM fact_schedule

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()

        cost_quality = connection.execute(
            """
            SELECT
                COUNT(*)
                    AS cost_anomalies

            FROM fact_cost

            WHERE project_code = ?
              AND cost_anomaly_flag = 1
            """,
            (
                project_code,
            ),
        ).fetchone()

        return {
            "project": dict(
                project
            ),
            "schedule": dict(
                schedule
            ),
            "data_quality": dict(
                cost_quality
            ),
        }


# ============================================================
# PROJECT MANAGEMENT INSIGHTS
# ============================================================

@app.get(
    "/api/projects/{project_code}/management-insights"
)
def get_project_management_insights(
    project_code: str
):
    """
    Generate deterministic rules-based management insights
    from cost, progress, schedule, procurement and
    data-quality indicators.

    This is exception analytics, not an AI prediction model.
    """

    with get_db_connection() as connection:

        project = connection.execute(
            """
            SELECT
                project_code,
                project_name,
                approved_budget,
                actual_cost_to_date,
                forecast_at_completion,
                forecast_variance,
                forecast_variance_pct,
                planned_progress_pct,
                actual_progress_pct,
                progress_variance_pct,
                management_status

            FROM report_management_scorecard

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()

        if project is None:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Project {project_code} "
                    "not found"
                ),
            )

        schedule = connection.execute(
            """
            SELECT
                COUNT(*)
                    AS total_activities,

                SUM(
                    CASE
                        WHEN delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS delayed_activities,

                SUM(
                    CASE
                        WHEN is_critical = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS critical_activities,

                SUM(
                    CASE
                        WHEN is_critical = 1
                        AND delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS critical_delayed_activities

            FROM fact_schedule

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()

        procurement = connection.execute(
            """
            SELECT
                COUNT(*)
                    AS total_items,

                SUM(
                    CASE
                        WHEN delayed_delivery_flag = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS delayed_items,

                SUM(
                    CASE
                        WHEN critical_delay_flag = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS critical_delays,

                ROUND(
                    AVG(
                        CASE
                            WHEN delayed_delivery_flag = 1
                            THEN delivery_delay_days
                        END
                    ),
                    1
                ) AS avg_delay_days

            FROM fact_procurement

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()

        quality = connection.execute(
            """
            SELECT
                COUNT(*)
                    AS cost_anomalies

            FROM fact_cost

            WHERE project_code = ?
              AND cost_anomaly_flag = 1
            """,
            (
                project_code,
            ),
        ).fetchone()

        forecast_variance = float(
            project[
                "forecast_variance"
            ]
            or 0
        )

        forecast_variance_pct = float(
            project[
                "forecast_variance_pct"
            ]
            or 0
        )

        progress_variance = float(
            project[
                "progress_variance_pct"
            ]
            or 0
        )

        delayed_activities = int(
            schedule[
                "delayed_activities"
            ]
            or 0
        )

        critical_activities = int(
            schedule[
                "critical_activities"
            ]
            or 0
        )

        critical_delayed = int(
            schedule[
                "critical_delayed_activities"
            ]
            or 0
        )

        delayed_items = int(
            procurement[
                "delayed_items"
            ]
            or 0
        )

        critical_procurement = int(
            procurement[
                "critical_delays"
            ]
            or 0
        )

        total_procurement = int(
            procurement[
                "total_items"
            ]
            or 0
        )

        cost_anomalies = int(
            quality[
                "cost_anomalies"
            ]
            or 0
        )

        insights = []

        # ----------------------------------------------------
        # COST
        # Negative forecast variance = forecast over budget.
        # ----------------------------------------------------

        if forecast_variance_pct <= -10:

            insights.append(
                {
                    "category": "Cost",
                    "severity": "critical",
                    "title": (
                        "Significant forecast overrun"
                    ),
                    "message": (
                        "Forecast at completion is "
                        f"£{abs(forecast_variance):,.0f} "
                        "over approved budget "
                        f"({abs(forecast_variance_pct):.1f}%)."
                    ),
                }
            )

        elif forecast_variance_pct <= -5:

            insights.append(
                {
                    "category": "Cost",
                    "severity": "warning",
                    "title": (
                        "Forecast pressure"
                    ),
                    "message": (
                        "Forecast at completion is "
                        f"£{abs(forecast_variance):,.0f} "
                        "over approved budget "
                        f"({abs(forecast_variance_pct):.1f}%)."
                    ),
                }
            )

        elif forecast_variance > 0:

            insights.append(
                {
                    "category": "Cost",
                    "severity": "positive",
                    "title": (
                        "Forecast within budget"
                    ),
                    "message": (
                        "Current forecast is "
                        f"£{forecast_variance:,.0f} "
                        "below approved budget."
                    ),
                }
            )

        # ----------------------------------------------------
        # PROGRESS
        # ----------------------------------------------------

        if progress_variance <= -10:

            insights.append(
                {
                    "category": "Schedule",
                    "severity": "critical",
                    "title": (
                        "Material schedule slippage"
                    ),
                    "message": (
                        "Actual progress is "
                        f"{abs(progress_variance):.1f} "
                        "percentage points behind plan."
                    ),
                }
            )

        elif progress_variance <= -5:

            insights.append(
                {
                    "category": "Schedule",
                    "severity": "warning",
                    "title": (
                        "Progress behind plan"
                    ),
                    "message": (
                        "Actual progress is "
                        f"{abs(progress_variance):.1f} "
                        "percentage points behind plan."
                    ),
                }
            )

        elif progress_variance >= 0:

            insights.append(
                {
                    "category": "Schedule",
                    "severity": "positive",
                    "title": (
                        "Progress on or ahead of plan"
                    ),
                    "message": (
                        "Actual progress is "
                        f"{progress_variance:.1f} "
                        "percentage points ahead of plan."
                    ),
                }
            )

        # ----------------------------------------------------
        # CRITICAL SCHEDULE
        # ----------------------------------------------------

        if critical_delayed > 0:

            if (
                critical_activities > 0
                and
                critical_delayed
                ==
                critical_activities
            ):

                message = (
                    f"All {critical_activities} "
                    "critical activities are "
                    "currently delayed."
                )

            else:

                message = (
                    f"{critical_delayed} of "
                    f"{critical_activities} "
                    "critical activities are "
                    "currently delayed."
                )

            insights.append(
                {
                    "category": "Schedule",
                    "severity": "critical",
                    "title": (
                        "Critical activities delayed"
                    ),
                    "message": message,
                }
            )

        elif delayed_activities > 0:

            insights.append(
                {
                    "category": "Schedule",
                    "severity": "warning",
                    "title": (
                        "Activity delays detected"
                    ),
                    "message": (
                        f"{delayed_activities} "
                        "activities are currently "
                        "delayed."
                    ),
                }
            )

        # ----------------------------------------------------
        # PROCUREMENT
        # ----------------------------------------------------

        if critical_procurement > 0:

            delivery_word = (
                "delivery"
                if critical_procurement == 1
                else "deliveries"
            )

            insights.append(
                {
                    "category": "Procurement",
                    "severity": "critical",
                    "title": (
                        "Critical procurement delay"
                    ),
                    "message": (
                        f"{delayed_items} of "
                        f"{total_procurement} "
                        "procurement items are "
                        "delayed, including "
                        f"{critical_procurement} "
                        f"critical {delivery_word}."
                    ),
                }
            )

        elif delayed_items > 0:

            insights.append(
                {
                    "category": "Procurement",
                    "severity": "warning",
                    "title": (
                        "Procurement delays detected"
                    ),
                    "message": (
                        f"{delayed_items} of "
                        f"{total_procurement} "
                        "procurement items are "
                        "currently delayed."
                    ),
                }
            )

        # ----------------------------------------------------
        # DATA QUALITY
        # ----------------------------------------------------

        if cost_anomalies > 0:

            anomaly_word = (
                "anomaly"
                if cost_anomalies == 1
                else "anomalies"
            )

            insights.append(
                {
                    "category": "Data Quality",
                    "severity": "data",
                    "title": (
                        "Cost data requires review"
                    ),
                    "message": (
                        f"{cost_anomalies} flagged "
                        f"cost {anomaly_word} should "
                        "be reviewed before relying "
                        "on reported cost performance."
                    ),
                }
            )

        # ----------------------------------------------------
        # OVERALL ATTENTION LEVEL
        # ----------------------------------------------------

        severities = [
            insight[
                "severity"
            ]
            for insight in insights
        ]

        if "critical" in severities:

            attention_level = (
                "Critical"
            )

        elif "warning" in severities:

            attention_level = (
                "Watch"
            )

        elif "data" in severities:

            attention_level = (
                "Review"
            )

        else:

            attention_level = (
                "Stable"
            )

        # ----------------------------------------------------
        # EXECUTIVE SUMMARY
        # ----------------------------------------------------

        project_name = project[
            "project_name"
        ]

        if attention_level == "Critical":

            executive_summary = (
                f"{project_name} requires "
                "management attention due to "
                "material cost, schedule or "
                "delivery exceptions."
            )

        elif attention_level == "Watch":

            executive_summary = (
                f"{project_name} should remain "
                "under review due to emerging "
                "performance exceptions."
            )

        elif attention_level == "Review":

            executive_summary = (
                f"{project_name} is operationally "
                "stable, but reported data contains "
                "items requiring validation."
            )

        else:

            executive_summary = (
                f"{project_name} is currently "
                "performing within defined "
                "management tolerances."
            )

        return {
            "project_code": (
                project_code
            ),
            "project_name": (
                project_name
            ),
            "management_status": (
                project[
                    "management_status"
                ]
            ),
            "attention_level": (
                attention_level
            ),
            "executive_summary": (
                executive_summary
            ),
            "insight_count": len(
                insights
            ),
            "insights": (
                insights
            ),
        }


# ============================================================
# PORTFOLIO ATTENTION RANKING
# ============================================================

@app.get(
    "/api/portfolio/attention-ranking"
)
def get_portfolio_attention_ranking():
    """
    Rank projects using a transparent rules-based
    management attention score.

    Maximum score = 100.

    The score is a prioritisation index and is not a
    probability of project failure.

    Weighting:
        Cost                30
        Progress            25
        Critical schedule   25
        Procurement         15
        Data quality         5

    Deadbands:
        Cost overrun below 1% = no cost points
        Progress lag below 1 pp = no progress points
    """

    with get_db_connection() as connection:

        projects = connection.execute(
            """
            SELECT
                project_code,
                project_name,
                approved_budget,
                forecast_at_completion,
                forecast_variance,
                forecast_variance_pct,
                planned_progress_pct,
                actual_progress_pct,
                progress_variance_pct,
                management_status

            FROM report_management_scorecard

            ORDER BY project_code
            """
        ).fetchall()

        ranking = []

        for project in projects:

            project_code = project[
                "project_code"
            ]

            schedule = connection.execute(
                """
                SELECT
                    COUNT(*)
                        AS total_activities,

                    SUM(
                        CASE
                            WHEN delayed_activity_flag = 1
                            THEN 1
                            ELSE 0
                        END
                    ) AS delayed_activities,

                    SUM(
                        CASE
                            WHEN is_critical = 1
                            THEN 1
                            ELSE 0
                        END
                    ) AS critical_activities,

                    SUM(
                        CASE
                            WHEN is_critical = 1
                            AND delayed_activity_flag = 1
                            THEN 1
                            ELSE 0
                        END
                    ) AS critical_delayed_activities

                FROM fact_schedule

                WHERE project_code = ?
                """,
                (
                    project_code,
                ),
            ).fetchone()

            procurement = connection.execute(
                """
                SELECT
                    COUNT(*)
                        AS total_items,

                    SUM(
                        CASE
                            WHEN delayed_delivery_flag = 1
                            THEN 1
                            ELSE 0
                        END
                    ) AS delayed_items,

                    SUM(
                        CASE
                            WHEN critical_delay_flag = 1
                            THEN 1
                            ELSE 0
                        END
                    ) AS critical_delays

                FROM fact_procurement

                WHERE project_code = ?
                """,
                (
                    project_code,
                ),
            ).fetchone()

            quality = connection.execute(
                """
                SELECT
                    COUNT(*)
                        AS cost_anomalies

                FROM fact_cost

                WHERE project_code = ?
                  AND cost_anomaly_flag = 1
                """,
                (
                    project_code,
                ),
            ).fetchone()

            forecast_variance_pct = float(
                project[
                    "forecast_variance_pct"
                ]
                or 0
            )

            progress_variance_pct = float(
                project[
                    "progress_variance_pct"
                ]
                or 0
            )

            delayed_activities = int(
                schedule[
                    "delayed_activities"
                ]
                or 0
            )

            critical_activities = int(
                schedule[
                    "critical_activities"
                ]
                or 0
            )

            critical_delayed = int(
                schedule[
                    "critical_delayed_activities"
                ]
                or 0
            )

            total_procurement = int(
                procurement[
                    "total_items"
                ]
                or 0
            )

            delayed_procurement = int(
                procurement[
                    "delayed_items"
                ]
                or 0
            )

            critical_procurement = int(
                procurement[
                    "critical_delays"
                ]
                or 0
            )

            cost_anomalies = int(
                quality[
                    "cost_anomalies"
                ]
                or 0
            )

            # ------------------------------------------------
            # SCORE BREAKDOWN
            # ------------------------------------------------

            score_breakdown = {
                "cost": 0,
                "progress": 0,
                "critical_schedule": 0,
                "procurement": 0,
                "data_quality": 0,
            }

            # ------------------------------------------------
            # COST — MAX 30
            # 1% deadband prevents immaterial rounding noise.
            # ------------------------------------------------

            cost_overrun_pct = max(
                0,
                -forecast_variance_pct,
            )

            if cost_overrun_pct >= 10:

                score_breakdown[
                    "cost"
                ] = 30

            elif cost_overrun_pct >= 5:

                score_breakdown[
                    "cost"
                ] = 20

            elif cost_overrun_pct >= 1:

                score_breakdown[
                    "cost"
                ] = 10

            # ------------------------------------------------
            # PROGRESS — MAX 25
            # 1 pp deadband prevents immaterial schedule noise.
            # ------------------------------------------------

            progress_lag = max(
                0,
                -progress_variance_pct,
            )

            if progress_lag >= 10:

                score_breakdown[
                    "progress"
                ] = 25

            elif progress_lag >= 5:

                score_breakdown[
                    "progress"
                ] = 15

            elif progress_lag >= 1:

                score_breakdown[
                    "progress"
                ] = 5

            # ------------------------------------------------
            # CRITICAL SCHEDULE — MAX 25
            # ------------------------------------------------

            if critical_activities > 0:

                critical_delay_ratio = (
                    critical_delayed
                    /
                    critical_activities
                )

            else:

                critical_delay_ratio = 0

            if critical_delay_ratio >= 0.50:

                score_breakdown[
                    "critical_schedule"
                ] = 25

            elif critical_delayed > 0:

                score_breakdown[
                    "critical_schedule"
                ] = 15

            # ------------------------------------------------
            # PROCUREMENT — MAX 15
            # ------------------------------------------------

            if total_procurement > 0:

                procurement_delay_ratio = (
                    delayed_procurement
                    /
                    total_procurement
                )

            else:

                procurement_delay_ratio = 0

            if critical_procurement > 0:

                score_breakdown[
                    "procurement"
                ] = 15

            elif procurement_delay_ratio >= 0.75:

                score_breakdown[
                    "procurement"
                ] = 10

            elif procurement_delay_ratio >= 0.25:

                score_breakdown[
                    "procurement"
                ] = 5

            # ------------------------------------------------
            # DATA QUALITY — MAX 5
            # ------------------------------------------------

            if cost_anomalies > 0:

                score_breakdown[
                    "data_quality"
                ] = 5

            attention_score = sum(
                score_breakdown.values()
            )

            # ------------------------------------------------
            # COMPONENT DETAIL
            # ------------------------------------------------

            score_components = {
                key: {
                    "score": (
                        score_breakdown[
                            key
                        ]
                    ),
                    "maximum": (
                        ATTENTION_SCORE_LIMITS[
                            key
                        ]
                    ),
                }
                for key in (
                    ATTENTION_SCORE_LIMITS
                )
            }

            # ------------------------------------------------
            # ATTENTION LEVEL
            # ------------------------------------------------

            if (
                attention_score
                >=
                ATTENTION_THRESHOLDS[
                    "critical"
                ]
            ):

                attention_level = (
                    "Critical"
                )

            elif (
                attention_score
                >=
                ATTENTION_THRESHOLDS[
                    "watch"
                ]
            ):

                attention_level = (
                    "Watch"
                )

            elif cost_anomalies > 0:

                attention_level = (
                    "Review"
                )

            else:

                attention_level = (
                    "Stable"
                )

            # ------------------------------------------------
            # PRIMARY DRIVER
            # ------------------------------------------------

            driver_labels = {
                "cost": (
                    "Cost"
                ),
                "progress": (
                    "Progress"
                ),
                "critical_schedule": (
                    "Critical Schedule"
                ),
                "procurement": (
                    "Procurement"
                ),
                "data_quality": (
                    "Data Quality"
                ),
            }

            primary_driver_key = max(
                score_breakdown,
                key=score_breakdown.get,
            )

            if attention_score == 0:

                primary_driver = (
                    "No material exception"
                )

            else:

                primary_driver = (
                    driver_labels[
                        primary_driver_key
                    ]
                )

            ranking.append(
                {
                    "project_code": (
                        project_code
                    ),
                    "project_name": (
                        project[
                            "project_name"
                        ]
                    ),
                    "management_status": (
                        project[
                            "management_status"
                        ]
                    ),
                    "attention_score": (
                        attention_score
                    ),
                    "attention_score_maximum": (
                        ATTENTION_SCORE_MAXIMUM
                    ),
                    "attention_level": (
                        attention_level
                    ),
                    "primary_driver": (
                        primary_driver
                    ),
                    "forecast_variance_pct": (
                        round(
                            forecast_variance_pct,
                            2,
                        )
                    ),
                    "progress_variance_pct": (
                        round(
                            progress_variance_pct,
                            2,
                        )
                    ),
                    "delayed_activities": (
                        delayed_activities
                    ),
                    "critical_delayed_activities": (
                        critical_delayed
                    ),
                    "delayed_procurement": (
                        delayed_procurement
                    ),
                    "critical_procurement_delays": (
                        critical_procurement
                    ),
                    "cost_anomalies": (
                        cost_anomalies
                    ),
                    "score_breakdown": (
                        score_breakdown
                    ),
                    "score_components": (
                        score_components
                    ),
                }
            )

        # ----------------------------------------------------
        # SORT + RANK
        # ----------------------------------------------------

        ranking.sort(
            key=lambda item: (
                item[
                    "attention_score"
                ]
            ),
            reverse=True,
        )

        for index, project in enumerate(
            ranking,
            start=1,
        ):

            project[
                "rank"
            ] = index

        # ----------------------------------------------------
        # PORTFOLIO SUMMARY
        # ----------------------------------------------------

        summary = {
            "total_projects": len(
                ranking
            ),
            "critical_projects": sum(
                1
                for project in ranking
                if project[
                    "attention_level"
                ]
                ==
                "Critical"
            ),
            "watch_projects": sum(
                1
                for project in ranking
                if project[
                    "attention_level"
                ]
                ==
                "Watch"
            ),
            "review_projects": sum(
                1
                for project in ranking
                if project[
                    "attention_level"
                ]
                ==
                "Review"
            ),
            "stable_projects": sum(
                1
                for project in ranking
                if project[
                    "attention_level"
                ]
                ==
                "Stable"
            ),
        }

        # ----------------------------------------------------
        # METHODOLOGY
        # ----------------------------------------------------

        methodology = {
            "name": (
                "Management Attention Index"
            ),
            "description": (
                ATTENTION_SCORE_DESCRIPTION
            ),
            "maximum_score": (
                ATTENTION_SCORE_MAXIMUM
            ),
            "component_limits": (
                ATTENTION_SCORE_LIMITS
            ),
            "attention_thresholds": {
                "critical": (
                    "60–100"
                ),
                "watch": (
                    "30–59"
                ),
                "review": (
                    "Below 30 with a "
                    "data-quality anomaly"
                ),
                "stable": (
                    "Below 30 with no "
                    "data-quality anomaly"
                ),
            },
            "component_rules": {
                "cost": {
                    "maximum": 30,
                    "rules": [
                        {
                            "condition": (
                                "Forecast overrun "
                                ">= 10%"
                            ),
                            "score": 30,
                        },
                        {
                            "condition": (
                                "Forecast overrun "
                                ">= 5% and < 10%"
                            ),
                            "score": 20,
                        },
                        {
                            "condition": (
                                "Forecast overrun "
                                ">= 1% and < 5%"
                            ),
                            "score": 10,
                        },
                        {
                            "condition": (
                                "Forecast overrun "
                                "< 1%"
                            ),
                            "score": 0,
                        },
                    ],
                },
                "progress": {
                    "maximum": 25,
                    "rules": [
                        {
                            "condition": (
                                "Progress lag "
                                ">= 10 pp"
                            ),
                            "score": 25,
                        },
                        {
                            "condition": (
                                "Progress lag "
                                ">= 5 pp and < 10 pp"
                            ),
                            "score": 15,
                        },
                        {
                            "condition": (
                                "Progress lag "
                                ">= 1 pp and < 5 pp"
                            ),
                            "score": 5,
                        },
                        {
                            "condition": (
                                "Progress lag "
                                "< 1 pp"
                            ),
                            "score": 0,
                        },
                    ],
                },
                "critical_schedule": {
                    "maximum": 25,
                    "rules": [
                        {
                            "condition": (
                                "At least 50% of "
                                "critical activities "
                                "are delayed"
                            ),
                            "score": 25,
                        },
                        {
                            "condition": (
                                "One or more critical "
                                "activities are delayed"
                            ),
                            "score": 15,
                        },
                        {
                            "condition": (
                                "No critical activity "
                                "delay"
                            ),
                            "score": 0,
                        },
                    ],
                },
                "procurement": {
                    "maximum": 15,
                    "rules": [
                        {
                            "condition": (
                                "One or more critical "
                                "procurement delays"
                            ),
                            "score": 15,
                        },
                        {
                            "condition": (
                                "At least 75% of "
                                "procurement items "
                                "are delayed"
                            ),
                            "score": 10,
                        },
                        {
                            "condition": (
                                "At least 25% and "
                                "less than 75% of "
                                "procurement items "
                                "are delayed"
                            ),
                            "score": 5,
                        },
                        {
                            "condition": (
                                "Less than 25% delayed "
                                "with no critical delay"
                            ),
                            "score": 0,
                        },
                    ],
                },
                "data_quality": {
                    "maximum": 5,
                    "rules": [
                        {
                            "condition": (
                                "One or more retained "
                                "cost anomalies"
                            ),
                            "score": 5,
                        },
                        {
                            "condition": (
                                "No retained cost "
                                "anomaly"
                            ),
                            "score": 0,
                        },
                    ],
                },
            },
        }

        return {
            "methodology": (
                ATTENTION_SCORE_DESCRIPTION
            ),
            "scoring_methodology": (
                methodology
            ),
            "summary": (
                summary
            ),
            "projects": (
                ranking
            ),
        }