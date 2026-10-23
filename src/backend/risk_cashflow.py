from datetime import datetime
from pathlib import Path
import sqlite3
import uuid
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/risk-cashflow",
    tags=["Contingency, Risk & Cash Flow"],
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


# ============================================================
# CONSTANTS
# ============================================================

VALID_RISK_STATUSES = {
    "Proposed",
    "Approved",
    "Drawn",
    "Rejected",
    "Cancelled",
}

VALID_RISK_CATEGORIES = {
    "Design",
    "Commercial",
    "Schedule",
    "Procurement",
    "Construction",
    "Client",
    "Regulatory",
    "Technical",
    "Other",
}

PERIOD_PATTERN = re.compile(
    r"^\d{4}-(0[1-9]|1[0-2])$"
)


# ============================================================
# DATABASE
# ============================================================

def get_connection():

    if not DATABASE_PATH.exists():

        raise HTTPException(
            status_code=500,
            detail=(
                "ControlSight database not found: "
                f"{DATABASE_PATH}"
            ),
        )

    connection = sqlite3.connect(
        DATABASE_PATH
    )

    connection.row_factory = sqlite3.Row

    return connection


# ============================================================
# TABLES
# ============================================================

def initialise_tables():

    with get_connection() as connection:

        # ----------------------------------------------------
        # CONTINGENCY BASELINE
        # ----------------------------------------------------

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS
            project_contingency_baseline (

                project_code TEXT PRIMARY KEY,

                contingency_budget REAL NOT NULL,

                source TEXT NOT NULL,

                notes TEXT,

                created_at TEXT NOT NULL,

                updated_at TEXT NOT NULL
            )
            """
        )


        # ----------------------------------------------------
        # RISK / CONTINGENCY DRAWDOWN REGISTER
        # ----------------------------------------------------

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS
            project_risk_drawdown (

                drawdown_id TEXT PRIMARY KEY,

                project_code TEXT NOT NULL,

                risk_reference TEXT NOT NULL,

                category TEXT NOT NULL,

                title TEXT NOT NULL,

                description TEXT,

                amount REAL NOT NULL,

                status TEXT NOT NULL,

                event_date TEXT,

                owner TEXT,

                approved_by TEXT,

                created_at TEXT NOT NULL,

                updated_at TEXT NOT NULL
            )
            """
        )


        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_risk_drawdown_project

            ON project_risk_drawdown(
                project_code
            )
            """
        )


        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_risk_drawdown_status

            ON project_risk_drawdown(
                status
            )
            """
        )


        # ----------------------------------------------------
        # CASH FLOW PERIODS
        # ----------------------------------------------------

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS
            project_cashflow (

                cashflow_id TEXT PRIMARY KEY,

                project_code TEXT NOT NULL,

                reporting_period TEXT NOT NULL,

                forecast_cash REAL NOT NULL
                    DEFAULT 0,

                actual_cash REAL NOT NULL
                    DEFAULT 0,

                committed_cash REAL NOT NULL
                    DEFAULT 0,

                notes TEXT,

                created_at TEXT NOT NULL,

                updated_at TEXT NOT NULL,

                UNIQUE(
                    project_code,
                    reporting_period
                )
            )
            """
        )


        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_cashflow_project_period

            ON project_cashflow(
                project_code,
                reporting_period
            )
            """
        )


        connection.commit()


# ============================================================
# PROJECT HELPERS
# ============================================================

def get_project_columns(
    connection,
):

    rows = connection.execute(
        """
        PRAGMA table_info(
            report_management_scorecard
        )
        """
    ).fetchall()

    return {
        row["name"]
        for row in rows
    }


def detect_budget_column(
    connection,
):

    columns = get_project_columns(
        connection
    )

    candidates = [
        "budget",
        "approved_budget",
        "current_budget",
        "total_budget",
        "project_budget",
    ]

    for candidate in candidates:

        if candidate in columns:
            return candidate

    raise HTTPException(
        status_code=500,
        detail=(
            "No supported project budget column "
            "found in report_management_scorecard."
        ),
    )


def get_project(
    connection,
    project_code,
):

    budget_column = (
        detect_budget_column(
            connection
        )
    )

    row = connection.execute(
        f"""
        SELECT
            project_code,
            project_name,
            {budget_column}
                AS source_budget

        FROM report_management_scorecard

        WHERE project_code = ?
        """,
        (
            project_code,
        ),
    ).fetchone()

    if not row:

        raise HTTPException(
            status_code=404,
            detail=(
                f"Project {project_code} "
                "not found."
            ),
        )

    return dict(row)


def get_projects(
    connection,
):

    budget_column = (
        detect_budget_column(
            connection
        )
    )

    rows = connection.execute(
        f"""
        SELECT
            project_code,
            project_name,
            {budget_column}
                AS source_budget

        FROM report_management_scorecard

        ORDER BY project_code
        """
    ).fetchall()

    return [
        dict(row)
        for row in rows
    ]


# ============================================================
# CHANGE CONTROL INTEGRATION
# ============================================================

def table_exists(
    connection,
    table_name,
):

    row = connection.execute(
        """
        SELECT name

        FROM sqlite_master

        WHERE
            type = 'table'
            AND
            name = ?
        """,
        (
            table_name,
        ),
    ).fetchone()

    return bool(row)


def calculate_controlled_budget(
    connection,
    project_code,
):

    project = get_project(
        connection,
        project_code,
    )

    source_budget = float(
        project["source_budget"]
        or 0
    )


    if not table_exists(
        connection,
        "project_budget_baseline",
    ):

        return {
            "original_budget":
                source_budget,

            "approved_changes":
                0.0,

            "current_budget":
                source_budget,
        }


    baseline = connection.execute(
        """
        SELECT original_budget

        FROM project_budget_baseline

        WHERE project_code = ?
        """,
        (
            project_code,
        ),
    ).fetchone()


    original_budget = (
        float(
            baseline["original_budget"]
        )
        if baseline
        else source_budget
    )


    approved_changes = 0.0


    if table_exists(
        connection,
        "project_change_log",
    ):

        row = connection.execute(
            """
            SELECT
                COALESCE(
                    SUM(change_amount),
                    0
                )
                AS approved_changes

            FROM project_change_log

            WHERE
                project_code = ?
                AND
                status = 'Approved'
            """,
            (
                project_code,
            ),
        ).fetchone()

        approved_changes = float(
            row[
                "approved_changes"
            ]
            or 0
        )


    return {

        "original_budget":
            round(
                original_budget,
                2,
            ),

        "approved_changes":
            round(
                approved_changes,
                2,
            ),

        "current_budget":
            round(
                original_budget
                +
                approved_changes,
                2,
            ),
    }


# ============================================================
# MODELS
# ============================================================

class ContingencyBaselineRequest(
    BaseModel
):

    contingency_budget: float = Field(
        ge=0,
    )

    source: str = Field(
        default="Manual project-control baseline",
        min_length=1,
        max_length=200,
    )

    notes: str | None = None


class RiskDrawdownCreate(
    BaseModel
):

    project_code: str

    risk_reference: str = Field(
        min_length=1,
        max_length=100,
    )

    category: str

    title: str = Field(
        min_length=1,
        max_length=250,
    )

    description: str | None = None

    amount: float = Field(
        gt=0,
    )

    status: str = "Proposed"

    event_date: str | None = None

    owner: str | None = None

    approved_by: str | None = None


class RiskDrawdownUpdate(
    BaseModel
):

    risk_reference: str | None = None

    category: str | None = None

    title: str | None = None

    description: str | None = None

    amount: float | None = Field(
        default=None,
        gt=0,
    )

    status: str | None = None

    event_date: str | None = None

    owner: str | None = None

    approved_by: str | None = None


class CashFlowUpsert(
    BaseModel
):

    reporting_period: str

    forecast_cash: float = Field(
        default=0,
        ge=0,
    )

    actual_cash: float = Field(
        default=0,
        ge=0,
    )

    committed_cash: float = Field(
        default=0,
        ge=0,
    )

    notes: str | None = None


class SyntheticContingencySeedRequest(
    BaseModel
):

    contingency_pct: float = Field(
        default=5.0,
        ge=0,
        le=100,
    )


# ============================================================
# VALIDATION
# ============================================================

def validate_risk_status(
    status,
):

    if status not in VALID_RISK_STATUSES:

        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid risk status. "
                f"Allowed values: "
                f"{sorted(VALID_RISK_STATUSES)}"
            ),
        )


def validate_risk_category(
    category,
):

    if category not in VALID_RISK_CATEGORIES:

        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid risk category. "
                f"Allowed values: "
                f"{sorted(VALID_RISK_CATEGORIES)}"
            ),
        )


def validate_reporting_period(
    period,
):

    if not PERIOD_PATTERN.match(
        period
    ):

        raise HTTPException(
            status_code=422,
            detail=(
                "Reporting period must use "
                "YYYY-MM format."
            ),
        )


# ============================================================
# CONTINGENCY SUMMARY
# ============================================================

def calculate_contingency_summary(
    connection,
    project_code,
):

    project = get_project(
        connection,
        project_code,
    )

    controlled_budget = (
        calculate_controlled_budget(
            connection,
            project_code,
        )
    )


    baseline = connection.execute(
        """
        SELECT *

        FROM project_contingency_baseline

        WHERE project_code = ?
        """,
        (
            project_code,
        ),
    ).fetchone()


    contingency_budget = (
        float(
            baseline[
                "contingency_budget"
            ]
        )
        if baseline
        else 0.0
    )


    rows = connection.execute(
        """
        SELECT *

        FROM project_risk_drawdown

        WHERE project_code = ?
        """,
        (
            project_code,
        ),
    ).fetchall()


    risks = [
        dict(row)
        for row in rows
    ]


    proposed = sum(
        float(
            row["amount"]
            or 0
        )
        for row in risks
        if row["status"] == "Proposed"
    )


    approved_not_drawn = sum(
        float(
            row["amount"]
            or 0
        )
        for row in risks
        if row["status"] == "Approved"
    )


    drawn = sum(
        float(
            row["amount"]
            or 0
        )
        for row in risks
        if row["status"] == "Drawn"
    )


    committed_contingency = (
        approved_not_drawn
        +
        drawn
    )


    remaining_contingency = (
        contingency_budget
        -
        committed_contingency
    )


    utilisation_pct = (
        (
            committed_contingency
            /
            contingency_budget
            *
            100
        )
        if contingency_budget > 0
        else 0.0
    )


    exposure_pct = (
        (
            proposed
            /
            contingency_budget
            *
            100
        )
        if contingency_budget > 0
        else 0.0
    )


    if contingency_budget <= 0:

        status = "Not Configured"

    elif remaining_contingency < 0:

        status = "Exceeded"

    elif utilisation_pct >= 75:

        status = "High Utilisation"

    elif utilisation_pct >= 50:

        status = "Watch"

    else:

        status = "Available"


    return {

        "project_code":
            project_code,

        "project_name":
            project[
                "project_name"
            ],

        "original_budget":
            controlled_budget[
                "original_budget"
            ],

        "approved_changes":
            controlled_budget[
                "approved_changes"
            ],

        "current_budget":
            controlled_budget[
                "current_budget"
            ],

        "contingency_budget":
            round(
                contingency_budget,
                2,
            ),

        "proposed_risk_exposure":
            round(
                proposed,
                2,
            ),

        "approved_not_drawn":
            round(
                approved_not_drawn,
                2,
            ),

        "drawn_contingency":
            round(
                drawn,
                2,
            ),

        "committed_contingency":
            round(
                committed_contingency,
                2,
            ),

        "remaining_contingency":
            round(
                remaining_contingency,
                2,
            ),

        "utilisation_pct":
            round(
                utilisation_pct,
                2,
            ),

        "proposed_exposure_pct":
            round(
                exposure_pct,
                2,
            ),

        "status":
            status,

        "risk_count":
            len(risks),

        "proposed_count":
            sum(
                1
                for row in risks
                if row["status"]
                ==
                "Proposed"
            ),

        "approved_count":
            sum(
                1
                for row in risks
                if row["status"]
                ==
                "Approved"
            ),

        "drawn_count":
            sum(
                1
                for row in risks
                if row["status"]
                ==
                "Drawn"
            ),
    }


# ============================================================
# CASH FLOW SUMMARY
# ============================================================

def get_cashflow_rows(
    connection,
    project_code,
):

    rows = connection.execute(
        """
        SELECT *

        FROM project_cashflow

        WHERE project_code = ?

        ORDER BY reporting_period
        """,
        (
            project_code,
        ),
    ).fetchall()

    return [
        dict(row)
        for row in rows
    ]


def calculate_cashflow_summary(
    connection,
    project_code,
):

    project = get_project(
        connection,
        project_code,
    )

    rows = get_cashflow_rows(
        connection,
        project_code,
    )


    cumulative_forecast = 0.0
    cumulative_actual = 0.0
    cumulative_committed = 0.0

    periods = []


    for row in rows:

        forecast_cash = float(
            row["forecast_cash"]
            or 0
        )

        actual_cash = float(
            row["actual_cash"]
            or 0
        )

        committed_cash = float(
            row["committed_cash"]
            or 0
        )


        variance = (
            actual_cash
            -
            forecast_cash
        )


        cumulative_forecast += (
            forecast_cash
        )

        cumulative_actual += (
            actual_cash
        )

        cumulative_committed += (
            committed_cash
        )


        variance_pct = (
            (
                variance
                /
                forecast_cash
                *
                100
            )
            if forecast_cash > 0
            else 0.0
        )


        if abs(
            variance_pct
        ) >= 20:

            variance_status = (
                "Material Variance"
            )

        elif abs(
            variance_pct
        ) >= 10:

            variance_status = (
                "Watch"
            )

        else:

            variance_status = (
                "Normal"
            )


        periods.append(
            {

                **row,

                "forecast_cash":
                    round(
                        forecast_cash,
                        2,
                    ),

                "actual_cash":
                    round(
                        actual_cash,
                        2,
                    ),

                "committed_cash":
                    round(
                        committed_cash,
                        2,
                    ),

                "variance":
                    round(
                        variance,
                        2,
                    ),

                "variance_pct":
                    round(
                        variance_pct,
                        2,
                    ),

                "variance_status":
                    variance_status,

                "cumulative_forecast":
                    round(
                        cumulative_forecast,
                        2,
                    ),

                "cumulative_actual":
                    round(
                        cumulative_actual,
                        2,
                    ),

                "cumulative_committed":
                    round(
                        cumulative_committed,
                        2,
                    ),
            }
        )


    total_forecast = sum(
        float(
            row["forecast_cash"]
            or 0
        )
        for row in rows
    )


    total_actual = sum(
        float(
            row["actual_cash"]
            or 0
        )
        for row in rows
    )


    total_committed = sum(
        float(
            row["committed_cash"]
            or 0
        )
        for row in rows
    )


    total_variance = (
        total_actual
        -
        total_forecast
    )


    total_variance_pct = (
        (
            total_variance
            /
            total_forecast
            *
            100
        )
        if total_forecast > 0
        else 0.0
    )


    return {

        "project_code":
            project_code,

        "project_name":
            project[
                "project_name"
            ],

        "period_count":
            len(
                rows
            ),

        "total_forecast_cash":
            round(
                total_forecast,
                2,
            ),

        "total_actual_cash":
            round(
                total_actual,
                2,
            ),

        "total_committed_cash":
            round(
                total_committed,
                2,
            ),

        "total_variance":
            round(
                total_variance,
                2,
            ),

        "total_variance_pct":
            round(
                total_variance_pct,
                2,
            ),

        "periods":
            periods,

        "important_note":
            (
                "Cash-flow values are maintained "
                "as a separate planning dataset. "
                "ControlSight does not assume "
                "accounting cost equals cash paid."
            ),
    }


# ============================================================
# INITIALISE
# ============================================================

initialise_tables()


# ============================================================
# HEALTH
# ============================================================

@router.get(
    "/health/status"
)
def health_status():

    return {

        "status":
            "ok",

        "module":
            (
                "Contingency, Risk Drawdown "
                "& Cash Flow"
            ),

        "database_available":
            DATABASE_PATH.exists(),

        "persistent":
            True,

        "cashflow_separate_from_cost":
            True,
    }


# ============================================================
# CONFIG
# ============================================================

@router.get(
    "/config"
)
def get_config():

    return {

        "risk_statuses":
            sorted(
                VALID_RISK_STATUSES
            ),

        "risk_categories":
            sorted(
                VALID_RISK_CATEGORIES
            ),

        "contingency_methodology": {

            "committed_contingency":
                (
                    "Approved but not drawn "
                    "+ Drawn contingency"
                ),

            "remaining_contingency":
                (
                    "Contingency baseline "
                    "- Committed contingency"
                ),

            "proposed_risks":
                (
                    "Shown as exposure but "
                    "do not reduce remaining "
                    "contingency until approved."
                ),
        },

        "cashflow_methodology": {

            "period_format":
                "YYYY-MM",

            "variance":
                (
                    "Actual Cash "
                    "- Forecast Cash"
                ),

            "important_note":
                (
                    "Cash flow is intentionally "
                    "separate from accounting cost "
                    "and FAC."
                ),
        },
    }


# ============================================================
# SET CONTINGENCY BASELINE
# ============================================================

@router.put(
    "/projects/{project_code}/contingency"
)
def set_contingency_baseline(
    project_code: str,
    request: ContingencyBaselineRequest,
):

    with get_connection() as connection:

        get_project(
            connection,
            project_code,
        )

        now = (
            datetime.utcnow()
            .replace(
                microsecond=0
            )
            .isoformat()
            +
            "Z"
        )


        existing = connection.execute(
            """
            SELECT project_code

            FROM project_contingency_baseline

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()


        if existing:

            connection.execute(
                """
                UPDATE project_contingency_baseline

                SET
                    contingency_budget = ?,
                    source = ?,
                    notes = ?,
                    updated_at = ?

                WHERE project_code = ?
                """,
                (
                    request.contingency_budget,
                    request.source,
                    request.notes,
                    now,
                    project_code,
                ),
            )

        else:

            connection.execute(
                """
                INSERT INTO project_contingency_baseline (

                    project_code,
                    contingency_budget,
                    source,
                    notes,
                    created_at,
                    updated_at
                )

                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    project_code,
                    request.contingency_budget,
                    request.source,
                    request.notes,
                    now,
                    now,
                ),
            )


        connection.commit()


        summary = (
            calculate_contingency_summary(
                connection,
                project_code,
            )
        )


    return {

        "message":
            "Contingency baseline saved.",

        "summary":
            summary,
    }


# ============================================================
# SYNTHETIC CONTINGENCY SEED
# ============================================================

@router.post(
    "/contingency/seed"
)
def seed_contingency(
    request: SyntheticContingencySeedRequest,
):

    with get_connection() as connection:

        projects = get_projects(
            connection
        )

        seeded = 0
        existing = 0


        for project in projects:

            project_code = (
                project[
                    "project_code"
                ]
            )


            row = connection.execute(
                """
                SELECT project_code

                FROM project_contingency_baseline

                WHERE project_code = ?
                """,
                (
                    project_code,
                ),
            ).fetchone()


            if row:

                existing += 1
                continue


            budget = (
                calculate_controlled_budget(
                    connection,
                    project_code,
                )[
                    "current_budget"
                ]
            )


            contingency = (
                budget
                *
                request.contingency_pct
                /
                100
            )


            now = (
                datetime.utcnow()
                .replace(
                    microsecond=0
                )
                .isoformat()
                +
                "Z"
            )


            connection.execute(
                """
                INSERT INTO project_contingency_baseline (

                    project_code,
                    contingency_budget,
                    source,
                    notes,
                    created_at,
                    updated_at
                )

                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    project_code,
                    contingency,
                    (
                        "Synthetic portfolio "
                        f"assumption: "
                        f"{request.contingency_pct}% "
                        "of current budget"
                    ),
                    (
                        "Portfolio demonstration "
                        "baseline. Replace with "
                        "approved project contingency "
                        "for production use."
                    ),
                    now,
                    now,
                ),
            )


            seeded += 1


        connection.commit()


    return {

        "projects":
            len(
                projects
            ),

        "seeded":
            seeded,

        "already_existing":
            existing,

        "contingency_pct":
            request.contingency_pct,

        "synthetic_assumption":
            True,
    }


# ============================================================
# CONTINGENCY SUMMARY
# ============================================================

@router.get(
    "/projects/{project_code}/contingency"
)
def get_contingency_summary(
    project_code: str,
):

    with get_connection() as connection:

        return (
            calculate_contingency_summary(
                connection,
                project_code,
            )
        )


# ============================================================
# PORTFOLIO CONTINGENCY
# ============================================================

@router.get(
    "/portfolio/contingency"
)
def get_portfolio_contingency():

    with get_connection() as connection:

        projects = get_projects(
            connection
        )


        summaries = [

            calculate_contingency_summary(
                connection,
                project[
                    "project_code"
                ],
            )

            for project in projects
        ]


    return {

        "portfolio": {

            "total_contingency":
                round(
                    sum(
                        row[
                            "contingency_budget"
                        ]
                        for row in summaries
                    ),
                    2,
                ),

            "committed_contingency":
                round(
                    sum(
                        row[
                            "committed_contingency"
                        ]
                        for row in summaries
                    ),
                    2,
                ),

            "drawn_contingency":
                round(
                    sum(
                        row[
                            "drawn_contingency"
                        ]
                        for row in summaries
                    ),
                    2,
                ),

            "remaining_contingency":
                round(
                    sum(
                        row[
                            "remaining_contingency"
                        ]
                        for row in summaries
                    ),
                    2,
                ),

            "proposed_risk_exposure":
                round(
                    sum(
                        row[
                            "proposed_risk_exposure"
                        ]
                        for row in summaries
                    ),
                    2,
                ),

            "project_count":
                len(
                    summaries
                ),
        },

        "projects":
            summaries,
    }


# ============================================================
# RISK REGISTER
# ============================================================

@router.get(
    "/projects/{project_code}/risks"
)
def list_project_risks(
    project_code: str,
):

    with get_connection() as connection:

        get_project(
            connection,
            project_code,
        )

        rows = connection.execute(
            """
            SELECT *

            FROM project_risk_drawdown

            WHERE project_code = ?

            ORDER BY
                CASE status
                    WHEN 'Drawn' THEN 1
                    WHEN 'Approved' THEN 2
                    WHEN 'Proposed' THEN 3
                    WHEN 'Rejected' THEN 4
                    WHEN 'Cancelled' THEN 5
                    ELSE 6
                END,
                created_at DESC
            """,
            (
                project_code,
            ),
        ).fetchall()


    return {

        "project_code":
            project_code,

        "count":
            len(
                rows
            ),

        "risks":
            [
                dict(row)
                for row in rows
            ],
    }


# ============================================================
# CREATE RISK
# ============================================================

@router.post(
    "/risks"
)
def create_risk(
    request: RiskDrawdownCreate,
):

    validate_risk_status(
        request.status
    )

    validate_risk_category(
        request.category
    )


    with get_connection() as connection:

        get_project(
            connection,
            request.project_code,
        )


        duplicate = connection.execute(
            """
            SELECT drawdown_id

            FROM project_risk_drawdown

            WHERE
                project_code = ?
                AND
                risk_reference = ?
            """,
            (
                request.project_code,
                request.risk_reference,
            ),
        ).fetchone()


        if duplicate:

            raise HTTPException(
                status_code=409,
                detail=(
                    "Risk reference already exists "
                    "for this project."
                ),
            )


        drawdown_id = (
            "RSK-"
            +
            uuid.uuid4()
            .hex[:10]
            .upper()
        )


        now = (
            datetime.utcnow()
            .replace(
                microsecond=0
            )
            .isoformat()
            +
            "Z"
        )


        connection.execute(
            """
            INSERT INTO project_risk_drawdown (

                drawdown_id,
                project_code,
                risk_reference,
                category,
                title,
                description,
                amount,
                status,
                event_date,
                owner,
                approved_by,
                created_at,
                updated_at
            )

            VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?
            )
            """,
            (
                drawdown_id,
                request.project_code,
                request.risk_reference,
                request.category,
                request.title,
                request.description,
                request.amount,
                request.status,
                request.event_date,
                request.owner,
                request.approved_by,
                now,
                now,
            ),
        )


        connection.commit()


        row = connection.execute(
            """
            SELECT *

            FROM project_risk_drawdown

            WHERE drawdown_id = ?
            """,
            (
                drawdown_id,
            ),
        ).fetchone()


        summary = (
            calculate_contingency_summary(
                connection,
                request.project_code,
            )
        )


    return {

        "message":
            "Risk drawdown record created.",

        "risk":
            dict(row),

        "contingency_summary":
            summary,
    }


# ============================================================
# UPDATE RISK
# ============================================================

@router.patch(
    "/risks/{drawdown_id}"
)
def update_risk(
    drawdown_id: str,
    request: RiskDrawdownUpdate,
):

    with get_connection() as connection:

        existing = connection.execute(
            """
            SELECT *

            FROM project_risk_drawdown

            WHERE drawdown_id = ?
            """,
            (
                drawdown_id,
            ),
        ).fetchone()


        if not existing:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Risk record "
                    f"{drawdown_id} "
                    "not found."
                ),
            )


        current = dict(
            existing
        )


        status = (
            request.status
            if request.status is not None
            else current[
                "status"
            ]
        )


        category = (
            request.category
            if request.category is not None
            else current[
                "category"
            ]
        )


        validate_risk_status(
            status
        )

        validate_risk_category(
            category
        )


        values = {

            "risk_reference":
                (
                    request.risk_reference
                    if request.risk_reference
                    is not None
                    else current[
                        "risk_reference"
                    ]
                ),

            "category":
                category,

            "title":
                (
                    request.title
                    if request.title
                    is not None
                    else current[
                        "title"
                    ]
                ),

            "description":
                (
                    request.description
                    if request.description
                    is not None
                    else current[
                        "description"
                    ]
                ),

            "amount":
                (
                    request.amount
                    if request.amount
                    is not None
                    else current[
                        "amount"
                    ]
                ),

            "status":
                status,

            "event_date":
                (
                    request.event_date
                    if request.event_date
                    is not None
                    else current[
                        "event_date"
                    ]
                ),

            "owner":
                (
                    request.owner
                    if request.owner
                    is not None
                    else current[
                        "owner"
                    ]
                ),

            "approved_by":
                (
                    request.approved_by
                    if request.approved_by
                    is not None
                    else current[
                        "approved_by"
                    ]
                ),
        }


        duplicate = connection.execute(
            """
            SELECT drawdown_id

            FROM project_risk_drawdown

            WHERE
                project_code = ?
                AND
                risk_reference = ?
                AND
                drawdown_id != ?
            """,
            (
                current[
                    "project_code"
                ],
                values[
                    "risk_reference"
                ],
                drawdown_id,
            ),
        ).fetchone()


        if duplicate:

            raise HTTPException(
                status_code=409,
                detail=(
                    "Risk reference already exists "
                    "for this project."
                ),
            )


        now = (
            datetime.utcnow()
            .replace(
                microsecond=0
            )
            .isoformat()
            +
            "Z"
        )


        connection.execute(
            """
            UPDATE project_risk_drawdown

            SET
                risk_reference = ?,
                category = ?,
                title = ?,
                description = ?,
                amount = ?,
                status = ?,
                event_date = ?,
                owner = ?,
                approved_by = ?,
                updated_at = ?

            WHERE drawdown_id = ?
            """,
            (
                values[
                    "risk_reference"
                ],
                values[
                    "category"
                ],
                values[
                    "title"
                ],
                values[
                    "description"
                ],
                values[
                    "amount"
                ],
                values[
                    "status"
                ],
                values[
                    "event_date"
                ],
                values[
                    "owner"
                ],
                values[
                    "approved_by"
                ],
                now,
                drawdown_id,
            ),
        )


        connection.commit()


        updated = connection.execute(
            """
            SELECT *

            FROM project_risk_drawdown

            WHERE drawdown_id = ?
            """,
            (
                drawdown_id,
            ),
        ).fetchone()


        summary = (
            calculate_contingency_summary(
                connection,
                current[
                    "project_code"
                ],
            )
        )


    return {

        "message":
            "Risk drawdown record updated.",

        "risk":
            dict(updated),

        "contingency_summary":
            summary,
    }


# ============================================================
# DELETE RISK
# ============================================================

@router.delete(
    "/risks/{drawdown_id}"
)
def delete_risk(
    drawdown_id: str,
):

    with get_connection() as connection:

        existing = connection.execute(
            """
            SELECT *

            FROM project_risk_drawdown

            WHERE drawdown_id = ?
            """,
            (
                drawdown_id,
            ),
        ).fetchone()


        if not existing:

            raise HTTPException(
                status_code=404,
                detail=(
                    "Risk record not found."
                ),
            )


        project_code = (
            existing[
                "project_code"
            ]
        )


        connection.execute(
            """
            DELETE FROM project_risk_drawdown

            WHERE drawdown_id = ?
            """,
            (
                drawdown_id,
            ),
        )


        connection.commit()


        summary = (
            calculate_contingency_summary(
                connection,
                project_code,
            )
        )


    return {

        "message":
            "Risk record deleted.",

        "drawdown_id":
            drawdown_id,

        "contingency_summary":
            summary,
    }


# ============================================================
# CASH FLOW
# ============================================================

@router.get(
    "/projects/{project_code}/cashflow"
)
def get_cashflow(
    project_code: str,
):

    with get_connection() as connection:

        return (
            calculate_cashflow_summary(
                connection,
                project_code,
            )
        )


# ============================================================
# UPSERT CASH FLOW PERIOD
# ============================================================

@router.put(
    "/projects/{project_code}/cashflow"
)
def upsert_cashflow(
    project_code: str,
    request: CashFlowUpsert,
):

    validate_reporting_period(
        request.reporting_period
    )


    with get_connection() as connection:

        get_project(
            connection,
            project_code,
        )


        now = (
            datetime.utcnow()
            .replace(
                microsecond=0
            )
            .isoformat()
            +
            "Z"
        )


        existing = connection.execute(
            """
            SELECT cashflow_id

            FROM project_cashflow

            WHERE
                project_code = ?
                AND
                reporting_period = ?
            """,
            (
                project_code,
                request.reporting_period,
            ),
        ).fetchone()


        if existing:

            connection.execute(
                """
                UPDATE project_cashflow

                SET
                    forecast_cash = ?,
                    actual_cash = ?,
                    committed_cash = ?,
                    notes = ?,
                    updated_at = ?

                WHERE cashflow_id = ?
                """,
                (
                    request.forecast_cash,
                    request.actual_cash,
                    request.committed_cash,
                    request.notes,
                    now,
                    existing[
                        "cashflow_id"
                    ],
                ),
            )

        else:

            cashflow_id = (
                "CF-"
                +
                uuid.uuid4()
                .hex[:10]
                .upper()
            )


            connection.execute(
                """
                INSERT INTO project_cashflow (

                    cashflow_id,
                    project_code,
                    reporting_period,
                    forecast_cash,
                    actual_cash,
                    committed_cash,
                    notes,
                    created_at,
                    updated_at
                )

                VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                """,
                (
                    cashflow_id,
                    project_code,
                    request.reporting_period,
                    request.forecast_cash,
                    request.actual_cash,
                    request.committed_cash,
                    request.notes,
                    now,
                    now,
                ),
            )


        connection.commit()


        summary = (
            calculate_cashflow_summary(
                connection,
                project_code,
            )
        )


    return {

        "message":
            "Cash-flow period saved.",

        "cashflow":
            summary,
    }


# ============================================================
# DELETE CASH FLOW PERIOD
# ============================================================

@router.delete(
    "/projects/{project_code}/cashflow/{reporting_period}"
)
def delete_cashflow_period(
    project_code: str,
    reporting_period: str,
):

    validate_reporting_period(
        reporting_period
    )


    with get_connection() as connection:

        get_project(
            connection,
            project_code,
        )


        existing = connection.execute(
            """
            SELECT cashflow_id

            FROM project_cashflow

            WHERE
                project_code = ?
                AND
                reporting_period = ?
            """,
            (
                project_code,
                reporting_period,
            ),
        ).fetchone()


        if not existing:

            raise HTTPException(
                status_code=404,
                detail=(
                    "Cash-flow period not found."
                ),
            )


        connection.execute(
            """
            DELETE FROM project_cashflow

            WHERE cashflow_id = ?
            """,
            (
                existing[
                    "cashflow_id"
                ],
            ),
        )


        connection.commit()


        summary = (
            calculate_cashflow_summary(
                connection,
                project_code,
            )
        )


    return {

        "message":
            "Cash-flow period deleted.",

        "cashflow":
            summary,
    }
