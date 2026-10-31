from datetime import datetime
from pathlib import Path
import sqlite3
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


from src.backend.runtime_paths import get_runtime_database_path
# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/change-control",
    tags=["Budget & Change Control"],
)


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

DATABASE_PATH = get_runtime_database_path()


# ============================================================
# CONSTANTS
# ============================================================

VALID_STATUSES = {
    "Draft",
    "Pending",
    "Approved",
    "Rejected",
    "Cancelled",
}

VALID_CATEGORIES = {
    "Client Change",
    "Design Change",
    "Scope Change",
    "Commercial Adjustment",
    "Procurement",
    "Schedule Impact",
    "Risk Realisation",
    "Other",
}


# ============================================================
# DATABASE
# ============================================================

def get_connection():

    if not DATABASE_PATH.exists():

        raise HTTPException(
            status_code=500,
            detail=(
                "ControlSight analytical database "
                f"not found: {DATABASE_PATH}"
            ),
        )

    connection = sqlite3.connect(
        DATABASE_PATH
    )

    connection.row_factory = sqlite3.Row

    return connection


# ============================================================
# TABLE INITIALISATION
# ============================================================

def initialise_change_control_tables():

    with get_connection() as connection:

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS project_budget_baseline (

                project_code TEXT PRIMARY KEY,

                original_budget REAL NOT NULL,

                source TEXT NOT NULL
                    DEFAULT 'Management scorecard',

                created_at TEXT NOT NULL,

                updated_at TEXT NOT NULL
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS project_change_log (

                change_id TEXT PRIMARY KEY,

                project_code TEXT NOT NULL,

                change_reference TEXT NOT NULL,

                category TEXT NOT NULL,

                title TEXT NOT NULL,

                description TEXT,

                change_amount REAL NOT NULL,

                status TEXT NOT NULL,

                approval_date TEXT,

                requested_by TEXT,

                approved_by TEXT,

                created_at TEXT NOT NULL,

                updated_at TEXT NOT NULL
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_project_change_log_project

            ON project_change_log(
                project_code
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_project_change_log_status

            ON project_change_log(
                status
            )
            """
        )

        connection.commit()


# ============================================================
# SCORECARD HELPERS
# ============================================================

def get_scorecard_columns(
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

    columns = get_scorecard_columns(
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
            "was found in report_management_scorecard."
        ),
    )


def get_project_record(
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


def get_all_projects(
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
# BASELINE
# ============================================================

def ensure_project_baseline(
    connection,
    project_code,
):

    existing = connection.execute(
        """
        SELECT
            project_code,
            original_budget,
            source,
            created_at,
            updated_at

        FROM project_budget_baseline

        WHERE project_code = ?
        """,
        (
            project_code,
        ),
    ).fetchone()

    if existing:
        return dict(existing)

    project = get_project_record(
        connection,
        project_code,
    )

    now = (
        datetime.utcnow()
        .replace(
            microsecond=0
        )
        .isoformat()
        + "Z"
    )

    original_budget = float(
        project["source_budget"]
        or 0
    )

    connection.execute(
        """
        INSERT INTO project_budget_baseline (

            project_code,
            original_budget,
            source,
            created_at,
            updated_at

        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            project_code,
            original_budget,
            "Initial ControlSight scorecard budget",
            now,
            now,
        ),
    )

    connection.commit()

    return {
        "project_code":
            project_code,

        "original_budget":
            original_budget,

        "source":
            "Initial ControlSight scorecard budget",

        "created_at":
            now,

        "updated_at":
            now,
    }


def seed_all_baselines():

    with get_connection() as connection:

        projects = get_all_projects(
            connection
        )

        seeded = 0
        existing = 0

        for project in projects:

            row = connection.execute(
                """
                SELECT 1

                FROM project_budget_baseline

                WHERE project_code = ?
                """,
                (
                    project[
                        "project_code"
                    ],
                ),
            ).fetchone()

            if row:

                existing += 1
                continue

            ensure_project_baseline(
                connection,
                project[
                    "project_code"
                ],
            )

            seeded += 1

        return {
            "projects":
                len(projects),

            "seeded":
                seeded,

            "already_existing":
                existing,
        }


# ============================================================
# MODELS
# ============================================================

class ChangeCreateRequest(BaseModel):

    project_code: str

    change_reference: str = Field(
        min_length=1,
        max_length=100,
    )

    category: str = Field(
        min_length=1,
        max_length=100,
    )

    title: str = Field(
        min_length=1,
        max_length=200,
    )

    description: str | None = None

    change_amount: float

    status: str = "Pending"

    approval_date: str | None = None

    requested_by: str | None = None

    approved_by: str | None = None


class ChangeUpdateRequest(BaseModel):

    change_reference: str | None = None

    category: str | None = None

    title: str | None = None

    description: str | None = None

    change_amount: float | None = None

    status: str | None = None

    approval_date: str | None = None

    requested_by: str | None = None

    approved_by: str | None = None


class BudgetBaselineUpdateRequest(
    BaseModel
):

    original_budget: float = Field(
        ge=0,
    )


# ============================================================
# VALIDATION
# ============================================================

def validate_status(
    status,
):

    if status not in VALID_STATUSES:

        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid change status. "
                f"Allowed values: "
                f"{sorted(VALID_STATUSES)}"
            ),
        )


def validate_category(
    category,
):

    if category not in VALID_CATEGORIES:

        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid change category. "
                f"Allowed values: "
                f"{sorted(VALID_CATEGORIES)}"
            ),
        )


# ============================================================
# CHANGE HELPERS
# ============================================================

def get_project_changes(
    connection,
    project_code,
):

    rows = connection.execute(
        """
        SELECT *

        FROM project_change_log

        WHERE project_code = ?

        ORDER BY
            CASE status
                WHEN 'Approved' THEN 1
                WHEN 'Pending' THEN 2
                WHEN 'Draft' THEN 3
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

    return [
        dict(row)
        for row in rows
    ]


def calculate_budget_summary(
    connection,
    project_code,
):

    project = get_project_record(
        connection,
        project_code,
    )

    baseline = ensure_project_baseline(
        connection,
        project_code,
    )

    changes = get_project_changes(
        connection,
        project_code,
    )

    approved_changes = sum(
        float(
            change[
                "change_amount"
            ]
            or 0
        )
        for change in changes
        if (
            change[
                "status"
            ]
            ==
            "Approved"
        )
    )

    pending_changes = sum(
        float(
            change[
                "change_amount"
            ]
            or 0
        )
        for change in changes
        if (
            change[
                "status"
            ]
            ==
            "Pending"
        )
    )

    draft_changes = sum(
        float(
            change[
                "change_amount"
            ]
            or 0
        )
        for change in changes
        if (
            change[
                "status"
            ]
            ==
            "Draft"
        )
    )

    original_budget = float(
        baseline[
            "original_budget"
        ]
        or 0
    )

    current_budget = (
        original_budget
        +
        approved_changes
    )

    potential_budget = (
        current_budget
        +
        pending_changes
    )

    approved_positive = sum(
        float(
            change[
                "change_amount"
            ]
            or 0
        )
        for change in changes
        if (
            change[
                "status"
            ]
            ==
            "Approved"
            and
            float(
                change[
                    "change_amount"
                ]
                or 0
            )
            >
            0
        )
    )

    approved_negative = sum(
        float(
            change[
                "change_amount"
            ]
            or 0
        )
        for change in changes
        if (
            change[
                "status"
            ]
            ==
            "Approved"
            and
            float(
                change[
                    "change_amount"
                ]
                or 0
            )
            <
            0
        )
    )

    return {

        "project_code":
            project_code,

        "project_name":
            project[
                "project_name"
            ],

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

        "approved_positive_changes":
            round(
                approved_positive,
                2,
            ),

        "approved_negative_changes":
            round(
                approved_negative,
                2,
            ),

        "current_budget":
            round(
                current_budget,
                2,
            ),

        "pending_changes":
            round(
                pending_changes,
                2,
            ),

        "draft_changes":
            round(
                draft_changes,
                2,
            ),

        "potential_budget_if_pending_approved":
            round(
                potential_budget,
                2,
            ),

        "source_scorecard_budget":
            round(
                float(
                    project[
                        "source_budget"
                    ]
                    or 0
                ),
                2,
            ),

        "approved_change_count":
            sum(
                1
                for change in changes
                if (
                    change[
                        "status"
                    ]
                    ==
                    "Approved"
                )
            ),

        "pending_change_count":
            sum(
                1
                for change in changes
                if (
                    change[
                        "status"
                    ]
                    ==
                    "Pending"
                )
            ),

        "total_change_records":
            len(
                changes
            ),
    }


# ============================================================
# INITIALISE ON IMPORT
# ============================================================

initialise_change_control_tables()


# ============================================================
# HEALTH
# ============================================================

@router.get(
    "/health/status"
)
def change_control_health():

    with get_connection() as connection:

        detect_budget_column(
            connection
        )

    return {

        "status":
            "ok",

        "module":
            "Budget & Change Control",

        "database_available":
            DATABASE_PATH.exists(),

        "persistent":
            True,

        "approved_changes_affect_current_budget":
            True,

        "pending_changes_affect_current_budget":
            False,
    }


# ============================================================
# CONFIG
# ============================================================

@router.get(
    "/config"
)
def get_change_control_config():

    return {

        "statuses":
            sorted(
                VALID_STATUSES
            ),

        "categories":
            sorted(
                VALID_CATEGORIES
            ),

        "methodology": {

            "current_budget":
                (
                    "Original Budget "
                    "+ Approved Changes"
                ),

            "potential_budget":
                (
                    "Current Budget "
                    "+ Pending Changes"
                ),

            "important_note":
                (
                    "Rejected, cancelled and draft "
                    "changes do not alter Current Budget."
                ),
        },
    }


# ============================================================
# SEED BASELINES
# ============================================================

@router.post(
    "/baselines/seed"
)
def seed_budget_baselines():

    return seed_all_baselines()


# ============================================================
# PORTFOLIO SUMMARY
# ============================================================

@router.get(
    "/portfolio"
)
def get_portfolio_change_summary():

    with get_connection() as connection:

        projects = get_all_projects(
            connection
        )

        summaries = [
            calculate_budget_summary(
                connection,
                project[
                    "project_code"
                ],
            )
            for project in projects
        ]

    original_budget = sum(
        row[
            "original_budget"
        ]
        for row in summaries
    )

    approved_changes = sum(
        row[
            "approved_changes"
        ]
        for row in summaries
    )

    current_budget = sum(
        row[
            "current_budget"
        ]
        for row in summaries
    )

    pending_changes = sum(
        row[
            "pending_changes"
        ]
        for row in summaries
    )

    potential_budget = sum(
        row[
            "potential_budget_if_pending_approved"
        ]
        for row in summaries
    )

    return {

        "portfolio": {

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
                    current_budget,
                    2,
                ),

            "pending_changes":
                round(
                    pending_changes,
                    2,
                ),

            "potential_budget_if_pending_approved":
                round(
                    potential_budget,
                    2,
                ),

            "project_count":
                len(
                    summaries
                ),

            "approved_change_count":
                sum(
                    row[
                        "approved_change_count"
                    ]
                    for row in summaries
                ),

            "pending_change_count":
                sum(
                    row[
                        "pending_change_count"
                    ]
                    for row in summaries
                ),
        },

        "projects":
            summaries,
    }


# ============================================================
# PROJECT SUMMARY
# ============================================================

@router.get(
    "/projects/{project_code}/summary"
)
def get_project_budget_summary(
    project_code: str,
):

    with get_connection() as connection:

        return calculate_budget_summary(
            connection,
            project_code,
        )


# ============================================================
# PROJECT CHANGE LOG
# ============================================================

@router.get(
    "/projects/{project_code}/changes"
)
def list_project_changes(
    project_code: str,
):

    with get_connection() as connection:

        get_project_record(
            connection,
            project_code,
        )

        changes = get_project_changes(
            connection,
            project_code,
        )

    return {

        "project_code":
            project_code,

        "count":
            len(
                changes
            ),

        "changes":
            changes,
    }


# ============================================================
# CREATE CHANGE
# ============================================================

@router.post(
    "/changes"
)
def create_change(
    request: ChangeCreateRequest,
):

    validate_status(
        request.status
    )

    validate_category(
        request.category
    )

    with get_connection() as connection:

        get_project_record(
            connection,
            request.project_code,
        )

        ensure_project_baseline(
            connection,
            request.project_code,
        )

        duplicate = connection.execute(
            """
            SELECT
                change_id

            FROM project_change_log

            WHERE
                project_code = ?
                AND
                change_reference = ?
            """,
            (
                request.project_code,
                request.change_reference,
            ),
        ).fetchone()

        if duplicate:

            raise HTTPException(
                status_code=409,
                detail=(
                    "Change reference already exists "
                    "for this project."
                ),
            )

        change_id = (
            "CHG-"
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

        approval_date = (
            request.approval_date
        )

        if (
            request.status
            ==
            "Approved"
            and
            not approval_date
        ):

            approval_date = (
                datetime.utcnow()
                .date()
                .isoformat()
            )

        connection.execute(
            """
            INSERT INTO project_change_log (

                change_id,
                project_code,
                change_reference,
                category,
                title,
                description,
                change_amount,
                status,
                approval_date,
                requested_by,
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
                change_id,
                request.project_code,
                request.change_reference,
                request.category,
                request.title,
                request.description,
                request.change_amount,
                request.status,
                approval_date,
                request.requested_by,
                request.approved_by,
                now,
                now,
            ),
        )

        connection.commit()

        row = connection.execute(
            """
            SELECT *

            FROM project_change_log

            WHERE change_id = ?
            """,
            (
                change_id,
            ),
        ).fetchone()

        summary = calculate_budget_summary(
            connection,
            request.project_code,
        )

    return {

        "message":
            "Change record created.",

        "change":
            dict(row),

        "budget_summary":
            summary,
    }


# ============================================================
# UPDATE CHANGE
# ============================================================

@router.patch(
    "/changes/{change_id}"
)
def update_change(
    change_id: str,
    request: ChangeUpdateRequest,
):

    with get_connection() as connection:

        existing = connection.execute(
            """
            SELECT *

            FROM project_change_log

            WHERE change_id = ?
            """,
            (
                change_id,
            ),
        ).fetchone()

        if not existing:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Change {change_id} "
                    "not found."
                ),
            )

        current = dict(existing)

        new_status = (
            request.status
            if request.status is not None
            else current[
                "status"
            ]
        )

        new_category = (
            request.category
            if request.category is not None
            else current[
                "category"
            ]
        )

        validate_status(
            new_status
        )

        validate_category(
            new_category
        )

        change_reference = (
            request.change_reference
            if request.change_reference is not None
            else current[
                "change_reference"
            ]
        )

        title = (
            request.title
            if request.title is not None
            else current[
                "title"
            ]
        )

        description = (
            request.description
            if request.description is not None
            else current[
                "description"
            ]
        )

        change_amount = (
            request.change_amount
            if request.change_amount is not None
            else current[
                "change_amount"
            ]
        )

        approval_date = (
            request.approval_date
            if request.approval_date is not None
            else current[
                "approval_date"
            ]
        )

        requested_by = (
            request.requested_by
            if request.requested_by is not None
            else current[
                "requested_by"
            ]
        )

        approved_by = (
            request.approved_by
            if request.approved_by is not None
            else current[
                "approved_by"
            ]
        )

        if (
            new_status
            ==
            "Approved"
            and
            not approval_date
        ):

            approval_date = (
                datetime.utcnow()
                .date()
                .isoformat()
            )

        duplicate = connection.execute(
            """
            SELECT
                change_id

            FROM project_change_log

            WHERE
                project_code = ?
                AND
                change_reference = ?
                AND
                change_id != ?
            """,
            (
                current[
                    "project_code"
                ],
                change_reference,
                change_id,
            ),
        ).fetchone()

        if duplicate:

            raise HTTPException(
                status_code=409,
                detail=(
                    "Change reference already exists "
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
            UPDATE project_change_log

            SET
                change_reference = ?,
                category = ?,
                title = ?,
                description = ?,
                change_amount = ?,
                status = ?,
                approval_date = ?,
                requested_by = ?,
                approved_by = ?,
                updated_at = ?

            WHERE change_id = ?
            """,
            (
                change_reference,
                new_category,
                title,
                description,
                change_amount,
                new_status,
                approval_date,
                requested_by,
                approved_by,
                now,
                change_id,
            ),
        )

        connection.commit()

        updated = connection.execute(
            """
            SELECT *

            FROM project_change_log

            WHERE change_id = ?
            """,
            (
                change_id,
            ),
        ).fetchone()

        summary = calculate_budget_summary(
            connection,
            current[
                "project_code"
            ],
        )

    return {

        "message":
            "Change record updated.",

        "change":
            dict(updated),

        "budget_summary":
            summary,
    }


# ============================================================
# DELETE CHANGE
# ============================================================

@router.delete(
    "/changes/{change_id}"
)
def delete_change(
    change_id: str,
):

    with get_connection() as connection:

        existing = connection.execute(
            """
            SELECT *

            FROM project_change_log

            WHERE change_id = ?
            """,
            (
                change_id,
            ),
        ).fetchone()

        if not existing:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Change {change_id} "
                    "not found."
                ),
            )

        project_code = (
            existing[
                "project_code"
            ]
        )

        connection.execute(
            """
            DELETE FROM project_change_log

            WHERE change_id = ?
            """,
            (
                change_id,
            ),
        )

        connection.commit()

        summary = calculate_budget_summary(
            connection,
            project_code,
        )

    return {

        "message":
            "Change record deleted.",

        "change_id":
            change_id,

        "budget_summary":
            summary,
    }


# ============================================================
# UPDATE ORIGINAL BUDGET
# ============================================================

@router.put(
    "/projects/{project_code}/baseline"
)
def update_original_budget(
    project_code: str,
    request: BudgetBaselineUpdateRequest,
):

    with get_connection() as connection:

        get_project_record(
            connection,
            project_code,
        )

        ensure_project_baseline(
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

        connection.execute(
            """
            UPDATE project_budget_baseline

            SET
                original_budget = ?,
                source = ?,
                updated_at = ?

            WHERE project_code = ?
            """,
            (
                request.original_budget,
                "Manual controlled baseline",
                now,
                project_code,
            ),
        )

        connection.commit()

        summary = calculate_budget_summary(
            connection,
            project_code,
        )

    return {

        "message":
            "Original budget baseline updated.",

        "budget_summary":
            summary,
    }
