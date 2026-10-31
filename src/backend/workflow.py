from datetime import date
import sqlite3

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api",
    tags=["Workflow Controls"],
)


# ============================================================
# DATABASE
# ============================================================

DATABASE_PATH = (
    "data/database/controlsight.db"
)


def get_connection():

    connection = sqlite3.connect(
        DATABASE_PATH
    )

    connection.row_factory = sqlite3.Row

    return connection


# ============================================================
# MODELS
# ============================================================

class ActionCreate(BaseModel):

    project_code: str

    reporting_period: str

    category: str

    issue: str

    owner_role: str

    due_date: str

    status: str = "Open"

    priority: str = "Medium"

    source: str = "Management Review"


class ActionUpdate(BaseModel):

    owner_role: str | None = None

    due_date: str | None = None

    status: str | None = None

    priority: str | None = None

    issue: str | None = None


class CommentaryUpdate(BaseModel):

    project_code: str

    reporting_period: str

    cost_commentary: str | None = None

    progress_commentary: str | None = None

    schedule_commentary: str | None = None

    procurement_commentary: str | None = None


# ============================================================
# TABLE INITIALISATION
# ============================================================

def initialise_workflow_tables():

    with get_connection() as connection:

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS workflow_actions (

                action_id INTEGER PRIMARY KEY AUTOINCREMENT,

                project_code TEXT NOT NULL,

                reporting_period TEXT NOT NULL,

                category TEXT NOT NULL,

                issue TEXT NOT NULL,

                owner_role TEXT NOT NULL,

                due_date TEXT,

                status TEXT NOT NULL
                    DEFAULT 'Open',

                priority TEXT NOT NULL
                    DEFAULT 'Medium',

                source TEXT NOT NULL
                    DEFAULT 'Management Review',

                created_date TEXT NOT NULL,

                updated_date TEXT NOT NULL
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS workflow_commentary (

                commentary_id INTEGER PRIMARY KEY AUTOINCREMENT,

                project_code TEXT NOT NULL,

                reporting_period TEXT NOT NULL,

                cost_commentary TEXT,

                progress_commentary TEXT,

                schedule_commentary TEXT,

                procurement_commentary TEXT,

                created_date TEXT NOT NULL,

                updated_date TEXT NOT NULL,

                UNIQUE(
                    project_code,
                    reporting_period
                )
            )
            """
        )

        connection.commit()


# ============================================================
# VALIDATION HELPERS
# ============================================================

VALID_STATUSES = {
    "Open",
    "In Progress",
    "Closed",
    "On Hold",
}


VALID_PRIORITIES = {
    "Low",
    "Medium",
    "High",
    "Critical",
}


VALID_CATEGORIES = {
    "Cost",
    "Progress",
    "Schedule",
    "Procurement",
    "Data Quality",
    "Forecast Credibility",
}


OWNER_ROLE_MAPPING = {

    "Cost": (
        "Cost Control / Commercial"
    ),

    "Progress": (
        "Planning / Project Controls"
    ),

    "Schedule": (
        "Planning / Project Manager"
    ),

    "Procurement": (
        "Procurement"
    ),

    "Data Quality": (
        "Data / Project Controls"
    ),

    "Forecast Credibility": (
        "Cost Control / Commercial"
    ),
}


def validate_action_fields(
    category,
    status,
    priority,
):

    if category not in VALID_CATEGORIES:

        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid action category"
            ),
        )

    if status not in VALID_STATUSES:

        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid action status"
            ),
        )

    if priority not in VALID_PRIORITIES:

        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid action priority"
            ),
        )


# ============================================================
# GENERATE MANAGEMENT COMMENTARY
# ============================================================

def generate_management_commentary(
    project_code: str,
    reporting_period: str,
):

    with get_connection() as connection:

        project = connection.execute(
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
                forecast_credibility_gap_pct,
                forecast_credibility_status

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

        procurement = connection.execute(
            """
            SELECT

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

    credibility_gap = float(
        project[
            "forecast_credibility_gap_pct"
        ]
        or 0
    )

    delayed_activities = int(
        schedule[
            "delayed_activities"
        ]
        or 0
    )

    critical_delays = int(
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


    # --------------------------------------------------------
    # COST COMMENTARY
    # --------------------------------------------------------

    if forecast_variance_pct <= -10:

        cost_commentary = (
            "Forecast cost remains materially "
            "above the approved budget and "
            "requires active cost-control review."
        )

    elif forecast_variance_pct <= -5:

        cost_commentary = (
            "Forecast cost pressure remains "
            "above management tolerance and "
            "should continue to be monitored."
        )

    else:

        cost_commentary = (
            "Current forecast remains broadly "
            "within defined cost tolerance."
        )


    # --------------------------------------------------------
    # PROGRESS COMMENTARY
    # --------------------------------------------------------

    if progress_variance <= -10:

        progress_commentary = (
            "Actual progress is materially "
            "behind plan and recovery actions "
            "should be reviewed."
        )

    elif progress_variance <= -5:

        progress_commentary = (
            "Progress remains behind plan and "
            "requires continued planning review."
        )

    else:

        progress_commentary = (
            "Progress is currently within the "
            "defined management tolerance."
        )


    # --------------------------------------------------------
    # SCHEDULE COMMENTARY
    # --------------------------------------------------------

    if critical_delays > 0:

        schedule_commentary = (
            f"{critical_delays} critical "
            "schedule activities are delayed. "
            "Critical-path recovery should be "
            "reviewed by Planning and the "
            "Project Manager."
        )

    elif delayed_activities > 0:

        schedule_commentary = (
            f"{delayed_activities} activities "
            "are delayed, although no current "
            "critical activity delay is recorded."
        )

    else:

        schedule_commentary = (
            "No material schedule exception "
            "is currently identified."
        )


    # --------------------------------------------------------
    # PROCUREMENT COMMENTARY
    # --------------------------------------------------------

    if critical_procurement > 0:

        procurement_commentary = (
            f"{critical_procurement} critical "
            "procurement deliveries remain "
            "delayed and require supplier "
            "recovery action."
        )

    elif delayed_items > 0:

        procurement_commentary = (
            f"{delayed_items} procurement items "
            "are delayed and should remain under "
            "delivery review."
        )

    else:

        procurement_commentary = (
            "No material procurement delivery "
            "exception is currently identified."
        )


    # --------------------------------------------------------
    # FORECAST CREDIBILITY NOTE
    # --------------------------------------------------------

    if credibility_gap >= 20:

        forecast_note = (
            "Forecast credibility is Critical. "
            "The progress-implied completion-cost "
            "proxy is materially above reported FAC."
        )

    elif credibility_gap >= 10:

        forecast_note = (
            "Forecast credibility is High and "
            "reported FAC should be challenged "
            "against current progress and cost."
        )

    elif credibility_gap >= 5:

        forecast_note = (
            "Forecast credibility is on Watch."
        )

    else:

        forecast_note = (
            "No material forecast credibility "
            "exception is identified."
        )


    return {
        "project_code": (
            project_code
        ),

        "project_name": (
            project[
                "project_name"
            ]
        ),

        "reporting_period": (
            reporting_period
        ),

        "cost_commentary": (
            cost_commentary
        ),

        "progress_commentary": (
            progress_commentary
        ),

        "schedule_commentary": (
            schedule_commentary
        ),

        "procurement_commentary": (
            procurement_commentary
        ),

        "forecast_credibility_note": (
            forecast_note
        ),

        "generated_by": (
            "Deterministic management rules"
        ),

        "ai_generated": False,
    }


# ============================================================
# COMMENTARY API
# ============================================================

@router.get(
    "/projects/{project_code}/workflow/commentary"
)
def get_project_commentary(
    project_code: str,
    reporting_period: str,
):

    initialise_workflow_tables()

    with get_connection() as connection:

        saved = connection.execute(
            """
            SELECT
                project_code,
                reporting_period,
                cost_commentary,
                progress_commentary,
                schedule_commentary,
                procurement_commentary,
                created_date,
                updated_date

            FROM workflow_commentary

            WHERE
                project_code = ?
                AND reporting_period = ?
            """,
            (
                project_code,
                reporting_period,
            ),
        ).fetchone()


    generated = (
        generate_management_commentary(
            project_code,
            reporting_period,
        )
    )


    if saved is None:

        return {
            **generated,

            "saved_commentary": False,
        }


    result = dict(
        saved
    )


    result[
        "project_name"
    ] = generated[
        "project_name"
    ]


    result[
        "forecast_credibility_note"
    ] = generated[
        "forecast_credibility_note"
    ]


    result[
        "generated_by"
    ] = (
        "Saved management commentary"
    )


    result[
        "ai_generated"
    ] = False


    result[
        "saved_commentary"
    ] = True


    return result


@router.put(
    "/projects/{project_code}/workflow/commentary"
)
def save_project_commentary(
    project_code: str,
    payload: CommentaryUpdate,
):

    initialise_workflow_tables()

    if (
        project_code
        !=
        payload.project_code
    ):

        raise HTTPException(
            status_code=422,
            detail=(
                "Project code mismatch"
            ),
        )


    today = (
        date.today()
        .isoformat()
    )


    with get_connection() as connection:

        connection.execute(
            """
            INSERT INTO workflow_commentary (

                project_code,
                reporting_period,
                cost_commentary,
                progress_commentary,
                schedule_commentary,
                procurement_commentary,
                created_date,
                updated_date

            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?)

            ON CONFLICT(
                project_code,
                reporting_period
            )

            DO UPDATE SET

                cost_commentary =
                    excluded.cost_commentary,

                progress_commentary =
                    excluded.progress_commentary,

                schedule_commentary =
                    excluded.schedule_commentary,

                procurement_commentary =
                    excluded.procurement_commentary,

                updated_date =
                    excluded.updated_date
            """,
            (
                payload.project_code,
                payload.reporting_period,
                payload.cost_commentary,
                payload.progress_commentary,
                payload.schedule_commentary,
                payload.procurement_commentary,
                today,
                today,
            ),
        )

        connection.commit()


    return {
        "success": True,

        "project_code": (
            project_code
        ),

        "reporting_period": (
            payload.reporting_period
        ),

        "message": (
            "Management commentary saved"
        ),
    }


# ============================================================
# ACTION LOG
# ============================================================

@router.get(
    "/projects/{project_code}/workflow/actions"
)
def get_project_actions(
    project_code: str,
    reporting_period: str | None = None,
):

    initialise_workflow_tables()

    with get_connection() as connection:

        if reporting_period:

            rows = connection.execute(
                """
                SELECT *

                FROM workflow_actions

                WHERE
                    project_code = ?
                    AND reporting_period = ?

                ORDER BY

                    CASE priority

                        WHEN 'Critical'
                        THEN 1

                        WHEN 'High'
                        THEN 2

                        WHEN 'Medium'
                        THEN 3

                        ELSE 4

                    END,

                    due_date
                """,
                (
                    project_code,
                    reporting_period,
                ),
            ).fetchall()

        else:

            rows = connection.execute(
                """
                SELECT *

                FROM workflow_actions

                WHERE project_code = ?

                ORDER BY

                    CASE priority

                        WHEN 'Critical'
                        THEN 1

                        WHEN 'High'
                        THEN 2

                        WHEN 'Medium'
                        THEN 3

                        ELSE 4

                    END,

                    due_date
                """,
                (
                    project_code,
                ),
            ).fetchall()


    actions = [
        dict(row)
        for row in rows
    ]


    return {
        "project_code": (
            project_code
        ),

        "reporting_period": (
            reporting_period
        ),

        "action_count": len(
            actions
        ),

        "open_actions": sum(
            1
            for action in actions
            if action[
                "status"
            ]
            !=
            "Closed"
        ),

        "closed_actions": sum(
            1
            for action in actions
            if action[
                "status"
            ]
            ==
            "Closed"
        ),

        "actions": (
            actions
        ),
    }


@router.post(
    "/projects/{project_code}/workflow/actions"
)
def create_project_action(
    project_code: str,
    payload: ActionCreate,
):

    initialise_workflow_tables()


    if (
        project_code
        !=
        payload.project_code
    ):

        raise HTTPException(
            status_code=422,
            detail=(
                "Project code mismatch"
            ),
        )


    validate_action_fields(
        payload.category,
        payload.status,
        payload.priority,
    )


    today = (
        date.today()
        .isoformat()
    )


    owner_role = (
        payload.owner_role
        or
        OWNER_ROLE_MAPPING.get(
            payload.category,
            "Project Manager",
        )
    )


    with get_connection() as connection:

        cursor = connection.execute(
            """
            INSERT INTO workflow_actions (

                project_code,
                reporting_period,
                category,
                issue,
                owner_role,
                due_date,
                status,
                priority,
                source,
                created_date,
                updated_date

            )

            VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?
            )
            """,
            (
                payload.project_code,
                payload.reporting_period,
                payload.category,
                payload.issue,
                owner_role,
                payload.due_date,
                payload.status,
                payload.priority,
                payload.source,
                today,
                today,
            ),
        )

        connection.commit()

        action_id = (
            cursor.lastrowid
        )


    return {
        "success": True,

        "action_id": (
            action_id
        ),

        "message": (
            "Action created"
        ),
    }


@router.patch(
    "/workflow/actions/{action_id}"
)
def update_action(
    action_id: int,
    payload: ActionUpdate,
):

    initialise_workflow_tables()


    updates = []

    parameters = []


    if payload.owner_role is not None:

        updates.append(
            "owner_role = ?"
        )

        parameters.append(
            payload.owner_role
        )


    if payload.due_date is not None:

        updates.append(
            "due_date = ?"
        )

        parameters.append(
            payload.due_date
        )


    if payload.status is not None:

        if (
            payload.status
            not in
            VALID_STATUSES
        ):

            raise HTTPException(
                status_code=422,
                detail=(
                    "Invalid action status"
                ),
            )

        updates.append(
            "status = ?"
        )

        parameters.append(
            payload.status
        )


    if payload.priority is not None:

        if (
            payload.priority
            not in
            VALID_PRIORITIES
        ):

            raise HTTPException(
                status_code=422,
                detail=(
                    "Invalid action priority"
                ),
            )

        updates.append(
            "priority = ?"
        )

        parameters.append(
            payload.priority
        )


    if payload.issue is not None:

        updates.append(
            "issue = ?"
        )

        parameters.append(
            payload.issue
        )


    if not updates:

        raise HTTPException(
            status_code=422,
            detail=(
                "No update fields supplied"
            ),
        )


    updates.append(
        "updated_date = ?"
    )

    parameters.append(
        date.today().isoformat()
    )


    parameters.append(
        action_id
    )


    with get_connection() as connection:

        cursor = connection.execute(
            f"""
            UPDATE workflow_actions

            SET
                {", ".join(updates)}

            WHERE action_id = ?
            """,
            tuple(
                parameters
            ),
        )

        connection.commit()


        if cursor.rowcount == 0:

            raise HTTPException(
                status_code=404,
                detail=(
                    "Action not found"
                ),
            )


    return {
        "success": True,

        "action_id": (
            action_id
        ),

        "message": (
            "Action updated"
        ),
    }


@router.delete(
    "/workflow/actions/{action_id}"
)
def delete_action(
    action_id: int,
):

    initialise_workflow_tables()


    with get_connection() as connection:

        cursor = connection.execute(
            """
            DELETE FROM workflow_actions

            WHERE action_id = ?
            """,
            (
                action_id,
            ),
        )

        connection.commit()


        if cursor.rowcount == 0:

            raise HTTPException(
                status_code=404,
                detail=(
                    "Action not found"
                ),
            )


    return {
        "success": True,

        "action_id": (
            action_id
        ),

        "message": (
            "Action deleted"
        ),
    }


# ============================================================
# AUTO-GENERATED ACTION SUGGESTIONS
# ============================================================

@router.get(
    "/projects/{project_code}/workflow/action-suggestions"
)
def get_action_suggestions(
    project_code: str,
    reporting_period: str,
):

    commentary = (
        generate_management_commentary(
            project_code,
            reporting_period,
        )
    )


    with get_connection() as connection:

        project = connection.execute(
            """
            SELECT
                forecast_variance_pct,
                progress_variance_pct,
                forecast_credibility_gap_pct

            FROM report_management_scorecard

            WHERE project_code = ?
            """,
            (
                project_code,
            ),
        ).fetchone()


        schedule = connection.execute(
            """
            SELECT

                SUM(
                    CASE
                        WHEN is_critical = 1
                        AND delayed_activity_flag = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS critical_delays

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


    suggestions = []


    forecast_variance = float(
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


    credibility_gap = float(
        project[
            "forecast_credibility_gap_pct"
        ]
        or 0
    )


    critical_schedule = int(
        schedule[
            "critical_delays"
        ]
        or 0
    )


    critical_procurement = int(
        procurement[
            "critical_delays"
        ]
        or 0
    )


    if forecast_variance <= -5:

        suggestions.append(
            {
                "category": (
                    "Cost"
                ),

                "issue": (
                    "Review forecast overrun "
                    "and confirm recovery or "
                    "mitigation plan."
                ),

                "owner_role": (
                    OWNER_ROLE_MAPPING[
                        "Cost"
                    ]
                ),

                "priority": (
                    "Critical"
                    if forecast_variance
                    <= -10
                    else "High"
                ),
            }
        )


    if progress_variance <= -5:

        suggestions.append(
            {
                "category": (
                    "Progress"
                ),

                "issue": (
                    "Review progress recovery "
                    "plan against current "
                    "programme."
                ),

                "owner_role": (
                    OWNER_ROLE_MAPPING[
                        "Progress"
                    ]
                ),

                "priority": (
                    "Critical"
                    if progress_variance
                    <= -10
                    else "High"
                ),
            }
        )


    if critical_schedule > 0:

        suggestions.append(
            {
                "category": (
                    "Schedule"
                ),

                "issue": (
                    "Confirm recovery actions "
                    "for delayed critical-path "
                    "activities."
                ),

                "owner_role": (
                    OWNER_ROLE_MAPPING[
                        "Schedule"
                    ]
                ),

                "priority": (
                    "Critical"
                ),
            }
        )


    if critical_procurement > 0:

        suggestions.append(
            {
                "category": (
                    "Procurement"
                ),

                "issue": (
                    "Escalate critical supplier "
                    "delivery delay and confirm "
                    "recovery date."
                ),

                "owner_role": (
                    OWNER_ROLE_MAPPING[
                        "Procurement"
                    ]
                ),

                "priority": (
                    "Critical"
                ),
            }
        )


    if credibility_gap >= 10:

        suggestions.append(
            {
                "category": (
                    "Forecast Credibility"
                ),

                "issue": (
                    "Challenge reported FAC "
                    "against current cost and "
                    "physical progress."
                ),

                "owner_role": (
                    OWNER_ROLE_MAPPING[
                        "Forecast Credibility"
                    ]
                ),

                "priority": (
                    "Critical"
                    if credibility_gap
                    >= 20
                    else "High"
                ),
            }
        )


    return {
        "project_code": (
            project_code
        ),

        "reporting_period": (
            reporting_period
        ),

        "suggestion_count": len(
            suggestions
        ),

        "suggestions": (
            suggestions
        ),

        "commentary": (
            commentary
        ),

        "generated_by": (
            "Deterministic management rules"
        ),

        "ai_generated": False,
    }