from pathlib import Path
import csv
import sqlite3
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.backend.workflow import router as workflow_router
from src.backend.upload import router as upload_router
from src.backend.attention import router as attention_router
from src.backend.change_control import router as change_control_router
from src.backend.risk_cashflow import router as risk_cashflow_router
from src.backend.report_pack import router as report_pack_router


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="ControlSight API",
    description=(
        "Backend API for the ControlSight "
        "project controls intelligence platform"
    ),
    version="1.3.1",
)

app.include_router(
    workflow_router
)

app.include_router(
    upload_router
)

app.include_router(
    attention_router
)

app.include_router(
    change_control_router
)

app.include_router(
    risk_cashflow_router
)

app.include_router(
    report_pack_router
)


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

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


FORECAST_CREDIBILITY_THRESHOLDS = {
    "watch": 5.0,
    "high": 10.0,
    "critical": 20.0,
}


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_db_connection():

    if not DATABASE_PATH.exists():

        raise FileNotFoundError(
            f"Database not found at: "
            f"{DATABASE_PATH}"
        )

    connection = sqlite3.connect(
        DATABASE_PATH
    )

    connection.row_factory = (
        sqlite3.Row
    )

    return connection


# ============================================================
# VALIDATION METRICS
# ============================================================

def get_validation_metrics():

    if not ETL_AUDIT_PATH.exists():

        return {
            "source_rows": None,
            "accepted_rows": None,
            "quarantined_rows": None,
            "validation_pass_rate": None,
            "formula": (
                "accepted_rows / "
                "source_rows * 100"
            ),
            "source": (
                "etl_audit_report.csv"
            ),
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
        "source_rows":
            source_rows,

        "accepted_rows":
            accepted_rows,

        "quarantined_rows":
            quarantined_rows,

        "validation_pass_rate":
            validation_pass_rate,

        "formula":
            (
                "accepted_rows / "
                "source_rows * 100"
            ),

        "source":
            "etl_audit_report.csv",

        "available":
            True,
    }


# ============================================================
# REPORTING PERIOD HELPERS
# ============================================================

def validate_reporting_period(
    connection,
    reporting_period: Optional[str],
):

    if reporting_period is None:
        return None


    row = connection.execute(
        """
        SELECT 1

        FROM fact_cost fc

        JOIN dim_date dd
            ON fc.date_key
            = dd.date_key

        WHERE dd.year_month = ?

        LIMIT 1
        """,
        (
            reporting_period,
        ),
    ).fetchone()


    if row is None:

        raise HTTPException(
            status_code=404,
            detail=(
                f"Reporting period "
                f"{reporting_period} "
                "not found"
            ),
        )


    return reporting_period


def get_latest_reporting_period(
    connection,
    project_code: Optional[str] = None,
):

    if project_code:

        row = connection.execute(
            """
            SELECT
                dd.date,
                dd.year_month

            FROM fact_cost fc

            JOIN dim_date dd
                ON fc.date_key
                = dd.date_key

            WHERE fc.project_code = ?

            ORDER BY dd.date DESC

            LIMIT 1
            """,
            (
                project_code,
            ),
        ).fetchone()

    else:

        row = connection.execute(
            """
            SELECT
                dd.date,
                dd.year_month

            FROM fact_cost fc

            JOIN dim_date dd
                ON fc.date_key
                = dd.date_key

            ORDER BY dd.date DESC

            LIMIT 1
            """
        ).fetchone()


    if row is None:
        return None


    return dict(
        row
    )


def get_period_cost_snapshot(
    connection,
    project_code: str,
    reporting_period: str,
):

    row = connection.execute(
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
                ) AS forecast_at_completion

            FROM fact_cost fc

            JOIN dim_date dd
                ON fc.date_key
                = dd.date_key

            WHERE
                fc.project_code = ?
                AND dd.year_month <= ?

            GROUP BY
                fc.project_code,
                dd.date,
                dd.year_month
        ),

        cumulative AS (

            SELECT
                project_code,
                date,
                year_month,

                SUM(
                    monthly_planned_cost
                ) OVER (
                    ORDER BY date
                )
                AS cumulative_planned_cost,

                SUM(
                    monthly_actual_cost
                ) OVER (
                    ORDER BY date
                )
                AS cumulative_actual_cost,

                SUM(
                    monthly_committed_cost
                ) OVER (
                    ORDER BY date
                )
                AS cumulative_committed_cost,

                forecast_at_completion

            FROM monthly_cost
        )

        SELECT *

        FROM cumulative

        WHERE year_month = ?

        ORDER BY date DESC

        LIMIT 1
        """,
        (
            project_code,
            reporting_period,
            reporting_period,
        ),
    ).fetchone()


    if row is None:
        return None


    return dict(
        row
    )


def get_period_progress_snapshot(
    connection,
    project_code: str,
    reporting_period: str,
):

    row = connection.execute(
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

        JOIN dim_date dd
            ON fp.date_key
            = dd.date_key

        WHERE
            fp.project_code = ?
            AND dd.year_month = ?

        ORDER BY dd.date DESC

        LIMIT 1
        """,
        (
            project_code,
            reporting_period,
        ),
    ).fetchone()


    if row is None:
        return None


    return dict(
        row
    )


# ============================================================
# FORECAST CREDIBILITY HELPER
# ============================================================

def calculate_forecast_credibility(
    actual_cost,
    actual_progress_pct,
    reported_fac,
):

    actual_cost = float(
        actual_cost
        or 0
    )

    actual_progress_pct = float(
        actual_progress_pct
        or 0
    )

    reported_fac = float(
        reported_fac
        or 0
    )


    if (
        actual_progress_pct <= 0
        or
        reported_fac <= 0
    ):

        return {

            "progress_implied_eac":
                None,

            "forecast_credibility_gap":
                None,

            "forecast_credibility_gap_pct":
                None,

            "forecast_credibility_status":
                "Unavailable",

            "forecast_credibility_flag":
                0,
        }


    progress_implied_eac = (
        actual_cost
        /
        (
            actual_progress_pct
            /
            100
        )
    )


    forecast_credibility_gap = (
        progress_implied_eac
        -
        reported_fac
    )


    forecast_credibility_gap_pct = (
        forecast_credibility_gap
        /
        reported_fac
        *
        100
    )


    positive_gap_pct = max(
        forecast_credibility_gap_pct,
        0,
    )


    if (
        positive_gap_pct
        >=
        FORECAST_CREDIBILITY_THRESHOLDS[
            "critical"
        ]
    ):

        status = "Critical"

    elif (
        positive_gap_pct
        >=
        FORECAST_CREDIBILITY_THRESHOLDS[
            "high"
        ]
    ):

        status = "High"

    elif (
        positive_gap_pct
        >=
        FORECAST_CREDIBILITY_THRESHOLDS[
            "watch"
        ]
    ):

        status = "Watch"

    else:

        status = "Normal"


    return {

        "progress_implied_eac":
            round(
                progress_implied_eac,
                2,
            ),

        "forecast_credibility_gap":
            round(
                forecast_credibility_gap,
                2,
            ),

        "forecast_credibility_gap_pct":
            round(
                forecast_credibility_gap_pct,
                2,
            ),

        "forecast_credibility_status":
            status,

        "forecast_credibility_flag":
            int(
                status != "Normal"
            ),
    }



# ============================================================
# PERIOD-AWARE PROJECT SNAPSHOT
# ============================================================

def build_project_snapshot(
    connection,
    project_row,
    reporting_period: Optional[str] = None,
):

    project = dict(
        project_row
    )


    if reporting_period is None:

        return project


    project_code = (
        project[
            "project_code"
        ]
    )


    cost = get_period_cost_snapshot(
        connection,
        project_code,
        reporting_period,
    )


    if cost is None:

        return None


    progress = get_period_progress_snapshot(
        connection,
        project_code,
        reporting_period,
    )


    budget = float(
        project.get(
            "approved_budget"
        )
        or 0
    )


    actual_cost = float(
        cost.get(
            "cumulative_actual_cost"
        )
        or 0
    )


    committed_cost = float(
        cost.get(
            "cumulative_committed_cost"
        )
        or 0
    )


    fac = float(
        cost.get(
            "forecast_at_completion"
        )
        or 0
    )


    forecast_variance = (
        budget
        -
        fac
    )


    forecast_variance_pct = (
        forecast_variance
        /
        budget
        *
        100
        if budget > 0
        else 0
    )


    project.update(
        {
            "actual_cost_to_date":
                round(
                    actual_cost,
                    2,
                ),

            "committed_cost_to_date":
                round(
                    committed_cost,
                    2,
                ),

            "forecast_at_completion":
                round(
                    fac,
                    2,
                ),

            "forecast_variance":
                round(
                    forecast_variance,
                    2,
                ),

            "forecast_variance_pct":
                round(
                    forecast_variance_pct,
                    2,
                ),

            "reporting_period":
                reporting_period,
        }
    )


    if progress is not None:

        planned_progress = float(
            progress.get(
                "planned_progress_pct"
            )
            or 0
        )

        actual_progress = float(
            progress.get(
                "actual_progress_pct"
            )
            or 0
        )

        progress_variance = (
            actual_progress
            -
            planned_progress
        )


        project.update(
            {
                "planned_progress_pct":
                    round(
                        planned_progress,
                        2,
                    ),

                "actual_progress_pct":
                    round(
                        actual_progress,
                        2,
                    ),

                "progress_variance_pct":
                    round(
                        progress_variance,
                        2,
                    ),
            }
        )


    project.update(
        calculate_forecast_credibility(
            project.get(
                "actual_cost_to_date"
            ),
            project.get(
                "actual_progress_pct"
            ),
            project.get(
                "forecast_at_completion"
            ),
        )
    )


    return project



# ============================================================
# FRONTEND
# ============================================================

@app.get("/")
def dashboard():

    return FileResponse(
        FRONTEND_PATH
        /
        "index.html"
    )


app.mount(
    "/css",
    StaticFiles(
        directory=(
            FRONTEND_PATH
            /
            "css"
        )
    ),
    name="css",
)


app.mount(
    "/js",
    StaticFiles(
        directory=(
            FRONTEND_PATH
            /
            "js"
        )
    ),
    name="js",
)


# ============================================================
# PORTFOLIO KPIs
# ============================================================

@app.get(
    "/api/kpis"
)
def get_portfolio_kpis(
    reporting_period: Optional[str] = None,
):

    try:

        with get_db_connection() as connection:

            validate_reporting_period(
                connection,
                reporting_period,
            )


            if reporting_period is None:

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
                            "No portfolio KPI "
                            "record found"
                        ),
                    )


                return dict(
                    row
                )


            rows = connection.execute(
                """
                SELECT *

                FROM report_management_scorecard

                ORDER BY project_code
                """
            ).fetchall()


            snapshots = []

            for row in rows:

                snapshot = build_project_snapshot(
                    connection,
                    row,
                    reporting_period,
                )

                if snapshot is not None:
                    snapshots.append(
                        snapshot
                    )


            if not snapshots:

                raise HTTPException(
                    status_code=404,
                    detail=(
                        "No project snapshots "
                        f"found for {reporting_period}"
                    ),
                )


            total_budget = sum(
                float(
                    project.get(
                        "approved_budget"
                    )
                    or 0
                )
                for project in snapshots
            )

            actual_cost = sum(
                float(
                    project.get(
                        "actual_cost_to_date"
                    )
                    or 0
                )
                for project in snapshots
            )

            fac = sum(
                float(
                    project.get(
                        "forecast_at_completion"
                    )
                    or 0
                )
                for project in snapshots
            )

            forecast_variance = (
                total_budget
                -
                fac
            )

            forecast_variance_pct = (
                forecast_variance
                /
                total_budget
                *
                100
                if total_budget > 0
                else 0
            )

            planned_values = [
                float(
                    project.get(
                        "planned_progress_pct"
                    )
                    or 0
                )
                for project in snapshots
            ]

            actual_values = [
                float(
                    project.get(
                        "actual_progress_pct"
                    )
                    or 0
                )
                for project in snapshots
            ]

            average_planned = (
                sum(planned_values)
                /
                len(planned_values)
            )

            average_actual = (
                sum(actual_values)
                /
                len(actual_values)
            )

            return {
                "total_budget":
                    round(
                        total_budget,
                        2,
                    ),

                "actual_cost_to_date":
                    round(
                        actual_cost,
                        2,
                    ),

                "forecast_at_completion":
                    round(
                        fac,
                        2,
                    ),

                "forecast_variance":
                    round(
                        forecast_variance,
                        2,
                    ),

                "forecast_variance_pct":
                    round(
                        forecast_variance_pct,
                        2,
                    ),

                "planned_progress_pct":
                    round(
                        average_planned,
                        2,
                    ),

                "actual_progress_pct":
                    round(
                        average_actual,
                        2,
                    ),

                "progress_variance_pct":
                    round(
                        average_actual
                        -
                        average_planned,
                        2,
                    ),

                "reporting_period":
                    reporting_period,
            }


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

@app.get(
    "/api/projects"
)
def get_projects(
    reporting_period: Optional[str] = None,
):

    with get_db_connection() as connection:

        validate_reporting_period(
            connection,
            reporting_period,
        )


        rows = connection.execute(
            """
            SELECT *

            FROM report_management_scorecard

            ORDER BY project_code
            """
        ).fetchall()


        if reporting_period is None:

            return [
                dict(row)
                for row in rows
            ]


        projects = []

        for row in rows:

            snapshot = build_project_snapshot(
                connection,
                row,
                reporting_period,
            )

            if snapshot is not None:

                projects.append(
                    snapshot
                )


        return projects


# ============================================================
# REPORTING PERIODS
# ============================================================

@app.get(
    "/api/reporting-periods"
)
def get_reporting_periods():

    with get_db_connection() as connection:

        rows = connection.execute(
            """
            SELECT DISTINCT
                dd.date,
                dd.year_month

            FROM fact_cost fc

            JOIN dim_date dd
                ON fc.date_key
                = dd.date_key

            ORDER BY dd.date DESC
            """
        ).fetchall()


        periods = [
            dict(row)
            for row in rows
        ]


        return {

            "period_count":
                len(periods),

            "default_reporting_period":
                (
                    periods[0]
                    if periods
                    else None
                ),

            "periods":
                periods,
        }


# ============================================================
# DATA QUALITY
# ============================================================

@app.get(
    "/api/data-quality"
)
def get_data_quality():

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

            "source_rows":
                validation[
                    "source_rows"
                ],

            "accepted_rows":
                validation[
                    "accepted_rows"
                ],

            "quarantined_rows":
                validation[
                    "quarantined_rows"
                ],

            "issue_events":
                issue_events,

            "total_issues":
                issue_events,

            "validation_pass_rate":
                validation[
                    "validation_pass_rate"
                ],

            "validation_formula":
                validation[
                    "formula"
                ],

            "validation_source":
                validation[
                    "source"
                ],

            "validation_metrics_available":
                validation[
                    "available"
                ],

            "summary":
                [
                    dict(row)
                    for row in summary
                ],

            "issues":
                [
                    dict(row)
                    for row in issues
                ],
        }


# ============================================================
# COST ANOMALIES
# ============================================================

@app.get(
    "/api/cost-anomalies"
)
def get_cost_anomalies():

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
                    -
                fc.planned_cost
                    AS cost_over_plan,

                ROUND(
                    fc.actual_cost
                    /
                    NULLIF(
                        fc.planned_cost,
                        0
                    ),
                    2
                )
                    AS actual_to_plan_ratio,

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

            "total_anomalies":
                len(rows),

            "anomalies":
                [
                    dict(row)
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
    project_code: str,
    reporting_period: Optional[str] = None,
):

    with get_db_connection() as connection:

        validate_reporting_period(
            connection,
            reporting_period,
        )


        where_period = ""

        parameters = [
            project_code
        ]


        if reporting_period:

            where_period = (
                "AND dd.year_month <= ?"
            )

            parameters.append(
                reporting_period
            )


        rows = connection.execute(
            f"""
            WITH monthly_cost AS (

                SELECT
                    fc.project_code,
                    dd.date,
                    dd.year_month,

                    SUM(
                        fc.planned_cost
                    )
                        AS monthly_planned_cost,

                    SUM(
                        fc.actual_cost
                    )
                        AS monthly_actual_cost,

                    SUM(
                        fc.committed_cost
                    )
                        AS monthly_committed_cost,

                    SUM(
                        fc.forecast_at_completion
                    )
                        AS forecast_at_completion,

                    SUM(
                        fc.cost_anomaly_flag
                    )
                        AS anomaly_count

                FROM fact_cost fc

                LEFT JOIN dim_date dd
                    ON fc.date_key
                    = dd.date_key

                WHERE fc.project_code = ?

                {where_period}

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
                )
                    AS monthly_planned_cost,

                ROUND(
                    monthly_actual_cost,
                    2
                )
                    AS monthly_actual_cost,

                ROUND(
                    monthly_committed_cost,
                    2
                )
                    AS monthly_committed_cost,

                ROUND(
                    SUM(
                        monthly_planned_cost
                    )
                    OVER (
                        ORDER BY date
                    ),
                    2
                )
                    AS cumulative_planned_cost,

                ROUND(
                    SUM(
                        monthly_actual_cost
                    )
                    OVER (
                        ORDER BY date
                    ),
                    2
                )
                    AS cumulative_actual_cost,

                ROUND(
                    SUM(
                        monthly_committed_cost
                    )
                    OVER (
                        ORDER BY date
                    ),
                    2
                )
                    AS cumulative_committed_cost,

                ROUND(
                    forecast_at_completion,
                    2
                )
                    AS forecast_at_completion,

                anomaly_count

            FROM monthly_cost

            ORDER BY date
            """,
            tuple(
                parameters
            ),
        ).fetchall()


        if not rows:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Project "
                    f"{project_code} "
                    "not found"
                ),
            )


        return {

            "project_code":
                project_code,

            "reporting_period":
                reporting_period,

            "periods":
                len(rows),

            "cost_trend":
                [
                    dict(row)
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
    project_code: str,
    reporting_period: Optional[str] = None,
):

    with get_db_connection() as connection:

        validate_reporting_period(
            connection,
            reporting_period,
        )


        where_period = ""

        parameters = [
            project_code
        ]


        if reporting_period:

            where_period = (
                "AND dd.year_month <= ?"
            )

            parameters.append(
                reporting_period
            )


        rows = connection.execute(
            f"""
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

            {where_period}

            ORDER BY dd.date
            """,
            tuple(
                parameters
            ),
        ).fetchall()


        if not rows:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Project "
                    f"{project_code} "
                    "not found"
                ),
            )


        return {

            "project_code":
                project_code,

            "reporting_period":
                reporting_period,

            "periods":
                len(rows),

            "progress_trend":
                [
                    dict(row)
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
    project_code: str,
):

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
                    f"Project "
                    f"{project_code} "
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
                )
                    AS critical_activities,

                SUM(
                    CASE
                        WHEN delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                )
                    AS delayed_activities,

                SUM(
                    CASE
                        WHEN
                            is_critical = 1
                            AND
                            delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                )
                    AS critical_delayed_activities,

                ROUND(
                    AVG(
                        percent_complete
                    ),
                    2
                )
                    AS average_completion_pct

            FROM fact_schedule

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()


        return {

            "project_code":
                project_code,

            "summary":
                dict(
                    summary
                ),

            "activities":
                [
                    dict(row)
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
    project_code: str,
):

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
                    f"Project "
                    f"{project_code} "
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
                )
                    AS delayed_items,

                SUM(
                    CASE
                        WHEN critical_delay_flag = 1
                        THEN 1
                        ELSE 0
                    END
                )
                    AS critical_delays,

                ROUND(
                    AVG(
                        CASE
                            WHEN delayed_delivery_flag = 1
                            THEN delivery_delay_days
                        END
                    ),
                    1
                )
                    AS avg_delay_days,

                ROUND(
                    SUM(
                        CASE
                            WHEN delayed_delivery_flag = 1
                            THEN package_value
                            ELSE 0
                        END
                    ),
                    2
                )
                    AS delayed_value

            FROM fact_procurement

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()


        return {

            "project_code":
                project_code,

            "summary":
                dict(
                    summary
                ),

            "procurement_items":
                [
                    dict(row)
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
    project_code: str,
    reporting_period: Optional[str] = None,
):

    with get_db_connection() as connection:

        validate_reporting_period(
            connection,
            reporting_period,
        )


        project_row = connection.execute(
            """
            SELECT *

            FROM report_management_scorecard

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()


        if project_row is None:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Project "
                    f"{project_code} "
                    "not found"
                ),
            )


        project = dict(
            project_row
        )


        if reporting_period:

            cost = get_period_cost_snapshot(
                connection,
                project_code,
                reporting_period,
            )


            progress = (
                get_period_progress_snapshot(
                    connection,
                    project_code,
                    reporting_period,
                )
            )


            if cost is None:

                raise HTTPException(
                    status_code=404,
                    detail=(
                        "No cost data for "
                        f"{project_code} "
                        "in "
                        f"{reporting_period}"
                    ),
                )


            project[
                "actual_cost_to_date"
            ] = round(
                float(
                    cost[
                        "cumulative_actual_cost"
                    ]
                    or 0
                ),
                2,
            )


            project[
                "committed_cost_to_date"
            ] = round(
                float(
                    cost[
                        "cumulative_committed_cost"
                    ]
                    or 0
                ),
                2,
            )


            project[
                "forecast_at_completion"
            ] = round(
                float(
                    cost[
                        "forecast_at_completion"
                    ]
                    or 0
                ),
                2,
            )


            budget = float(
                project.get(
                    "approved_budget"
                )
                or 0
            )


            fac = float(
                project.get(
                    "forecast_at_completion"
                )
                or 0
            )


            forecast_variance = (
                budget
                -
                fac
            )


            project[
                "forecast_variance"
            ] = round(
                forecast_variance,
                2,
            )


            project[
                "forecast_variance_pct"
            ] = round(
                (
                    forecast_variance
                    /
                    budget
                    *
                    100
                )
                if budget
                else 0,
                2,
            )


            if progress:

                project[
                    "planned_progress_pct"
                ] = progress[
                    "planned_progress_pct"
                ]

                project[
                    "actual_progress_pct"
                ] = progress[
                    "actual_progress_pct"
                ]

                project[
                    "progress_variance_pct"
                ] = progress[
                    "progress_variance_pct"
                ]


            credibility = (
                calculate_forecast_credibility(
                    project.get(
                        "actual_cost_to_date"
                    ),
                    project.get(
                        "actual_progress_pct"
                    ),
                    project.get(
                        "forecast_at_completion"
                    ),
                )
            )


            project.update(
                credibility
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
                )
                    AS critical_activities,

                SUM(
                    CASE
                        WHEN delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                )
                    AS delayed_activities,

                SUM(
                    CASE
                        WHEN
                            is_critical = 1
                            AND
                            delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                )
                    AS critical_delayed_activities

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

            WHERE
                project_code = ?
                AND cost_anomaly_flag = 1
            """,
            (
                project_code,
            ),
        ).fetchone()


        return {

            "reporting_period":
                reporting_period,

            "project":
                project,

            "schedule":
                dict(
                    schedule
                ),

            "data_quality":
                dict(
                    cost_quality
                ),
        }


# ============================================================
# FORECAST CREDIBILITY
# ============================================================

@app.get(
    "/api/projects/{project_code}/forecast-credibility"
)
def get_project_forecast_credibility(
    project_code: str,
    reporting_period: Optional[str] = None,
):

    with get_db_connection() as connection:

        validate_reporting_period(
            connection,
            reporting_period,
        )


        if reporting_period:

            cost = get_period_cost_snapshot(
                connection,
                project_code,
                reporting_period,
            )


            progress = (
                get_period_progress_snapshot(
                    connection,
                    project_code,
                    reporting_period,
                )
            )


            if (
                cost is None
                or
                progress is None
            ):

                raise HTTPException(
                    status_code=404,
                    detail=(
                        "No reporting snapshot "
                        f"for {project_code} "
                        f"in {reporting_period}"
                    ),
                )


            actual_cost = float(
                cost[
                    "cumulative_actual_cost"
                ]
                or 0
            )


            reported_fac = float(
                cost[
                    "forecast_at_completion"
                ]
                or 0
            )


            actual_progress = float(
                progress[
                    "actual_progress_pct"
                ]
                or 0
            )


            effective_period = (
                reporting_period
            )


        else:

            row = connection.execute(
                """
                SELECT *

                FROM report_management_scorecard

                WHERE project_code = ?
                """,
                (
                    project_code,
                ),
            ).fetchone()


            if row is None:

                raise HTTPException(
                    status_code=404,
                    detail=(
                        f"Project "
                        f"{project_code} "
                        "not found"
                    ),
                )


            row = dict(
                row
            )


            actual_cost = float(
                row.get(
                    "actual_cost_to_date"
                )
                or 0
            )


            reported_fac = float(
                row.get(
                    "forecast_at_completion"
                )
                or 0
            )


            actual_progress = float(
                row.get(
                    "actual_progress_pct"
                )
                or 0
            )


            latest = (
                get_latest_reporting_period(
                    connection,
                    project_code,
                )
            )


            effective_period = (
                latest[
                    "year_month"
                ]
                if latest
                else None
            )


        credibility = (
            calculate_forecast_credibility(
                actual_cost,
                actual_progress,
                reported_fac,
            )
        )


        return {

            "project_code":
                project_code,

            "reporting_period":
                effective_period,

            "reported_fac":
                round(
                    reported_fac,
                    2,
                ),

            "actual_cost_to_date":
                round(
                    actual_cost,
                    2,
                ),

            "actual_progress_pct":
                round(
                    actual_progress,
                    2,
                ),

            **credibility,

            "formal_evm":
                False,

            "replaces_reported_fac":
                False,

            "methodology":
                (
                    "Progress-Implied EAC = "
                    "Actual Cost to Date / "
                    "(Actual Progress % / 100). "
                    "This is a forecast sanity "
                    "check, not formal Earned "
                    "Value Management."
                ),
        }


# ============================================================
# FAC MOVEMENT
# ============================================================

@app.get(
    "/api/projects/{project_code}/fac-movement"
)
def get_project_fac_movement(
    project_code: str,
    reporting_period: Optional[str] = None,
):

    with get_db_connection() as connection:

        validate_reporting_period(
            connection,
            reporting_period,
        )


        where_period = ""

        parameters = [
            project_code
        ]


        if reporting_period:

            where_period = (
                "AND dd.year_month <= ?"
            )

            parameters.append(
                reporting_period
            )


        rows = connection.execute(
            f"""
            SELECT
                dd.date,
                dd.year_month,

                ROUND(
                    SUM(
                        fc.forecast_at_completion
                    ),
                    2
                )
                    AS fac

            FROM fact_cost fc

            JOIN dim_date dd
                ON fc.date_key
                = dd.date_key

            WHERE fc.project_code = ?

            {where_period}

            GROUP BY
                dd.date,
                dd.year_month

            ORDER BY dd.date
            """,
            tuple(
                parameters
            ),
        ).fetchall()


        if len(rows) < 2:

            raise HTTPException(
                status_code=404,
                detail=(
                    "Insufficient FAC history "
                    f"for {project_code}"
                ),
            )


        previous = rows[
            -2
        ]

        current = rows[
            -1
        ]


        previous_fac = float(
            previous[
                "fac"
            ]
            or 0
        )


        current_fac = float(
            current[
                "fac"
            ]
            or 0
        )


        fac_change = (
            current_fac
            -
            previous_fac
        )


        fac_change_pct = (
            fac_change
            /
            previous_fac
            *
            100
            if previous_fac
            else 0
        )


        if fac_change > 0.005:

            movement_direction = (
                "Deteriorated"
            )

            interpretation = (
                "Forecast at Completion "
                "increased versus the "
                "previous reporting period."
            )


        elif fac_change < -0.005:

            movement_direction = (
                "Improved"
            )

            interpretation = (
                "Forecast at Completion "
                "decreased versus the "
                "previous reporting period."
            )


        else:

            movement_direction = (
                "Stable"
            )

            interpretation = (
                "Forecast at Completion is "
                "broadly unchanged versus "
                "the previous reporting period."
            )


        return {

            "project_code":
                project_code,

            "previous_reporting_date":
                previous[
                    "date"
                ],

            "previous_reporting_period":
                previous[
                    "year_month"
                ],

            "current_reporting_date":
                current[
                    "date"
                ],

            "current_reporting_period":
                current[
                    "year_month"
                ],

            "previous_fac":
                round(
                    previous_fac,
                    2,
                ),

            "current_fac":
                round(
                    current_fac,
                    2,
                ),

            "fac_change":
                round(
                    fac_change,
                    2,
                ),

            "fac_change_pct":
                round(
                    fac_change_pct,
                    2,
                ),

            "movement_direction":
                movement_direction,

            "interpretation":
                interpretation,
        }


# ============================================================
# MANAGEMENT INSIGHTS
# ============================================================

@app.get(
    "/api/projects/{project_code}/management-insights"
)
def get_project_management_insights(
    project_code: str,
    reporting_period: Optional[str] = None,
):

    with get_db_connection() as connection:

        validate_reporting_period(
            connection,
            reporting_period,
        )

        project_row = connection.execute(
            """
            SELECT *

            FROM report_management_scorecard

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()


        if project_row is None:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Project "
                    f"{project_code} "
                    "not found"
                ),
            )


        project = build_project_snapshot(
            connection,
            project_row,
            reporting_period,
        )


        if project is None:

            raise HTTPException(
                status_code=404,
                detail=(
                    "No reporting snapshot for "
                    f"{project_code} "
                    f"in {reporting_period}"
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
                )
                    AS delayed_activities,

                SUM(
                    CASE
                        WHEN is_critical = 1
                        THEN 1
                        ELSE 0
                    END
                )
                    AS critical_activities,

                SUM(
                    CASE
                        WHEN
                            is_critical = 1
                            AND
                            delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                )
                    AS critical_delayed_activities

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
                )
                    AS delayed_items,

                SUM(
                    CASE
                        WHEN critical_delay_flag = 1
                        THEN 1
                        ELSE 0
                    END
                )
                    AS critical_delays

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

            WHERE
                project_code = ?
                AND cost_anomaly_flag = 1
            """,
            (
                project_code,
            ),
        ).fetchone()


        forecast_variance = float(
            project.get(
                "forecast_variance"
            )
            or 0
        )


        forecast_variance_pct = float(
            project.get(
                "forecast_variance_pct"
            )
            or 0
        )


        progress_variance = float(
            project.get(
                "progress_variance_pct"
            )
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
        # ----------------------------------------------------

        if forecast_variance_pct <= -10:

            insights.append(
                {
                    "category":
                        "Cost",

                    "severity":
                        "critical",

                    "title":
                        "Significant forecast overrun",

                    "message":
                        (
                            "Forecast at completion "
                            f"is £{abs(forecast_variance):,.0f} "
                            "over approved budget "
                            f"({abs(forecast_variance_pct):.1f}%)."
                        ),
                }
            )


        elif forecast_variance_pct <= -5:

            insights.append(
                {
                    "category":
                        "Cost",

                    "severity":
                        "warning",

                    "title":
                        "Forecast pressure",

                    "message":
                        (
                            "Forecast at completion "
                            f"is £{abs(forecast_variance):,.0f} "
                            "over approved budget "
                            f"({abs(forecast_variance_pct):.1f}%)."
                        ),
                }
            )


        elif forecast_variance > 0:

            insights.append(
                {
                    "category":
                        "Cost",

                    "severity":
                        "positive",

                    "title":
                        "Forecast within budget",

                    "message":
                        (
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
                    "category":
                        "Schedule",

                    "severity":
                        "critical",

                    "title":
                        "Material schedule slippage",

                    "message":
                        (
                            "Actual progress is "
                            f"{abs(progress_variance):.1f} "
                            "percentage points "
                            "behind plan."
                        ),
                }
            )


        elif progress_variance <= -5:

            insights.append(
                {
                    "category":
                        "Schedule",

                    "severity":
                        "warning",

                    "title":
                        "Progress behind plan",

                    "message":
                        (
                            "Actual progress is "
                            f"{abs(progress_variance):.1f} "
                            "percentage points "
                            "behind plan."
                        ),
                }
            )


        elif progress_variance >= 0:

            insights.append(
                {
                    "category":
                        "Schedule",

                    "severity":
                        "positive",

                    "title":
                        "Progress on or ahead of plan",

                    "message":
                        (
                            "Actual progress is "
                            f"{progress_variance:.1f} "
                            "percentage points "
                            "ahead of plan."
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
                    "category":
                        "Schedule",

                    "severity":
                        "critical",

                    "title":
                        "Critical activities delayed",

                    "message":
                        message,
                }
            )


        elif delayed_activities > 0:

            insights.append(
                {
                    "category":
                        "Schedule",

                    "severity":
                        "warning",

                    "title":
                        "Activity delays detected",

                    "message":
                        (
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
                    "category":
                        "Procurement",

                    "severity":
                        "critical",

                    "title":
                        "Critical procurement delay",

                    "message":
                        (
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
                    "category":
                        "Procurement",

                    "severity":
                        "warning",

                    "title":
                        "Procurement delays detected",

                    "message":
                        (
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
                    "category":
                        "Data Quality",

                    "severity":
                        "data",

                    "title":
                        "Cost data requires review",

                    "message":
                        (
                            f"{cost_anomalies} "
                            f"flagged cost {anomaly_word} "
                            "should be reviewed before "
                            "relying on reported "
                            "cost performance."
                        ),
                }
            )


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


        project_name = (
            project.get(
                "project_name",
                project_code,
            )
        )


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

            "project_code":
                project_code,

            "reporting_period":
                reporting_period,

            "project_name":
                project_name,

            "management_status":
                project.get(
                    "management_status"
                ),

            "attention_level":
                attention_level,

            "executive_summary":
                executive_summary,

            "insight_count":
                len(
                    insights
                ),

            "insights":
                insights,
        }


# ============================================================
# PORTFOLIO ATTENTION RANKING
# ============================================================

@app.get(
    "/api/portfolio/attention-ranking"
)
def get_portfolio_attention_ranking(
    reporting_period: Optional[str] = None,
):

    with get_db_connection() as connection:

        validate_reporting_period(
            connection,
            reporting_period,
        )


        project_rows = connection.execute(
            """
            SELECT *

            FROM report_management_scorecard

            ORDER BY project_code
            """
        ).fetchall()


        ranking = []


        for project_row in project_rows:

            project = build_project_snapshot(
                connection,
                project_row,
                reporting_period,
            )


            if project is None:
                continue


            project_code = (
                project[
                    "project_code"
                ]
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
                    )
                        AS delayed_activities,

                    SUM(
                        CASE
                            WHEN is_critical = 1
                            THEN 1
                            ELSE 0
                        END
                    )
                        AS critical_activities,

                    SUM(
                        CASE
                            WHEN
                                is_critical = 1
                                AND
                                delayed_activity_flag = 1
                            THEN 1
                            ELSE 0
                        END
                    )
                        AS critical_delayed_activities

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
                    )
                        AS delayed_items,

                    SUM(
                        CASE
                            WHEN critical_delay_flag = 1
                            THEN 1
                            ELSE 0
                        END
                    )
                        AS critical_delays

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

                WHERE
                    project_code = ?
                    AND cost_anomaly_flag = 1
                """,
                (
                    project_code,
                ),
            ).fetchone()


            forecast_variance_pct = float(
                project.get(
                    "forecast_variance_pct"
                )
                or 0
            )


            progress_variance_pct = float(
                project.get(
                    "progress_variance_pct"
                )
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


            score_breakdown = {
                "cost": 0,
                "progress": 0,
                "critical_schedule": 0,
                "procurement": 0,
                "data_quality": 0,
            }


            # -----------------------------------------------
            # COST
            # -----------------------------------------------

            cost_overrun_pct = max(
                0,
                -
                forecast_variance_pct,
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


            # -----------------------------------------------
            # PROGRESS
            # -----------------------------------------------

            progress_lag = max(
                0,
                -
                progress_variance_pct,
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


            # -----------------------------------------------
            # CRITICAL SCHEDULE
            # -----------------------------------------------

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


            # -----------------------------------------------
            # PROCUREMENT
            # -----------------------------------------------

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


            # -----------------------------------------------
            # DATA QUALITY
            # -----------------------------------------------

            if cost_anomalies > 0:

                score_breakdown[
                    "data_quality"
                ] = 5


            attention_score = sum(
                score_breakdown.values()
            )


            score_components = {

                key: {

                    "score":
                        score_breakdown[
                            key
                        ],

                    "maximum":
                        ATTENTION_SCORE_LIMITS[
                            key
                        ],
                }

                for key
                in ATTENTION_SCORE_LIMITS
            }


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


            driver_labels = {

                "cost":
                    "Cost",

                "progress":
                    "Progress",

                "critical_schedule":
                    "Critical Schedule",

                "procurement":
                    "Procurement",

                "data_quality":
                    "Data Quality",
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

                    "project_code":
                        project_code,

                    "project_name":
                        project.get(
                            "project_name"
                        ),

                    "management_status":
                        project.get(
                            "management_status"
                        ),

                    "attention_score":
                        attention_score,

                    "attention_score_maximum":
                        ATTENTION_SCORE_MAXIMUM,

                    "attention_level":
                        attention_level,

                    "primary_driver":
                        primary_driver,

                    "forecast_variance_pct":
                        round(
                            forecast_variance_pct,
                            2,
                        ),

                    "progress_variance_pct":
                        round(
                            progress_variance_pct,
                            2,
                        ),

                    "delayed_activities":
                        delayed_activities,

                    "critical_delayed_activities":
                        critical_delayed,

                    "delayed_procurement":
                        delayed_procurement,

                    "critical_procurement_delays":
                        critical_procurement,

                    "cost_anomalies":
                        cost_anomalies,

                    "score_breakdown":
                        score_breakdown,

                    "score_components":
                        score_components,
                }
            )


        ranking.sort(
            key=lambda item:
                item[
                    "attention_score"
                ],
            reverse=True,
        )


        for index, project in enumerate(
            ranking,
            start=1,
        ):

            project[
                "rank"
            ] = index


        summary = {

            "total_projects":
                len(
                    ranking
                ),

            "critical_projects":
                sum(
                    1
                    for project in ranking
                    if project[
                        "attention_level"
                    ]
                    ==
                    "Critical"
                ),

            "watch_projects":
                sum(
                    1
                    for project in ranking
                    if project[
                        "attention_level"
                    ]
                    ==
                    "Watch"
                ),

            "review_projects":
                sum(
                    1
                    for project in ranking
                    if project[
                        "attention_level"
                    ]
                    ==
                    "Review"
                ),

            "stable_projects":
                sum(
                    1
                    for project in ranking
                    if project[
                        "attention_level"
                    ]
                    ==
                    "Stable"
                ),
        }


        methodology = {

            "name":
                "Management Attention Index",

            "description":
                ATTENTION_SCORE_DESCRIPTION,

            "maximum_score":
                ATTENTION_SCORE_MAXIMUM,

            "component_limits":
                ATTENTION_SCORE_LIMITS,

            "attention_thresholds": {

                "critical":
                    "60–100",

                "watch":
                    "30–59",

                "review":
                    (
                        "Below 30 with a "
                        "data-quality anomaly"
                    ),

                "stable":
                    (
                        "Below 30 with no "
                        "data-quality anomaly"
                    ),
            },
        }


        return {

            "methodology":
                ATTENTION_SCORE_DESCRIPTION,

            "scoring_methodology":
                methodology,

            "summary":
                summary,

            "projects":
                ranking,
        }
