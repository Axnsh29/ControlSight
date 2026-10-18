from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

import pandas as pd


# ======================================================================
# PATHS
# ======================================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
DATABASE_DIR = PROJECT_ROOT / "data" / "database"

DEFAULT_OUTPUT = DATABASE_DIR / "controlsight_rebuilt.db"


# ======================================================================
# EXPECTED PORTFOLIO OUTPUT
# Used as a regression check against the validated ControlSight model.
# ======================================================================

EXPECTED_PORTFOLIO = {
    "total_budget": 283_000_000.00,
    "actual_cost_to_date": 273_760_996.12,
    "committed_cost_to_date": 289_259_372.38,
    "forecast_at_completion": 298_963_873.49,
    "forecast_variance": -15_963_873.49,
    "planned_progress_pct": 78.33,
    "actual_progress_pct": 73.71,
    "progress_variance_pct": -4.62,
    "data_quality_score": 99.59,
}


EXPECTED_PROJECTS = {
    "PRJ-001": {
        "forecast_at_completion": 28_429_070.33,
        "planned_progress_pct": 87.50,
        "actual_progress_pct": 87.50,
        "health_status": "Green",
        "management_status": "Green",
    },
    "PRJ-002": {
        "forecast_at_completion": 44_486_768.69,
        "planned_progress_pct": 79.17,
        "actual_progress_pct": 72.00,
        "health_status": "Amber",
        "management_status": "Amber",
    },
    "PRJ-003": {
        "forecast_at_completion": 22_978_606.83,
        "planned_progress_pct": 95.45,
        "actual_progress_pct": 80.44,
        "health_status": "Red",
        "management_status": "Red",
    },
    "PRJ-004": {
        "forecast_at_completion": 54_095_439.02,
        "planned_progress_pct": 71.88,
        "actual_progress_pct": 71.79,
        "health_status": "Green",
        "management_status": "Green",
    },
    "PRJ-005": {
        "forecast_at_completion": 37_672_967.37,
        "planned_progress_pct": 72.73,
        "actual_progress_pct": 70.25,
        "health_status": "Green",
        "management_status": "Amber",
    },
    "PRJ-006": {
        "forecast_at_completion": 35_198_798.58,
        "planned_progress_pct": 90.91,
        "actual_progress_pct": 76.28,
        "health_status": "Red",
        "management_status": "Red",
    },
    "PRJ-007": {
        "forecast_at_completion": 23_630_422.69,
        "planned_progress_pct": 77.78,
        "actual_progress_pct": 79.10,
        "health_status": "Green",
        "management_status": "Green",
    },
    "PRJ-008": {
        "forecast_at_completion": 52_471_799.98,
        "planned_progress_pct": 69.23,
        "actual_progress_pct": 64.96,
        "health_status": "Amber",
        "management_status": "Red",
    },
}


# ======================================================================
# HELPERS
# ======================================================================

def load_csv(filename: str) -> pd.DataFrame:
    path = PROCESSED_DIR / filename

    if not path.exists():
        raise FileNotFoundError(
            f"Required processed dataset not found: {path}"
        )

    return pd.read_csv(path)


def normalise_date(series: pd.Series) -> pd.Series:
    return pd.to_datetime(
        series,
        errors="coerce"
    ).dt.normalize()


def date_key(series: pd.Series) -> pd.Series:
    parsed = normalise_date(series)

    keys = parsed.dt.strftime("%Y%m%d")

    return pd.to_numeric(
        keys,
        errors="coerce"
    ).astype("Int64")


def as_sql_nullable(series: pd.Series) -> pd.Series:
    """
    Convert pandas nullable values into Python None values so SQLite
    receives proper SQL NULLs.
    """
    return series.astype(object).where(
        pd.notna(series),
        None
    )


def round_numeric(
    dataframe: pd.DataFrame,
    columns: list[str],
    decimals: int = 2,
) -> pd.DataFrame:
    for column in columns:
        if column in dataframe.columns:
            dataframe[column] = pd.to_numeric(
                dataframe[column],
                errors="coerce"
            ).round(decimals)

    return dataframe


# ======================================================================
# LOAD CONTROLLED DATASETS
# ======================================================================

def load_controlled_data() -> dict[str, pd.DataFrame]:
    return {
        "projects": load_csv("projects_clean.csv"),
        "vendors": load_csv("vendors_clean.csv"),
        "packages": load_csv("cost_packages_clean.csv"),
        "cost": load_csv("cost_monthly_clean.csv"),
        "progress": load_csv("progress_updates_clean.csv"),
        "schedule": load_csv("schedule_activities_clean.csv"),
        "procurement": load_csv("procurement_packages_clean.csv"),
        "data_quality": load_csv("data_quality_issues.csv"),
        "etl_audit": load_csv("etl_audit_report.csv"),
    }


# ======================================================================
# DATE DIMENSION
# ======================================================================

def build_date_dimension(
    data: dict[str, pd.DataFrame]
) -> pd.DataFrame:

    # Fixed reporting calendar used by the validated ControlSight model.
    # This keeps the analytical date dimension stable even when no
    # operational records occur on particular dates.

    minimum_date = pd.Timestamp("2024-01-01")
    maximum_date = pd.Timestamp("2027-12-31")

    calendar = pd.DataFrame(
        {
            "date": pd.date_range(
                start=minimum_date,
                end=maximum_date,
                freq="D",
            )
        }
    )

    calendar["date_key"] = (
        calendar["date"]
        .dt.strftime("%Y%m%d")
        .astype(int)
    )

    calendar["year"] = calendar["date"].dt.year
    calendar["month_number"] = calendar["date"].dt.month
    calendar["month_name"] = calendar["date"].dt.month_name()

    calendar["quarter"] = (
        "Q"
        + calendar["date"]
        .dt.quarter
        .astype(str)
    )

    calendar["year_month"] = (
        calendar["date"]
        .dt.strftime("%Y-%m")
    )

    calendar["date"] = (
        calendar["date"]
        .dt.strftime("%Y-%m-%d")
    )

    return calendar[
        [
            "date_key",
            "date",
            "year",
            "month_number",
            "month_name",
            "quarter",
            "year_month",
        ]
    ]


# ======================================================================
# DATABASE SCHEMA
# ======================================================================

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE dim_project (
    project_code TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    project_type TEXT,
    region TEXT,
    start_date TEXT,
    planned_end_date TEXT,
    approved_budget REAL,
    project_manager TEXT,
    status TEXT,
    currency TEXT
);

CREATE TABLE dim_vendor (
    vendor_id TEXT PRIMARY KEY,
    vendor_name TEXT NOT NULL,
    vendor_category TEXT,
    country TEXT
);

CREATE TABLE dim_package (
    package_code TEXT PRIMARY KEY,
    project_code TEXT NOT NULL,
    package_name TEXT NOT NULL,
    cost_category TEXT,
    package_budget REAL,

    FOREIGN KEY (project_code)
        REFERENCES dim_project(project_code)
);

CREATE TABLE dim_date (
    date_key INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    year INTEGER,
    month_number INTEGER,
    month_name TEXT,
    quarter TEXT,
    year_month TEXT
);

CREATE TABLE fact_cost (
    cost_record_id TEXT PRIMARY KEY,
    project_code TEXT NOT NULL,
    package_code TEXT NOT NULL,
    date_key INTEGER NOT NULL,
    cost_category TEXT,
    planned_cost REAL,
    actual_cost REAL,
    committed_cost REAL,
    forecast_at_completion REAL,
    package_budget REAL,
    cost_variance REAL,
    cost_variance_pct REAL,
    forecast_variance REAL,
    forecast_variance_pct REAL,
    cost_anomaly_flag INTEGER,
    currency TEXT,
    source_system TEXT,

    FOREIGN KEY (project_code)
        REFERENCES dim_project(project_code),

    FOREIGN KEY (package_code)
        REFERENCES dim_package(package_code),

    FOREIGN KEY (date_key)
        REFERENCES dim_date(date_key)
);

CREATE TABLE fact_progress (
    progress_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_code TEXT NOT NULL,
    date_key INTEGER NOT NULL,
    planned_progress_pct REAL,
    actual_progress_pct REAL,
    progress_variance_pct REAL,
    behind_schedule_flag INTEGER,
    reported_by TEXT,
    source_system TEXT,

    FOREIGN KEY (project_code)
        REFERENCES dim_project(project_code),

    FOREIGN KEY (date_key)
        REFERENCES dim_date(date_key)
);

CREATE TABLE fact_schedule (
    activity_id TEXT PRIMARY KEY,
    project_code TEXT NOT NULL,
    wbs_code TEXT,
    activity_name TEXT,
    discipline TEXT,
    planned_start_key INTEGER,
    planned_finish_key INTEGER,
    actual_start_key INTEGER,
    actual_finish_key INTEGER,
    percent_complete REAL,
    status TEXT,
    is_critical INTEGER,
    start_delay_days REAL,
    finish_delay_days REAL,
    delayed_activity_flag INTEGER,
    source_system TEXT,

    FOREIGN KEY (project_code)
        REFERENCES dim_project(project_code),

    FOREIGN KEY (planned_start_key)
        REFERENCES dim_date(date_key),

    FOREIGN KEY (planned_finish_key)
        REFERENCES dim_date(date_key),

    FOREIGN KEY (actual_start_key)
        REFERENCES dim_date(date_key),

    FOREIGN KEY (actual_finish_key)
        REFERENCES dim_date(date_key)
);

CREATE TABLE fact_procurement (
    procurement_id TEXT PRIMARY KEY,
    project_code TEXT NOT NULL,
    package_code TEXT NOT NULL,
    vendor_id TEXT,
    category TEXT,
    rfq_date_key INTEGER,
    po_date_key INTEGER,
    planned_delivery_key INTEGER,
    actual_delivery_key INTEGER,
    package_value REAL,
    status TEXT,
    criticality TEXT,
    delivery_delay_days REAL,
    delayed_delivery_flag INTEGER,
    critical_delay_flag INTEGER,
    source_system TEXT,

    FOREIGN KEY (project_code)
        REFERENCES dim_project(project_code),

    FOREIGN KEY (package_code)
        REFERENCES dim_package(package_code),

    FOREIGN KEY (vendor_id)
        REFERENCES dim_vendor(vendor_id),

    FOREIGN KEY (rfq_date_key)
        REFERENCES dim_date(date_key),

    FOREIGN KEY (po_date_key)
        REFERENCES dim_date(date_key),

    FOREIGN KEY (planned_delivery_key)
        REFERENCES dim_date(date_key),

    FOREIGN KEY (actual_delivery_key)
        REFERENCES dim_date(date_key)
);

CREATE TABLE fact_data_quality (
    issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset TEXT,
    row_index INTEGER,
    issue_type TEXT,
    column_name TEXT,
    value TEXT,
    message TEXT
);

CREATE TABLE report_management_scorecard (
    project_code TEXT,
    project_name TEXT,
    approved_budget REAL,
    actual_cost_to_date REAL,
    forecast_at_completion REAL,
    forecast_variance REAL,
    planned_progress_pct REAL,
    actual_progress_pct REAL,
    progress_variance_pct REAL,
    health_status TEXT,
    management_status TEXT,
    forecast_variance_pct REAL,
    total_procurement_items INTEGER,
    delayed_items INTEGER,
    critical_delays INTEGER
);

CREATE TABLE report_portfolio_kpis (
    total_budget REAL,
    actual_cost_to_date REAL,
    committed_cost_to_date REAL,
    forecast_at_completion REAL,
    forecast_variance REAL,
    planned_progress_pct REAL,
    actual_progress_pct REAL,
    progress_variance_pct REAL,
    data_quality_score REAL
);
"""


# ======================================================================
# DIMENSION LOADERS
# ======================================================================

def prepare_projects(
    projects: pd.DataFrame
) -> pd.DataFrame:

    frame = projects.copy()

    frame["start_date"] = (
        normalise_date(frame["start_date"])
        .dt.strftime("%Y-%m-%d")
    )

    frame["planned_end_date"] = (
        normalise_date(frame["planned_end_date"])
        .dt.strftime("%Y-%m-%d")
    )

    return frame[
        [
            "project_code",
            "project_name",
            "project_type",
            "region",
            "start_date",
            "planned_end_date",
            "approved_budget",
            "project_manager",
            "status",
            "currency",
        ]
    ]


def prepare_vendors(
    vendors: pd.DataFrame
) -> pd.DataFrame:

    return vendors[
        [
            "vendor_id",
            "vendor_name",
            "vendor_category",
            "country",
        ]
    ].copy()


def prepare_packages(
    packages: pd.DataFrame
) -> pd.DataFrame:

    return packages[
        [
            "package_code",
            "project_code",
            "package_name",
            "cost_category",
            "package_budget",
        ]
    ].copy()


# ======================================================================
# FACT LOADERS
# ======================================================================

def prepare_cost(
    cost: pd.DataFrame
) -> pd.DataFrame:

    frame = cost.copy()

    frame["date_key"] = date_key(
        frame["report_month"]
    )

    return frame[
        [
            "cost_record_id",
            "project_code",
            "package_code",
            "date_key",
            "cost_category",
            "planned_cost",
            "actual_cost",
            "committed_cost",
            "forecast_at_completion",
            "package_budget",
            "cost_variance",
            "cost_variance_pct",
            "forecast_variance",
            "forecast_variance_pct",
            "cost_anomaly_flag",
            "currency",
            "source_system",
        ]
    ]


def prepare_progress(
    progress: pd.DataFrame
) -> pd.DataFrame:

    frame = progress.copy()

    frame["date_key"] = date_key(
        frame["report_month"]
    )

    return frame[
        [
            "project_code",
            "date_key",
            "planned_progress_pct",
            "actual_progress_pct",
            "progress_variance_pct",
            "behind_schedule_flag",
            "reported_by",
            "source_system",
        ]
    ]


def prepare_schedule(
    schedule: pd.DataFrame
) -> pd.DataFrame:

    frame = schedule.copy()

    frame["planned_start_key"] = date_key(
        frame["planned_start"]
    )

    frame["planned_finish_key"] = date_key(
        frame["planned_finish"]
    )

    frame["actual_start_key"] = date_key(
        frame["actual_start"]
    )

    frame["actual_finish_key"] = date_key(
        frame["actual_finish"]
    )

    nullable_keys = [
        "planned_start_key",
        "planned_finish_key",
        "actual_start_key",
        "actual_finish_key",
    ]

    for column in nullable_keys:
        frame[column] = as_sql_nullable(
            frame[column]
        )

    return frame[
        [
            "activity_id",
            "project_code",
            "wbs_code",
            "activity_name",
            "discipline",
            "planned_start_key",
            "planned_finish_key",
            "actual_start_key",
            "actual_finish_key",
            "percent_complete",
            "status",
            "is_critical",
            "start_delay_days",
            "finish_delay_days",
            "delayed_activity_flag",
            "source_system",
        ]
    ]


def prepare_procurement(
    procurement: pd.DataFrame
) -> pd.DataFrame:

    frame = procurement.copy()

    mappings = {
        "rfq_date": "rfq_date_key",
        "po_date": "po_date_key",
        "planned_delivery_date": "planned_delivery_key",
        "actual_delivery_date": "actual_delivery_key",
    }

    for source_column, target_column in mappings.items():
        frame[target_column] = date_key(
            frame[source_column]
        )

        frame[target_column] = as_sql_nullable(
            frame[target_column]
        )

    return frame[
        [
            "procurement_id",
            "project_code",
            "package_code",
            "vendor_id",
            "category",
            "rfq_date_key",
            "po_date_key",
            "planned_delivery_key",
            "actual_delivery_key",
            "package_value",
            "status",
            "criticality",
            "delivery_delay_days",
            "delayed_delivery_flag",
            "critical_delay_flag",
            "source_system",
        ]
    ]


def prepare_data_quality(
    issues: pd.DataFrame
) -> pd.DataFrame:

    frame = issues.copy()

    frame = frame.rename(
        columns={
            "column": "column_name",
        }
    )

    return frame[
        [
            "dataset",
            "row_index",
            "issue_type",
            "column_name",
            "value",
            "message",
        ]
    ]


# ======================================================================
# REPORTING LOGIC
# ======================================================================

def calculate_health_status(
    forecast_variance_pct: float,
    progress_variance_pct: float,
) -> str:

    cost_overrun_pct = max(
        0.0,
        -float(forecast_variance_pct)
    )

    progress_lag_pp = max(
        0.0,
        -float(progress_variance_pct)
    )

    if (
        cost_overrun_pct >= 10
        or progress_lag_pp >= 10
    ):
        return "Red"

    if (
        cost_overrun_pct >= 5
        or progress_lag_pp >= 5
    ):
        return "Amber"

    return "Green"


def calculate_management_status(
    forecast_variance_pct: float,
    progress_variance_pct: float,
    critical_procurement_delays: int,
) -> str:

    cost_overrun_pct = max(
        0.0,
        -float(forecast_variance_pct)
    )

    progress_lag_pp = max(
        0.0,
        -float(progress_variance_pct)
    )

    if (
        cost_overrun_pct >= 8
        or progress_lag_pp >= 10
    ):
        return "Red"

    if (
        cost_overrun_pct >= 4
        or progress_lag_pp >= 5
        or int(critical_procurement_delays) > 0
    ):
        return "Amber"

    return "Green"


def build_management_scorecard(
    data: dict[str, pd.DataFrame]
) -> pd.DataFrame:

    projects = data["projects"].copy()
    cost = data["cost"].copy()
    progress = data["progress"].copy()
    procurement = data["procurement"].copy()

    # --------------------------------------------------------------
    # ACTUAL COST TO DATE
    # Monthly actual cost values are flows, so they are accumulated.
    # --------------------------------------------------------------

    actual_cost = (
        cost.groupby(
            "project_code",
            as_index=False
        )["actual_cost"]
        .sum()
        .rename(
            columns={
                "actual_cost": "actual_cost_to_date"
            }
        )
    )

    # --------------------------------------------------------------
    # LATEST FORECAST AT COMPLETION
    #
    # FAC is a snapshot, not a monthly flow.
    # Latest package FAC values are aggregated to project level.
    # --------------------------------------------------------------

    cost["_report_month"] = normalise_date(
        cost["report_month"]
    )

    latest_package_rows = (
        cost.sort_values("_report_month")
        .groupby(
            [
                "project_code",
                "package_code",
            ],
            as_index=False
        )
        .tail(1)
    )

    latest_fac = (
        latest_package_rows
        .groupby(
            "project_code",
            as_index=False
        )["forecast_at_completion"]
        .sum()
    )

    # --------------------------------------------------------------
    # LATEST PROGRESS SNAPSHOT
    # --------------------------------------------------------------

    progress["_report_month"] = normalise_date(
        progress["report_month"]
    )

    latest_progress = (
        progress.sort_values("_report_month")
        .groupby(
            "project_code",
            as_index=False
        )
        .tail(1)
    )

    latest_progress = latest_progress[
        [
            "project_code",
            "planned_progress_pct",
            "actual_progress_pct",
            "progress_variance_pct",
        ]
    ]

    # --------------------------------------------------------------
    # PROCUREMENT SUMMARY
    # --------------------------------------------------------------

    procurement_summary = (
        procurement.groupby(
            "project_code",
            as_index=False
        )
        .agg(
            total_procurement_items=(
                "procurement_id",
                "count"
            ),
            delayed_items=(
                "delayed_delivery_flag",
                "sum"
            ),
            critical_delays=(
                "critical_delay_flag",
                "sum"
            ),
        )
    )

    # --------------------------------------------------------------
    # ASSEMBLE PROJECT SCORECARD
    # --------------------------------------------------------------

    scorecard = projects[
        [
            "project_code",
            "project_name",
            "approved_budget",
        ]
    ].copy()

    scorecard = scorecard.merge(
        actual_cost,
        on="project_code",
        how="left",
    )

    scorecard = scorecard.merge(
        latest_fac,
        on="project_code",
        how="left",
    )

    scorecard = scorecard.merge(
        latest_progress,
        on="project_code",
        how="left",
    )

    scorecard = scorecard.merge(
        procurement_summary,
        on="project_code",
        how="left",
    )

    scorecard["forecast_variance"] = (
        scorecard["approved_budget"]
        - scorecard["forecast_at_completion"]
    )

    scorecard["forecast_variance_pct"] = (
        scorecard["forecast_variance"]
        / scorecard["approved_budget"]
        * 100
    )

    scorecard["progress_variance_pct"] = (
        scorecard["actual_progress_pct"]
        - scorecard["planned_progress_pct"]
    )

    scorecard["health_status"] = scorecard.apply(
        lambda row: calculate_health_status(
            row["forecast_variance_pct"],
            row["progress_variance_pct"],
        ),
        axis=1,
    )

    scorecard["management_status"] = scorecard.apply(
        lambda row: calculate_management_status(
            row["forecast_variance_pct"],
            row["progress_variance_pct"],
            row["critical_delays"],
        ),
        axis=1,
    )

    numeric_columns = [
        "approved_budget",
        "actual_cost_to_date",
        "forecast_at_completion",
        "forecast_variance",
        "planned_progress_pct",
        "actual_progress_pct",
        "progress_variance_pct",
        "forecast_variance_pct",
    ]

    scorecard = round_numeric(
        scorecard,
        numeric_columns,
        decimals=2,
    )

    integer_columns = [
        "total_procurement_items",
        "delayed_items",
        "critical_delays",
    ]

    for column in integer_columns:
        scorecard[column] = (
            scorecard[column]
            .fillna(0)
            .astype(int)
        )

    scorecard = scorecard.sort_values(
        [
            "forecast_variance",
            "project_code",
        ],
        ascending=[
            True,
            True,
        ],
    ).reset_index(drop=True)

    return scorecard[
        [
            "project_code",
            "project_name",
            "approved_budget",
            "actual_cost_to_date",
            "forecast_at_completion",
            "forecast_variance",
            "planned_progress_pct",
            "actual_progress_pct",
            "progress_variance_pct",
            "health_status",
            "management_status",
            "forecast_variance_pct",
            "total_procurement_items",
            "delayed_items",
            "critical_delays",
        ]
    ]


def build_portfolio_kpis(
    data: dict[str, pd.DataFrame],
    scorecard: pd.DataFrame,
) -> pd.DataFrame:

    cost = data["cost"].copy()
    audit = data["etl_audit"].copy()

    total_budget = (
        scorecard["approved_budget"].sum()
    )

    actual_cost_to_date = (
        scorecard["actual_cost_to_date"].sum()
    )

    committed_cost_to_date = (
        pd.to_numeric(
            cost["committed_cost"],
            errors="coerce",
        )
        .fillna(0)
        .sum()
    )

    forecast_at_completion = (
        scorecard["forecast_at_completion"].sum()
    )

    forecast_variance = (
        total_budget
        - forecast_at_completion
    )

    planned_progress_pct = (
        (
            scorecard["planned_progress_pct"]
            * scorecard["approved_budget"]
        ).sum()
        / total_budget
    )

    actual_progress_pct = (
        (
            scorecard["actual_progress_pct"]
            * scorecard["approved_budget"]
        ).sum()
        / total_budget
    )

    progress_variance_pct = (
        actual_progress_pct
        - planned_progress_pct
    )

    # Validation Pass Rate:
    # accepted analytical records / source operational records.

    source_rows = pd.to_numeric(
        audit["input_rows"],
        errors="coerce",
    ).fillna(0).sum()

    accepted_rows = pd.to_numeric(
        audit["output_rows"],
        errors="coerce",
    ).fillna(0).sum()

    if source_rows == 0:
        validation_pass_rate = 0.0
    else:
        validation_pass_rate = (
            accepted_rows
            / source_rows
            * 100
        )

    portfolio = pd.DataFrame(
        [
            {
                "total_budget": total_budget,
                "actual_cost_to_date": actual_cost_to_date,
                "committed_cost_to_date": committed_cost_to_date,
                "forecast_at_completion": forecast_at_completion,
                "forecast_variance": forecast_variance,
                "planned_progress_pct": planned_progress_pct,
                "actual_progress_pct": actual_progress_pct,
                "progress_variance_pct": progress_variance_pct,
                # Name retained for API compatibility.
                # User-facing meaning = Validation Pass Rate.
                "data_quality_score": validation_pass_rate,
            }
        ]
    )

    portfolio = round_numeric(
        portfolio,
        list(portfolio.columns),
        decimals=2,
    )

    return portfolio


# ======================================================================
# REGRESSION VALIDATION
# ======================================================================

def assert_close(
    name: str,
    actual: float,
    expected: float,
    tolerance: float = 0.02,
) -> None:

    if abs(float(actual) - float(expected)) > tolerance:
        raise AssertionError(
            f"{name}: expected {expected}, got {actual}"
        )


def validate_reporting_outputs(
    scorecard: pd.DataFrame,
    portfolio: pd.DataFrame,
) -> None:

    print("\nValidating rebuilt reporting layer...")

    portfolio_row = portfolio.iloc[0]

    for column, expected in EXPECTED_PORTFOLIO.items():
        actual = portfolio_row[column]

        assert_close(
            f"Portfolio {column}",
            actual,
            expected,
        )

    indexed = scorecard.set_index(
        "project_code"
    )

    for project_code, expectations in EXPECTED_PROJECTS.items():

        if project_code not in indexed.index:
            raise AssertionError(
                f"Missing project in scorecard: {project_code}"
            )

        row = indexed.loc[project_code]

        for column, expected in expectations.items():

            actual = row[column]

            if isinstance(expected, str):

                if str(actual) != expected:
                    raise AssertionError(
                        f"{project_code} {column}: "
                        f"expected {expected}, got {actual}"
                    )

            else:
                assert_close(
                    f"{project_code} {column}",
                    actual,
                    expected,
                )

    print("✓ Reporting regression checks passed")


# ======================================================================
# DATABASE BUILD
# ======================================================================

def build_database(
    output_path: Path
) -> None:

    print("=" * 72)
    print("ControlSight Database Builder")
    print("=" * 72)

    print(f"\nProcessed data: {PROCESSED_DIR}")
    print(f"Output database: {output_path}")

    data = load_controlled_data()

    print("\nControlled datasets loaded:")
    print(
        f"  Projects:     {len(data['projects']):,}"
    )
    print(
        f"  Vendors:      {len(data['vendors']):,}"
    )
    print(
        f"  Packages:     {len(data['packages']):,}"
    )
    print(
        f"  Cost:         {len(data['cost']):,}"
    )
    print(
        f"  Progress:     {len(data['progress']):,}"
    )
    print(
        f"  Schedule:     {len(data['schedule']):,}"
    )
    print(
        f"  Procurement:  {len(data['procurement']):,}"
    )
    print(
        f"  DQ issues:    {len(data['data_quality']):,}"
    )

    dim_date = build_date_dimension(data)

    dim_project = prepare_projects(
        data["projects"]
    )

    dim_vendor = prepare_vendors(
        data["vendors"]
    )

    dim_package = prepare_packages(
        data["packages"]
    )

    fact_cost = prepare_cost(
        data["cost"]
    )

    fact_progress = prepare_progress(
        data["progress"]
    )

    fact_schedule = prepare_schedule(
        data["schedule"]
    )

    fact_procurement = prepare_procurement(
        data["procurement"]
    )

    fact_data_quality = prepare_data_quality(
        data["data_quality"]
    )

    scorecard = build_management_scorecard(
        data
    )

    portfolio = build_portfolio_kpis(
        data,
        scorecard,
    )

    # Validate reporting logic before writing the DB.
    validate_reporting_outputs(
        scorecard,
        portfolio,
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if output_path.exists():
        output_path.unlink()

    connection = sqlite3.connect(
        output_path
    )

    try:
        connection.execute(
            "PRAGMA foreign_keys = ON;"
        )

        connection.executescript(
            SCHEMA_SQL
        )

        # ----------------------------------------------------------
        # DIMENSIONS
        # ----------------------------------------------------------

        dim_project.to_sql(
            "dim_project",
            connection,
            if_exists="append",
            index=False,
        )

        dim_vendor.to_sql(
            "dim_vendor",
            connection,
            if_exists="append",
            index=False,
        )

        dim_package.to_sql(
            "dim_package",
            connection,
            if_exists="append",
            index=False,
        )

        dim_date.to_sql(
            "dim_date",
            connection,
            if_exists="append",
            index=False,
        )

        # ----------------------------------------------------------
        # FACTS
        # ----------------------------------------------------------

        fact_cost.to_sql(
            "fact_cost",
            connection,
            if_exists="append",
            index=False,
        )

        fact_progress.to_sql(
            "fact_progress",
            connection,
            if_exists="append",
            index=False,
        )

        fact_schedule.to_sql(
            "fact_schedule",
            connection,
            if_exists="append",
            index=False,
        )

        fact_procurement.to_sql(
            "fact_procurement",
            connection,
            if_exists="append",
            index=False,
        )

        fact_data_quality.to_sql(
            "fact_data_quality",
            connection,
            if_exists="append",
            index=False,
        )

        # ----------------------------------------------------------
        # REPORTING LAYER
        # ----------------------------------------------------------

        scorecard.to_sql(
            "report_management_scorecard",
            connection,
            if_exists="append",
            index=False,
        )

        portfolio.to_sql(
            "report_portfolio_kpis",
            connection,
            if_exists="append",
            index=False,
        )

        # ----------------------------------------------------------
        # FOREIGN KEY AUDIT
        # ----------------------------------------------------------

        foreign_key_errors = connection.execute(
            "PRAGMA foreign_key_check;"
        ).fetchall()

        if foreign_key_errors:
            raise RuntimeError(
                "Foreign key validation failed: "
                f"{foreign_key_errors}"
            )

        connection.commit()

    except Exception:
        connection.rollback()
        connection.close()

        if output_path.exists():
            output_path.unlink()

        raise

    finally:
        try:
            connection.close()
        except Exception:
            pass

    print("\nDatabase build complete.")
    print(f"✓ {output_path}")

    print("\nReporting outputs:")
    print(
        portfolio.to_string(
            index=False
        )
    )


# ======================================================================
# CLI
# ======================================================================

def parse_arguments() -> argparse.Namespace:

    parser = argparse.ArgumentParser(
        description=(
            "Build the ControlSight SQLite analytical database "
            "from controlled processed datasets."
        )
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=(
            "Destination SQLite database. "
            "Defaults to data/database/controlsight_rebuilt.db"
        ),
    )

    return parser.parse_args()


if __name__ == "__main__":

    args = parse_arguments()

    output = args.output

    if not output.is_absolute():
        output = PROJECT_ROOT / output

    build_database(
        output.resolve()
    )