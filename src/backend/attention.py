from pathlib import Path
import sqlite3

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/attention",
    tags=["Tunable Management Attention"],
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
# DEFAULT WEIGHTS
# ============================================================

DEFAULT_WEIGHTS = {
    "cost": 30.0,
    "progress": 25.0,
    "critical_schedule": 25.0,
    "procurement": 15.0,
    "data_quality": 5.0,
}


# ============================================================
# DEFAULT COMPONENT THRESHOLDS
# ============================================================

DEFAULT_COMPONENT_THRESHOLDS = {

    "cost": {
        "low": 1.0,
        "medium": 5.0,
        "high": 10.0,
    },

    "progress": {
        "low": 1.0,
        "medium": 5.0,
        "high": 10.0,
    },

    "critical_schedule": {
        "high_ratio": 0.50,
    },

    "procurement": {
        "medium_ratio": 0.25,
        "high_ratio": 0.75,
    },
}


# ============================================================
# DEFAULT ATTENTION THRESHOLDS
# ============================================================

DEFAULT_ATTENTION_THRESHOLDS = {
    "watch": 30.0,
    "critical": 60.0,
}


# ============================================================
# DESCRIPTION
# ============================================================

ATTENTION_DESCRIPTION = (
    "Rules-based management prioritisation index. "
    "The score indicates management attention severity "
    "and is not a probability of project failure."
)


# ============================================================
# DATABASE
# ============================================================

def get_connection():

    if not DATABASE_PATH.exists():

        raise HTTPException(
            status_code=500,
            detail=(
                f"ControlSight database not found: "
                f"{DATABASE_PATH}"
            ),
        )

    connection = sqlite3.connect(
        DATABASE_PATH
    )

    connection.row_factory = (
        sqlite3.Row
    )

    return connection


# ============================================================
# PYDANTIC MODELS
# ============================================================

class AttentionWeights(BaseModel):

    cost: float = Field(
        default=DEFAULT_WEIGHTS["cost"],
        ge=0,
        le=100,
    )

    progress: float = Field(
        default=DEFAULT_WEIGHTS["progress"],
        ge=0,
        le=100,
    )

    critical_schedule: float = Field(
        default=DEFAULT_WEIGHTS[
            "critical_schedule"
        ],
        ge=0,
        le=100,
    )

    procurement: float = Field(
        default=DEFAULT_WEIGHTS[
            "procurement"
        ],
        ge=0,
        le=100,
    )

    data_quality: float = Field(
        default=DEFAULT_WEIGHTS[
            "data_quality"
        ],
        ge=0,
        le=100,
    )


class CostThresholds(BaseModel):

    low: float = Field(
        default=1.0,
        ge=0,
        le=100,
    )

    medium: float = Field(
        default=5.0,
        ge=0,
        le=100,
    )

    high: float = Field(
        default=10.0,
        ge=0,
        le=100,
    )


class ProgressThresholds(BaseModel):

    low: float = Field(
        default=1.0,
        ge=0,
        le=100,
    )

    medium: float = Field(
        default=5.0,
        ge=0,
        le=100,
    )

    high: float = Field(
        default=10.0,
        ge=0,
        le=100,
    )


class ScheduleThresholds(BaseModel):

    high_ratio: float = Field(
        default=0.50,
        ge=0,
        le=1,
    )


class ProcurementThresholds(BaseModel):

    medium_ratio: float = Field(
        default=0.25,
        ge=0,
        le=1,
    )

    high_ratio: float = Field(
        default=0.75,
        ge=0,
        le=1,
    )


class ComponentThresholds(BaseModel):

    cost: CostThresholds = (
        CostThresholds()
    )

    progress: ProgressThresholds = (
        ProgressThresholds()
    )

    critical_schedule: ScheduleThresholds = (
        ScheduleThresholds()
    )

    procurement: ProcurementThresholds = (
        ProcurementThresholds()
    )


class AttentionLevelThresholds(BaseModel):

    watch: float = Field(
        default=30.0,
        ge=0,
    )

    critical: float = Field(
        default=60.0,
        ge=0,
    )


class AttentionRerankRequest(BaseModel):

    weights: AttentionWeights = (
        AttentionWeights()
    )

    component_thresholds: ComponentThresholds = (
        ComponentThresholds()
    )

    attention_thresholds: AttentionLevelThresholds = (
        AttentionLevelThresholds()
    )


# ============================================================
# VALIDATION
# ============================================================

def validate_config(
    request: AttentionRerankRequest,
):

    weights = request.weights

    maximum_score = (
        weights.cost
        +
        weights.progress
        +
        weights.critical_schedule
        +
        weights.procurement
        +
        weights.data_quality
    )


    if maximum_score <= 0:

        raise HTTPException(
            status_code=422,
            detail=(
                "At least one attention weight "
                "must be greater than zero."
            ),
        )


    cost = (
        request
        .component_thresholds
        .cost
    )

    if not (
        cost.low
        <=
        cost.medium
        <=
        cost.high
    ):

        raise HTTPException(
            status_code=422,
            detail=(
                "Cost thresholds must satisfy: "
                "low <= medium <= high."
            ),
        )


    progress = (
        request
        .component_thresholds
        .progress
    )

    if not (
        progress.low
        <=
        progress.medium
        <=
        progress.high
    ):

        raise HTTPException(
            status_code=422,
            detail=(
                "Progress thresholds must satisfy: "
                "low <= medium <= high."
            ),
        )


    procurement = (
        request
        .component_thresholds
        .procurement
    )

    if not (
        procurement.medium_ratio
        <=
        procurement.high_ratio
    ):

        raise HTTPException(
            status_code=422,
            detail=(
                "Procurement medium ratio must "
                "be <= high ratio."
            ),
        )


    attention = (
        request
        .attention_thresholds
    )

    if (
        attention.watch
        >
        attention.critical
    ):

        raise HTTPException(
            status_code=422,
            detail=(
                "Watch threshold must be "
                "<= Critical threshold."
            ),
        )


    if (
        attention.critical
        >
        maximum_score
    ):

        raise HTTPException(
            status_code=422,
            detail=(
                "Critical attention threshold cannot "
                "exceed the total available score."
            ),
        )


    return maximum_score


# ============================================================
# SCORE HELPERS
# ============================================================

def proportional_score(
    weight,
    factor,
):

    return round(
        float(weight)
        *
        float(factor),
        2,
    )


def calculate_cost_score(
    forecast_variance_pct,
    weight,
    thresholds,
):

    overrun_pct = max(
        0.0,
        -
        float(
            forecast_variance_pct
            or 0
        ),
    )


    if (
        overrun_pct
        >=
        thresholds.high
    ):

        return (
            proportional_score(
                weight,
                1.0,
            ),
            "High",
        )


    if (
        overrun_pct
        >=
        thresholds.medium
    ):

        return (
            proportional_score(
                weight,
                2 / 3,
            ),
            "Medium",
        )


    if (
        overrun_pct
        >=
        thresholds.low
    ):

        return (
            proportional_score(
                weight,
                1 / 3,
            ),
            "Low",
        )


    return (
        0.0,
        "None",
    )


def calculate_progress_score(
    progress_variance_pct,
    weight,
    thresholds,
):

    lag_pct = max(
        0.0,
        -
        float(
            progress_variance_pct
            or 0
        ),
    )


    if (
        lag_pct
        >=
        thresholds.high
    ):

        return (
            proportional_score(
                weight,
                1.0,
            ),
            "High",
        )


    if (
        lag_pct
        >=
        thresholds.medium
    ):

        return (
            proportional_score(
                weight,
                0.60,
            ),
            "Medium",
        )


    if (
        lag_pct
        >=
        thresholds.low
    ):

        return (
            proportional_score(
                weight,
                0.20,
            ),
            "Low",
        )


    return (
        0.0,
        "None",
    )


def calculate_schedule_score(
    critical_delayed,
    critical_activities,
    weight,
    thresholds,
):

    critical_delayed = int(
        critical_delayed
        or 0
    )

    critical_activities = int(
        critical_activities
        or 0
    )


    if critical_activities <= 0:

        return (
            0.0,
            "None",
            0.0,
        )


    ratio = (
        critical_delayed
        /
        critical_activities
    )


    if (
        ratio
        >=
        thresholds.high_ratio
    ):

        return (
            proportional_score(
                weight,
                1.0,
            ),
            "High",
            ratio,
        )


    if critical_delayed > 0:

        return (
            proportional_score(
                weight,
                0.60,
            ),
            "Medium",
            ratio,
        )


    return (
        0.0,
        "None",
        ratio,
    )


def calculate_procurement_score(
    delayed_items,
    total_items,
    critical_delays,
    weight,
    thresholds,
):

    delayed_items = int(
        delayed_items
        or 0
    )

    total_items = int(
        total_items
        or 0
    )

    critical_delays = int(
        critical_delays
        or 0
    )


    if total_items > 0:

        delay_ratio = (
            delayed_items
            /
            total_items
        )

    else:

        delay_ratio = 0.0


    if critical_delays > 0:

        return (
            proportional_score(
                weight,
                1.0,
            ),
            "Critical",
            delay_ratio,
        )


    if (
        delay_ratio
        >=
        thresholds.high_ratio
    ):

        return (
            proportional_score(
                weight,
                2 / 3,
            ),
            "High",
            delay_ratio,
        )


    if (
        delay_ratio
        >=
        thresholds.medium_ratio
    ):

        return (
            proportional_score(
                weight,
                1 / 3,
            ),
            "Medium",
            delay_ratio,
        )


    return (
        0.0,
        "None",
        delay_ratio,
    )


def calculate_data_quality_score(
    cost_anomalies,
    weight,
):

    cost_anomalies = int(
        cost_anomalies
        or 0
    )


    if cost_anomalies > 0:

        return (
            proportional_score(
                weight,
                1.0,
            ),
            "Review",
        )


    return (
        0.0,
        "None",
    )


# ============================================================
# ATTENTION LEVEL
# ============================================================

def calculate_attention_level(
    score,
    maximum_score,
    thresholds,
    cost_anomalies,
):

    if (
        score
        >=
        thresholds.critical
    ):

        return "Critical"


    if (
        score
        >=
        thresholds.watch
    ):

        return "Watch"


    if (
        int(
            cost_anomalies
            or 0
        )
        >
        0
    ):

        return "Review"


    return "Stable"


# ============================================================
# DRIVER
# ============================================================

DRIVER_LABELS = {

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


def calculate_primary_driver(
    score_breakdown,
):

    if not score_breakdown:

        return (
            "No material exception"
        )


    maximum_value = max(
        score_breakdown.values()
    )


    if maximum_value <= 0:

        return (
            "No material exception"
        )


    primary_key = max(
        score_breakdown,
        key=score_breakdown.get,
    )


    return DRIVER_LABELS.get(
        primary_key,
        primary_key,
    )


# ============================================================
# PROJECT DATA
# ============================================================

def get_project_rows(
    connection,
):

    rows = connection.execute(
        """
        SELECT *

        FROM report_management_scorecard

        ORDER BY project_code
        """
    ).fetchall()


    return [
        dict(row)
        for row in rows
    ]


def get_schedule_summary(
    connection,
    project_code,
):

    row = connection.execute(
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


    return dict(
        row
    )


def get_procurement_summary(
    connection,
    project_code,
):

    row = connection.execute(
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


    return dict(
        row
    )


def get_quality_summary(
    connection,
    project_code,
):

    row = connection.execute(
        """
        SELECT

            COUNT(*)
                AS cost_anomalies

        FROM fact_cost

        WHERE
            project_code = ?
            AND
            cost_anomaly_flag = 1
        """,
        (
            project_code,
        ),
    ).fetchone()


    return dict(
        row
    )


# ============================================================
# RERANK ENGINE
# ============================================================

def run_rerank(
    request: AttentionRerankRequest,
):

    maximum_score = (
        validate_config(
            request
        )
    )


    weights = (
        request.weights
    )


    component_thresholds = (
        request
        .component_thresholds
    )


    attention_thresholds = (
        request
        .attention_thresholds
    )


    ranking = []


    with get_connection() as connection:

        projects = (
            get_project_rows(
                connection
            )
        )


        for project in projects:

            project_code = (
                project[
                    "project_code"
                ]
            )


            schedule = (
                get_schedule_summary(
                    connection,
                    project_code,
                )
            )


            procurement = (
                get_procurement_summary(
                    connection,
                    project_code,
                )
            )


            quality = (
                get_quality_summary(
                    connection,
                    project_code,
                )
            )


            # ------------------------------------------------
            # COST
            # ------------------------------------------------

            (
                cost_score,
                cost_band,
            ) = calculate_cost_score(
                project.get(
                    "forecast_variance_pct"
                ),
                weights.cost,
                component_thresholds.cost,
            )


            # ------------------------------------------------
            # PROGRESS
            # ------------------------------------------------

            (
                progress_score,
                progress_band,
            ) = calculate_progress_score(
                project.get(
                    "progress_variance_pct"
                ),
                weights.progress,
                component_thresholds.progress,
            )


            # ------------------------------------------------
            # SCHEDULE
            # ------------------------------------------------

            (
                schedule_score,
                schedule_band,
                critical_delay_ratio,
            ) = calculate_schedule_score(
                schedule.get(
                    "critical_delayed_activities"
                ),
                schedule.get(
                    "critical_activities"
                ),
                weights.critical_schedule,
                (
                    component_thresholds
                    .critical_schedule
                ),
            )


            # ------------------------------------------------
            # PROCUREMENT
            # ------------------------------------------------

            (
                procurement_score,
                procurement_band,
                procurement_delay_ratio,
            ) = calculate_procurement_score(
                procurement.get(
                    "delayed_items"
                ),
                procurement.get(
                    "total_items"
                ),
                procurement.get(
                    "critical_delays"
                ),
                weights.procurement,
                component_thresholds.procurement,
            )


            # ------------------------------------------------
            # DATA QUALITY
            # ------------------------------------------------

            (
                data_quality_score,
                data_quality_band,
            ) = calculate_data_quality_score(
                quality.get(
                    "cost_anomalies"
                ),
                weights.data_quality,
            )


            # ------------------------------------------------
            # BREAKDOWN
            # ------------------------------------------------

            score_breakdown = {

                "cost":
                    cost_score,

                "progress":
                    progress_score,

                "critical_schedule":
                    schedule_score,

                "procurement":
                    procurement_score,

                "data_quality":
                    data_quality_score,
            }


            attention_score = round(
                sum(
                    score_breakdown.values()
                ),
                2,
            )


            attention_score_pct = round(
                attention_score
                /
                maximum_score
                *
                100,
                2,
            )


            attention_level = (
                calculate_attention_level(
                    attention_score,
                    maximum_score,
                    attention_thresholds,
                    quality.get(
                        "cost_anomalies"
                    ),
                )
            )


            primary_driver = (
                calculate_primary_driver(
                    score_breakdown
                )
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
                        round(
                            maximum_score,
                            2,
                        ),

                    "attention_score_pct":
                        attention_score_pct,

                    "attention_level":
                        attention_level,

                    "primary_driver":
                        primary_driver,

                    "forecast_variance_pct":
                        round(
                            float(
                                project.get(
                                    "forecast_variance_pct"
                                )
                                or 0
                            ),
                            2,
                        ),

                    "progress_variance_pct":
                        round(
                            float(
                                project.get(
                                    "progress_variance_pct"
                                )
                                or 0
                            ),
                            2,
                        ),

                    "critical_activities":
                        int(
                            schedule.get(
                                "critical_activities"
                            )
                            or 0
                        ),

                    "critical_delayed_activities":
                        int(
                            schedule.get(
                                "critical_delayed_activities"
                            )
                            or 0
                        ),

                    "critical_delay_ratio":
                        round(
                            critical_delay_ratio,
                            4,
                        ),

                    "total_procurement_items":
                        int(
                            procurement.get(
                                "total_items"
                            )
                            or 0
                        ),

                    "delayed_procurement":
                        int(
                            procurement.get(
                                "delayed_items"
                            )
                            or 0
                        ),

                    "critical_procurement_delays":
                        int(
                            procurement.get(
                                "critical_delays"
                            )
                            or 0
                        ),

                    "procurement_delay_ratio":
                        round(
                            procurement_delay_ratio,
                            4,
                        ),

                    "cost_anomalies":
                        int(
                            quality.get(
                                "cost_anomalies"
                            )
                            or 0
                        ),

                    "score_breakdown":
                        score_breakdown,

                    "component_status": {

                        "cost":
                            cost_band,

                        "progress":
                            progress_band,

                        "critical_schedule":
                            schedule_band,

                        "procurement":
                            procurement_band,

                        "data_quality":
                            data_quality_band,
                    },

                    "score_components": {

                        "cost": {
                            "score":
                                cost_score,

                            "maximum":
                                weights.cost,
                        },

                        "progress": {
                            "score":
                                progress_score,

                            "maximum":
                                weights.progress,
                        },

                        "critical_schedule": {
                            "score":
                                schedule_score,

                            "maximum":
                                weights.critical_schedule,
                        },

                        "procurement": {
                            "score":
                                procurement_score,

                            "maximum":
                                weights.procurement,
                        },

                        "data_quality": {
                            "score":
                                data_quality_score,

                            "maximum":
                                weights.data_quality,
                        },
                    },
                }
            )


    # ========================================================
    # SORT
    # ========================================================

    ranking.sort(
        key=lambda item: (
            item[
                "attention_score"
            ],
            item[
                "forecast_variance_pct"
            ],
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


    # ========================================================
    # SUMMARY
    # ========================================================

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


    return {

        "methodology":
            ATTENTION_DESCRIPTION,

        "custom_configuration":
            True,

        "maximum_score":
            round(
                maximum_score,
                2,
            ),

        "configuration": {

            "weights":
                request.weights.model_dump(),

            "component_thresholds":
                request
                .component_thresholds
                .model_dump(),

            "attention_thresholds":
                request
                .attention_thresholds
                .model_dump(),
        },

        "summary":
            summary,

        "projects":
            ranking,
    }


# ============================================================
# DEFAULT CONFIG
# ============================================================

def get_default_request():

    return AttentionRerankRequest(
        weights=AttentionWeights(
            **DEFAULT_WEIGHTS
        ),

        component_thresholds=(
            ComponentThresholds(
                cost=CostThresholds(
                    **DEFAULT_COMPONENT_THRESHOLDS[
                        "cost"
                    ]
                ),

                progress=ProgressThresholds(
                    **DEFAULT_COMPONENT_THRESHOLDS[
                        "progress"
                    ]
                ),

                critical_schedule=ScheduleThresholds(
                    **DEFAULT_COMPONENT_THRESHOLDS[
                        "critical_schedule"
                    ]
                ),

                procurement=ProcurementThresholds(
                    **DEFAULT_COMPONENT_THRESHOLDS[
                        "procurement"
                    ]
                ),
            )
        ),

        attention_thresholds=(
            AttentionLevelThresholds(
                **DEFAULT_ATTENTION_THRESHOLDS
            )
        ),
    )


# ============================================================
# API — CONFIG
# ============================================================

@router.get(
    "/config"
)
def get_attention_config():

    request = (
        get_default_request()
    )


    maximum_score = (
        validate_config(
            request
        )
    )


    return {

        "name":
            "Management Attention Index",

        "description":
            ATTENTION_DESCRIPTION,

        "default_configuration": {

            "weights":
                request.weights.model_dump(),

            "component_thresholds":
                request
                .component_thresholds
                .model_dump(),

            "attention_thresholds":
                request
                .attention_thresholds
                .model_dump(),
        },

        "maximum_score":
            maximum_score,

        "component_descriptions": {

            "cost":
                (
                    "Forecast overrun severity "
                    "relative to approved budget."
                ),

            "progress":
                (
                    "Actual progress lag "
                    "relative to plan."
                ),

            "critical_schedule":
                (
                    "Share of critical activities "
                    "currently delayed."
                ),

            "procurement":
                (
                    "Procurement delay exposure, "
                    "including critical deliveries."
                ),

            "data_quality":
                (
                    "Retained cost-data anomalies "
                    "requiring review."
                ),
        },

        "important_note":
            (
                "The Management Attention Index "
                "is a prioritisation tool and "
                "not a probability of project failure."
            ),
    }


# ============================================================
# API — DEFAULT RANKING
# ============================================================

@router.get(
    "/ranking"
)
def get_default_attention_ranking():

    request = (
        get_default_request()
    )


    result = (
        run_rerank(
            request
        )
    )


    result[
        "custom_configuration"
    ] = False


    return result


# ============================================================
# API — CUSTOM RERANK
# ============================================================

@router.post(
    "/rerank"
)
def rerank_attention(
    request: AttentionRerankRequest,
):

    return run_rerank(
        request
    )


# ============================================================
# API — RESET
# ============================================================

@router.get(
    "/reset"
)
def reset_attention_configuration():

    request = (
        get_default_request()
    )


    return {

        "message":
            (
                "Default Management Attention "
                "configuration restored."
            ),

        "configuration": {

            "weights":
                request.weights.model_dump(),

            "component_thresholds":
                request
                .component_thresholds
                .model_dump(),

            "attention_thresholds":
                request
                .attention_thresholds
                .model_dump(),
        },
    }


# ============================================================
# HEALTH
# ============================================================

@router.get(
    "/health/status"
)
def attention_health():

    return {

        "status":
            "ok",

        "engine":
            "Tunable Management Attention",

        "database_available":
            DATABASE_PATH.exists(),

        "default_maximum_score":
            sum(
                DEFAULT_WEIGHTS.values()
            ),

        "custom_reranking":
            True,

        "persistent_configuration":
            False,
    }
