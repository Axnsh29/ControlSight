"""
ControlSight
Automated Project Controls QA Suite

Purpose
-------
Reconcile management reporting outputs against the underlying
SQLite fact tables before the application is released.

The QA suite checks:

1. Database integrity
2. Project master data
3. Actual cost aggregation
4. FAC snapshot logic
5. Forecast variance calculations
6. Latest progress snapshot logic
7. Progress variance calculations
8. Schedule risk counts
9. Procurement risk counts
10. Cost anomaly reconciliation
11. Data-quality audit trail
12. Portfolio KPI reconciliation
13. Analytical sanity checks

This file is read-only.
It does not modify the ControlSight database.
"""

from pathlib import Path
import sqlite3
import math


# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATABASE_PATH = (
    PROJECT_ROOT
    / "data"
    / "database"
    / "controlsight.db"
)

TOLERANCE = 0.02


# ============================================================
# DISPLAY CONSTANTS
# ============================================================

PASS = "PASS"
FAIL = "FAIL"
WARN = "WARN"

results = []


# ============================================================
# HELPERS
# ============================================================

def record_result(
    check_name,
    status,
    message
):
    """
    Store and print a QA result.
    """

    results.append(
        {
            "check": check_name,
            "status": status,
            "message": message,
        }
    )

    symbol = {
        PASS: "✓",
        FAIL: "✗",
        WARN: "!",
    }.get(status, "-")

    print(
        f"{symbol} "
        f"{status:<4} | "
        f"{check_name:<42} | "
        f"{message}"
    )


def numbers_match(
    first,
    second,
    tolerance=TOLERANCE
):
    """
    Compare two numeric values using an absolute tolerance.
    """

    first = float(first or 0)
    second = float(second or 0)

    return math.isclose(
        first,
        second,
        abs_tol=tolerance
    )


def safe_number(value):
    """
    Convert NULL values to zero.
    """

    return float(value or 0)


def format_money(value):
    """
    Human-readable monetary value for QA output.
    """

    return f"£{safe_number(value):,.2f}"


def format_pct(value):
    """
    Human-readable percentage value.
    """

    return f"{safe_number(value):,.2f}%"


def format_pp(value):
    """
    Human-readable percentage-point value.
    """

    return f"{safe_number(value):,.2f} pp"


# ============================================================
# DATABASE CONNECTION
# ============================================================

if not DATABASE_PATH.exists():

    raise FileNotFoundError(
        f"ControlSight database not found:\n"
        f"{DATABASE_PATH}"
    )


connection = sqlite3.connect(
    DATABASE_PATH
)

connection.row_factory = sqlite3.Row


print()
print("=" * 110)
print("CONTROLSIGHT — AUTOMATED PROJECT CONTROLS QA")
print("=" * 110)
print(f"Database: {DATABASE_PATH}")
print()


# ============================================================
# 1. DATABASE INTEGRITY
# ============================================================

print()
print("[1] DATABASE INTEGRITY")
print("-" * 110)


foreign_key_issues = connection.execute(
    """
    PRAGMA foreign_key_check
    """
).fetchall()


if not foreign_key_issues:

    record_result(
        "Foreign-key integrity",
        PASS,
        "No foreign-key violations detected."
    )

else:

    record_result(
        "Foreign-key integrity",
        FAIL,
        (
            f"{len(foreign_key_issues)} "
            "foreign-key violation(s) detected."
        )
    )


integrity_result = connection.execute(
    """
    PRAGMA integrity_check
    """
).fetchone()[0]


if integrity_result == "ok":

    record_result(
        "SQLite integrity check",
        PASS,
        "Database integrity check returned OK."
    )

else:

    record_result(
        "SQLite integrity check",
        FAIL,
        str(integrity_result)
    )


# ============================================================
# 2. PROJECT MASTER DATA
# ============================================================

print()
print("[2] PROJECT MASTER DATA")
print("-" * 110)


project_count = connection.execute(
    """
    SELECT COUNT(*)
    FROM dim_project
    """
).fetchone()[0]


report_project_count = connection.execute(
    """
    SELECT COUNT(*)
    FROM report_management_scorecard
    """
).fetchone()[0]


if project_count == report_project_count:

    record_result(
        "Project count reconciliation",
        PASS,
        (
            f"{project_count} projects exist in both "
            "dim_project and management reporting."
        )
    )

else:

    record_result(
        "Project count reconciliation",
        FAIL,
        (
            f"dim_project={project_count}, "
            f"report={report_project_count}"
        )
    )


duplicate_projects = connection.execute(
    """
    SELECT
        project_code,
        COUNT(*) AS row_count
    FROM dim_project
    GROUP BY project_code
    HAVING COUNT(*) > 1
    """
).fetchall()


if not duplicate_projects:

    record_result(
        "Unique project codes",
        PASS,
        "No duplicate project codes detected."
    )

else:

    record_result(
        "Unique project codes",
        FAIL,
        (
            f"{len(duplicate_projects)} duplicate "
            "project code(s) detected."
        )
    )


invalid_budgets = connection.execute(
    """
    SELECT COUNT(*)
    FROM dim_project
    WHERE approved_budget <= 0
       OR approved_budget IS NULL
    """
).fetchone()[0]


if invalid_budgets == 0:

    record_result(
        "Approved budgets",
        PASS,
        "All projects have positive approved budgets."
    )

else:

    record_result(
        "Approved budgets",
        FAIL,
        (
            f"{invalid_budgets} project(s) have "
            "invalid approved budgets."
        )
    )


# ============================================================
# LOAD PROJECTS
# ============================================================

projects = connection.execute(
    """
    SELECT
        project_code,
        project_name,
        approved_budget
    FROM dim_project
    ORDER BY project_code
    """
).fetchall()


# ============================================================
# 3. PROJECT COST RECONCILIATION
# ============================================================

print()
print("[3] PROJECT COST RECONCILIATION")
print("-" * 110)


for project in projects:

    project_code = project["project_code"]


    # --------------------------------------------------------
    # REPORTED SCORECARD
    # --------------------------------------------------------

    report = connection.execute(
        """
        SELECT *
        FROM report_management_scorecard
        WHERE project_code = ?
        """,
        (project_code,)
    ).fetchone()


    if report is None:

        record_result(
            f"{project_code} scorecard",
            FAIL,
            "Management scorecard record is missing."
        )

        continue


    # --------------------------------------------------------
    # APPROVED BUDGET
    # --------------------------------------------------------

    source_budget = project["approved_budget"]

    reported_budget = report[
        "approved_budget"
    ]


    if numbers_match(
        source_budget,
        reported_budget
    ):

        record_result(
            f"{project_code} approved budget",
            PASS,
            format_money(reported_budget)
        )

    else:

        record_result(
            f"{project_code} approved budget",
            FAIL,
            (
                f"dim_project="
                f"{format_money(source_budget)} | "
                f"Report="
                f"{format_money(reported_budget)}"
            )
        )


    # --------------------------------------------------------
    # ACTUAL COST
    #
    # Actual cost is a monthly FLOW.
    # Therefore it is summed across reporting periods.
    # --------------------------------------------------------

    source_actual = connection.execute(
        """
        SELECT
            SUM(actual_cost) AS actual_cost
        FROM fact_cost
        WHERE project_code = ?
        """,
        (project_code,)
    ).fetchone()["actual_cost"]


    reported_actual = report[
        "actual_cost_to_date"
    ]


    if numbers_match(
        source_actual,
        reported_actual
    ):

        record_result(
            f"{project_code} actual cost",
            PASS,
            format_money(reported_actual)
        )

    else:

        record_result(
            f"{project_code} actual cost",
            FAIL,
            (
                f"Fact="
                f"{format_money(source_actual)} | "
                f"Report="
                f"{format_money(reported_actual)}"
            )
        )


    # --------------------------------------------------------
    # FAC
    #
    # FAC is a SNAPSHOT measure.
    #
    # Identify the latest reporting date and sum package FAC
    # only within that reporting date.
    #
    # FAC must NOT be summed across reporting periods.
    # --------------------------------------------------------

    latest_cost_date = connection.execute(
        """
        SELECT MAX(date_key)
        FROM fact_cost
        WHERE project_code = ?
        """,
        (project_code,)
    ).fetchone()[0]


    if latest_cost_date is None:

        record_result(
            f"{project_code} FAC snapshot",
            FAIL,
            "No cost records found."
        )

        continue


    source_fac = connection.execute(
        """
        SELECT
            SUM(forecast_at_completion)
                AS forecast_at_completion
        FROM fact_cost
        WHERE project_code = ?
          AND date_key = ?
        """,
        (
            project_code,
            latest_cost_date
        )
    ).fetchone()["forecast_at_completion"]


    reported_fac = report[
        "forecast_at_completion"
    ]


    if numbers_match(
        source_fac,
        reported_fac
    ):

        record_result(
            f"{project_code} FAC snapshot",
            PASS,
            (
                f"{format_money(reported_fac)} "
                f"@ {latest_cost_date}"
            )
        )

    else:

        record_result(
            f"{project_code} FAC snapshot",
            FAIL,
            (
                f"Latest fact="
                f"{format_money(source_fac)} | "
                f"Report="
                f"{format_money(reported_fac)}"
            )
        )


    # --------------------------------------------------------
    # FORECAST VARIANCE
    #
    # ControlSight convention:
    #
    # Forecast Variance =
    # Approved Budget - Forecast at Completion
    #
    # Negative = forecast over budget / unfavourable
    # Positive = forecast under budget / favourable
    # --------------------------------------------------------

    expected_variance = (
        safe_number(
            report["approved_budget"]
        )
        -
        safe_number(
            report["forecast_at_completion"]
        )
    )


    reported_variance = report[
        "forecast_variance"
    ]


    if numbers_match(
        expected_variance,
        reported_variance
    ):

        record_result(
            f"{project_code} forecast variance",
            PASS,
            format_money(reported_variance)
        )

    else:

        record_result(
            f"{project_code} forecast variance",
            FAIL,
            (
                f"Expected="
                f"{format_money(expected_variance)} | "
                f"Report="
                f"{format_money(reported_variance)}"
            )
        )


    # --------------------------------------------------------
    # FORECAST VARIANCE %
    # --------------------------------------------------------

    budget = safe_number(
        report["approved_budget"]
    )


    expected_variance_pct = (
        expected_variance
        / budget
        * 100
        if budget
        else 0
    )


    reported_variance_pct = report[
        "forecast_variance_pct"
    ]


    if numbers_match(
        expected_variance_pct,
        reported_variance_pct
    ):

        record_result(
            f"{project_code} forecast variance %",
            PASS,
            format_pct(
                reported_variance_pct
            )
        )

    else:

        record_result(
            f"{project_code} forecast variance %",
            FAIL,
            (
                f"Expected="
                f"{format_pct(expected_variance_pct)} | "
                f"Report="
                f"{format_pct(reported_variance_pct)}"
            )
        )


# ============================================================
# 4. PROJECT PROGRESS RECONCILIATION
# ============================================================

print()
print("[4] PROJECT PROGRESS RECONCILIATION")
print("-" * 110)


for project in projects:

    project_code = project[
        "project_code"
    ]


    report = connection.execute(
        """
        SELECT *
        FROM report_management_scorecard
        WHERE project_code = ?
        """,
        (project_code,)
    ).fetchone()


    if report is None:

        record_result(
            f"{project_code} progress report",
            FAIL,
            "Management scorecard record is missing."
        )

        continue


    latest_progress_date = connection.execute(
        """
        SELECT MAX(date_key)
        FROM fact_progress
        WHERE project_code = ?
        """,
        (project_code,)
    ).fetchone()[0]


    if latest_progress_date is None:

        record_result(
            f"{project_code} progress snapshot",
            FAIL,
            "No progress records found."
        )

        continue


    progress = connection.execute(
        """
        SELECT
            planned_progress_pct,
            actual_progress_pct,
            progress_variance_pct
        FROM fact_progress
        WHERE project_code = ?
          AND date_key = ?
        LIMIT 1
        """,
        (
            project_code,
            latest_progress_date
        )
    ).fetchone()


    if progress is None:

        record_result(
            f"{project_code} progress snapshot",
            FAIL,
            "No latest progress snapshot found."
        )

        continue


    # --------------------------------------------------------
    # LATEST PROGRESS SNAPSHOT
    # --------------------------------------------------------

    if (
        numbers_match(
            progress[
                "planned_progress_pct"
            ],
            report[
                "planned_progress_pct"
            ]
        )
        and
        numbers_match(
            progress[
                "actual_progress_pct"
            ],
            report[
                "actual_progress_pct"
            ]
        )
    ):

        record_result(
            f"{project_code} latest progress",
            PASS,
            (
                f"Plan "
                f"{format_pct(report['planned_progress_pct'])} | "
                f"Actual "
                f"{format_pct(report['actual_progress_pct'])}"
            )
        )

    else:

        record_result(
            f"{project_code} latest progress",
            FAIL,
            (
                f"Fact plan="
                f"{format_pct(progress['planned_progress_pct'])}, "
                f"actual="
                f"{format_pct(progress['actual_progress_pct'])} | "
                f"Report plan="
                f"{format_pct(report['planned_progress_pct'])}, "
                f"actual="
                f"{format_pct(report['actual_progress_pct'])}"
            )
        )


    # --------------------------------------------------------
    # PROGRESS VARIANCE
    #
    # Actual progress - Planned progress
    #
    # This is a percentage-point difference.
    # --------------------------------------------------------

    expected_progress_variance = (
        safe_number(
            report[
                "actual_progress_pct"
            ]
        )
        -
        safe_number(
            report[
                "planned_progress_pct"
            ]
        )
    )


    reported_progress_variance = report[
        "progress_variance_pct"
    ]


    if numbers_match(
        expected_progress_variance,
        reported_progress_variance
    ):

        record_result(
            f"{project_code} progress variance",
            PASS,
            format_pp(
                reported_progress_variance
            )
        )

    else:

        record_result(
            f"{project_code} progress variance",
            FAIL,
            (
                f"Expected="
                f"{format_pp(expected_progress_variance)} | "
                f"Report="
                f"{format_pp(reported_progress_variance)}"
            )
        )


    # --------------------------------------------------------
    # FACT-LEVEL PROGRESS VARIANCE
    # --------------------------------------------------------

    expected_fact_variance = (
        safe_number(
            progress[
                "actual_progress_pct"
            ]
        )
        -
        safe_number(
            progress[
                "planned_progress_pct"
            ]
        )
    )


    if numbers_match(
        expected_fact_variance,
        progress[
            "progress_variance_pct"
        ]
    ):

        record_result(
            f"{project_code} fact progress variance",
            PASS,
            format_pp(
                progress[
                    "progress_variance_pct"
                ]
            )
        )

    else:

        record_result(
            f"{project_code} fact progress variance",
            FAIL,
            (
                f"Expected="
                f"{format_pp(expected_fact_variance)} | "
                f"Fact="
                f"{format_pp(progress['progress_variance_pct'])}"
            )
        )


# ============================================================
# 5. SCHEDULE RISK RECONCILIATION
# ============================================================

print()
print("[5] SCHEDULE RISK RECONCILIATION")
print("-" * 110)


for project in projects:

    project_code = project[
        "project_code"
    ]


    schedule = connection.execute(
        """
        SELECT
            COUNT(*) AS total_activities,

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
        (project_code,)
    ).fetchone()


    total_activities = int(
        schedule[
            "total_activities"
        ] or 0
    )

    critical_activities = int(
        schedule[
            "critical_activities"
        ] or 0
    )

    delayed_activities = int(
        schedule[
            "delayed_activities"
        ] or 0
    )

    critical_delayed = int(
        schedule[
            "critical_delayed_activities"
        ] or 0
    )


    # --------------------------------------------------------
    # LOGICAL COUNT RELATIONSHIPS
    # --------------------------------------------------------

    logical_counts = (
        critical_activities
        <= total_activities

        and

        delayed_activities
        <= total_activities

        and

        critical_delayed
        <= critical_activities

        and

        critical_delayed
        <= delayed_activities
    )


    if logical_counts:

        record_result(
            f"{project_code} schedule counts",
            PASS,
            (
                f"Total={total_activities} | "
                f"Critical={critical_activities} | "
                f"Delayed={delayed_activities} | "
                f"Critical+Delayed="
                f"{critical_delayed}"
            )
        )

    else:

        record_result(
            f"{project_code} schedule counts",
            FAIL,
            (
                f"Total={total_activities} | "
                f"Critical={critical_activities} | "
                f"Delayed={delayed_activities} | "
                f"Critical+Delayed="
                f"{critical_delayed}"
            )
        )


    # --------------------------------------------------------
    # RECOMPUTE CRITICAL + DELAYED COUNT
    # --------------------------------------------------------

    recomputed_critical_delayed = (
        connection.execute(
            """
            SELECT COUNT(*)
            FROM fact_schedule
            WHERE project_code = ?
              AND is_critical = 1
              AND delayed_activity_flag = 1
            """,
            (project_code,)
        ).fetchone()[0]
    )


    if (
        recomputed_critical_delayed
        ==
        critical_delayed
    ):

        record_result(
            (
                f"{project_code} critical schedule "
                "reconciliation"
            ),
            PASS,
            (
                f"{critical_delayed} critical "
                "delayed activity/activities."
            )
        )

    else:

        record_result(
            (
                f"{project_code} critical schedule "
                "reconciliation"
            ),
            FAIL,
            (
                f"Expected="
                f"{recomputed_critical_delayed} | "
                f"Calculated="
                f"{critical_delayed}"
            )
        )


# ============================================================
# 6. PROCUREMENT RISK RECONCILIATION
# ============================================================

print()
print("[6] PROCUREMENT RISK RECONCILIATION")
print("-" * 110)


for project in projects:

    project_code = project[
        "project_code"
    ]


    report = connection.execute(
        """
        SELECT *
        FROM report_management_scorecard
        WHERE project_code = ?
        """,
        (project_code,)
    ).fetchone()


    if report is None:

        record_result(
            f"{project_code} procurement report",
            FAIL,
            "Management scorecard record is missing."
        )

        continue


    procurement = connection.execute(
        """
        SELECT
            COUNT(*) AS total_items,

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
        (project_code,)
    ).fetchone()


    total_items = int(
        procurement[
            "total_items"
        ] or 0
    )

    delayed_items = int(
        procurement[
            "delayed_items"
        ] or 0
    )

    critical_delays = int(
        procurement[
            "critical_delays"
        ] or 0
    )


    if (
        total_items
        ==
        int(
            report[
                "total_procurement_items"
            ] or 0
        )

        and

        delayed_items
        ==
        int(
            report[
                "delayed_items"
            ] or 0
        )

        and

        critical_delays
        ==
        int(
            report[
                "critical_delays"
            ] or 0
        )
    ):

        record_result(
            f"{project_code} procurement counts",
            PASS,
            (
                f"Total={total_items} | "
                f"Delayed={delayed_items} | "
                f"Critical={critical_delays}"
            )
        )

    else:

        record_result(
            f"{project_code} procurement counts",
            FAIL,
            (
                f"Fact total={total_items}, "
                f"delayed={delayed_items}, "
                f"critical={critical_delays} | "
                f"Report total="
                f"{report['total_procurement_items']}, "
                f"delayed="
                f"{report['delayed_items']}, "
                f"critical="
                f"{report['critical_delays']}"
            )
        )


    logical_procurement_counts = (
        critical_delays
        <= delayed_items
        <= total_items
    )


    if logical_procurement_counts:

        record_result(
            (
                f"{project_code} procurement "
                "logical counts"
            ),
            PASS,
            (
                "Critical delays are a valid subset "
                "of delayed procurement items."
            )
        )

    else:

        record_result(
            (
                f"{project_code} procurement "
                "logical counts"
            ),
            FAIL,
            (
                f"Total={total_items} | "
                f"Delayed={delayed_items} | "
                f"Critical={critical_delays}"
            )
        )


# ============================================================
# 7. COST ANOMALY RECONCILIATION
# ============================================================

print()
print("[7] COST ANOMALY RECONCILIATION")
print("-" * 110)


flagged_cost_anomalies = (
    connection.execute(
        """
        SELECT COUNT(*)
        FROM fact_cost
        WHERE cost_anomaly_flag = 1
        """
    ).fetchone()[0]
)


logged_cost_anomalies = (
    connection.execute(
        """
        SELECT COUNT(*)
        FROM fact_data_quality
        WHERE dataset = 'cost_monthly'
          AND issue_type = 'anomaly'
        """
    ).fetchone()[0]
)


if (
    flagged_cost_anomalies
    ==
    logged_cost_anomalies
):

    record_result(
        "Cost anomaly audit trail",
        PASS,
        (
            f"{flagged_cost_anomalies} flagged "
            "cost anomaly/anomalies reconcile "
            "to the data-quality register."
        )
    )

else:

    record_result(
        "Cost anomaly audit trail",
        FAIL,
        (
            f"fact_cost="
            f"{flagged_cost_anomalies} | "
            f"DQ register="
            f"{logged_cost_anomalies}"
        )
    )


anomaly_rows = connection.execute(
    """
    SELECT
        project_code,
        package_code,
        date_key,
        planned_cost,
        actual_cost
    FROM fact_cost
    WHERE cost_anomaly_flag = 1
    ORDER BY
        project_code,
        date_key
    """
).fetchall()


for anomaly in anomaly_rows:

    planned = safe_number(
        anomaly[
            "planned_cost"
        ]
    )

    actual = safe_number(
        anomaly[
            "actual_cost"
        ]
    )


    ratio = (
        actual / planned
        if planned > 0
        else None
    )


    if ratio is not None:

        record_result(
            (
                f"{anomaly['project_code']} "
                "cost anomaly retained"
            ),
            WARN,
            (
                f"{anomaly['package_code']} | "
                f"{anomaly['date_key']} | "
                f"Actual/Plan={ratio:.2f}x | "
                "retained for investigation."
            )
        )

    else:

        record_result(
            (
                f"{anomaly['project_code']} "
                "cost anomaly retained"
            ),
            WARN,
            (
                "Flagged anomaly retained "
                "for investigation."
            )
        )


# ============================================================
# 8. DATA QUALITY REGISTER
# ============================================================

print()
print("[8] DATA QUALITY REGISTER")
print("-" * 110)


dq_total = connection.execute(
    """
    SELECT COUNT(*)
    FROM fact_data_quality
    """
).fetchone()[0]


record_result(
    "Logged data-quality exceptions",
    PASS,
    (
        f"{dq_total} exception(s) retained "
        "in the audit trail."
    )
)


dq_breakdown = connection.execute(
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


for row in dq_breakdown:

    record_result(
        (
            f"DQ {row['dataset']} / "
            f"{row['issue_type']}"
        ),
        PASS,
        (
            f"{row['issue_count']} "
            "logged issue(s)."
        )
    )


# ============================================================
# 9. PORTFOLIO KPI RECONCILIATION
# ============================================================

print()
print("[9] PORTFOLIO KPI RECONCILIATION")
print("-" * 110)


portfolio = connection.execute(
    """
    SELECT *
    FROM report_portfolio_kpis
    LIMIT 1
    """
).fetchone()


if portfolio is None:

    record_result(
        "Portfolio KPI record",
        FAIL,
        "report_portfolio_kpis is empty."
    )

else:

    record_result(
        "Portfolio KPI record",
        PASS,
        "Portfolio KPI record found."
    )


    portfolio_from_projects = (
        connection.execute(
            """
            SELECT
                SUM(approved_budget)
                    AS total_budget,

                SUM(actual_cost_to_date)
                    AS actual_cost,

                SUM(forecast_at_completion)
                    AS forecast_at_completion

            FROM report_management_scorecard
            """
        ).fetchone()
    )


    portfolio_checks = [
        (
            "Portfolio budget",
            portfolio[
                "total_budget"
            ],
            portfolio_from_projects[
                "total_budget"
            ]
        ),
        (
            "Portfolio actual cost",
            portfolio[
                "actual_cost_to_date"
            ],
            portfolio_from_projects[
                "actual_cost"
            ]
        ),
        (
            "Portfolio FAC",
            portfolio[
                "forecast_at_completion"
            ],
            portfolio_from_projects[
                "forecast_at_completion"
            ]
        ),
    ]


    for (
        check_name,
        reported_value,
        calculated_value
    ) in portfolio_checks:

        if numbers_match(
            reported_value,
            calculated_value
        ):

            record_result(
                check_name,
                PASS,
                format_money(
                    reported_value
                )
            )

        else:

            record_result(
                check_name,
                FAIL,
                (
                    f"Portfolio report="
                    f"{format_money(reported_value)} | "
                    f"Project aggregation="
                    f"{format_money(calculated_value)}"
                )
            )


    # --------------------------------------------------------
    # PORTFOLIO FORECAST VARIANCE
    # --------------------------------------------------------

    expected_portfolio_variance = (
        safe_number(
            portfolio[
                "total_budget"
            ]
        )
        -
        safe_number(
            portfolio[
                "forecast_at_completion"
            ]
        )
    )


    if numbers_match(
        expected_portfolio_variance,
        portfolio[
            "forecast_variance"
        ]
    ):

        record_result(
            "Portfolio forecast variance",
            PASS,
            format_money(
                portfolio[
                    "forecast_variance"
                ]
            )
        )

    else:

        record_result(
            "Portfolio forecast variance",
            FAIL,
            (
                f"Expected="
                f"{format_money(expected_portfolio_variance)} | "
                f"Reported="
                f"{format_money(portfolio['forecast_variance'])}"
            )
        )
    # --------------------------------------------------------
    # BUDGET-WEIGHTED PORTFOLIO PROGRESS
    #
    # Independently recompute portfolio planned and actual
    # progress using approved budget as the project weight.
    #
    # This prevents smaller projects from having the same
    # portfolio-level influence as larger projects.
    # --------------------------------------------------------

    weighted_progress = connection.execute(
        """
        SELECT
            SUM(
                planned_progress_pct * approved_budget
            )
            / NULLIF(
                SUM(approved_budget),
                0
            ) AS weighted_planned_progress,

            SUM(
                actual_progress_pct * approved_budget
            )
            / NULLIF(
                SUM(approved_budget),
                0
            ) AS weighted_actual_progress

        FROM report_management_scorecard
        """
    ).fetchone()


    expected_weighted_planned = safe_number(
        weighted_progress[
            "weighted_planned_progress"
        ]
    )

    expected_weighted_actual = safe_number(
        weighted_progress[
            "weighted_actual_progress"
        ]
    )


    if numbers_match(
        expected_weighted_planned,
        portfolio[
            "planned_progress_pct"
        ]
    ):

        record_result(
            "Portfolio weighted planned progress",
            PASS,
            format_pct(
                portfolio[
                    "planned_progress_pct"
                ]
            )
        )

    else:

        record_result(
            "Portfolio weighted planned progress",
            FAIL,
            (
                f"Expected="
                f"{format_pct(expected_weighted_planned)} | "
                f"Reported="
                f"{format_pct(portfolio['planned_progress_pct'])}"
            )
        )


    if numbers_match(
        expected_weighted_actual,
        portfolio[
            "actual_progress_pct"
        ]
    ):

        record_result(
            "Portfolio weighted actual progress",
            PASS,
            format_pct(
                portfolio[
                    "actual_progress_pct"
                ]
            )
        )

    else:

        record_result(
            "Portfolio weighted actual progress",
            FAIL,
            (
                f"Expected="
                f"{format_pct(expected_weighted_actual)} | "
                f"Reported="
                f"{format_pct(portfolio['actual_progress_pct'])}"
            )
        )

    # --------------------------------------------------------
    # PORTFOLIO PROGRESS VARIANCE
    # --------------------------------------------------------

    expected_portfolio_progress_variance = (
        safe_number(
            portfolio[
                "actual_progress_pct"
            ]
        )
        -
        safe_number(
            portfolio[
                "planned_progress_pct"
            ]
        )
    )


    if numbers_match(
        expected_portfolio_progress_variance,
        portfolio[
            "progress_variance_pct"
        ]
    ):

        record_result(
            "Portfolio progress variance",
            PASS,
            format_pp(
                portfolio[
                    "progress_variance_pct"
                ]
            )
        )

    else:

        record_result(
            "Portfolio progress variance",
            FAIL,
            (
                f"Expected="
                f"{format_pp(expected_portfolio_progress_variance)} | "
                f"Reported="
                f"{format_pp(portfolio['progress_variance_pct'])}"
            )
        )


    # --------------------------------------------------------
    # VALIDATION PASS RATE RECONCILIATION
    #
    # Independently verifies the portfolio validation pass
    # rate from source record counts and records admitted to
    # the controlled analytical layer.
    # --------------------------------------------------------

    raw_data_path = (
        Path(__file__).resolve().parents[2]
        / "data"
        / "raw"
    )

    raw_operational_files = [
        "cost_monthly.csv",
        "progress_updates.csv",
        "schedule_activities.csv",
        "procurement_packages.csv",
    ]

    # Count source records independently from the raw CSVs.
    # Subtract 1 from each file for the header row.
    total_source_rows = 0

    for filename in raw_operational_files:

        with open(
            raw_data_path / filename,
            "r",
            encoding="utf-8"
        ) as file:

            source_rows = (
                sum(1 for _ in file) - 1
            )

            total_source_rows += source_rows


    # Count records that actually reached the controlled
    # analytical layer.
    accepted_counts = connection.execute(
        """
        SELECT
            (SELECT COUNT(*) FROM fact_cost)
            +
            (SELECT COUNT(*) FROM fact_progress)
            +
            (SELECT COUNT(*) FROM fact_schedule)
            +
            (SELECT COUNT(*) FROM fact_procurement)
            AS total_accepted_rows
        """
    ).fetchone()


    total_accepted_rows = int(
        accepted_counts[0]
    )


    expected_validation_pass_rate = round(
        (
            total_accepted_rows
            / total_source_rows
        ) * 100,
        2
    )


    reported_validation_pass_rate = safe_number(
        portfolio[
            "data_quality_score"
        ]
    )


    if numbers_match(
        expected_validation_pass_rate,
        reported_validation_pass_rate
    ):

        record_result(
            "Portfolio validation pass rate",
            PASS,
            (
                f"{format_pct(reported_validation_pass_rate)} | "
                f"Accepted={total_accepted_rows:,} / "
                f"Source={total_source_rows:,}"
            )
        )

    else:

        record_result(
            "Portfolio validation pass rate",
            FAIL,
            (
                f"Expected="
                f"{format_pct(expected_validation_pass_rate)} | "
                f"Reported="
                f"{format_pct(reported_validation_pass_rate)} | "
                f"Accepted={total_accepted_rows:,} / "
                f"Source={total_source_rows:,}"
            )
        )
        
# ============================================================
# 10. ANALYTICAL SANITY CHECKS
# ============================================================

print()
print("[10] ANALYTICAL SANITY CHECKS")
print("-" * 110)


# ------------------------------------------------------------
# PROGRESS RANGE
# ------------------------------------------------------------

invalid_progress = connection.execute(
    """
    SELECT COUNT(*)
    FROM fact_progress
    WHERE planned_progress_pct < 0
       OR planned_progress_pct > 100
       OR actual_progress_pct < 0
       OR actual_progress_pct > 100
    """
).fetchone()[0]


if invalid_progress == 0:

    record_result(
        "Progress range",
        PASS,
        (
            "All analytical progress values "
            "are within 0–100%."
        )
    )

else:

    record_result(
        "Progress range",
        FAIL,
        (
            f"{invalid_progress} invalid "
            "progress record(s) reached "
            "the analytical layer."
        )
    )


# ------------------------------------------------------------
# NEGATIVE COSTS
# ------------------------------------------------------------

negative_costs = connection.execute(
    """
    SELECT COUNT(*)
    FROM fact_cost
    WHERE planned_cost < 0
       OR actual_cost < 0
       OR committed_cost < 0
       OR forecast_at_completion < 0
    """
).fetchone()[0]


if negative_costs == 0:

    record_result(
        "Negative analytical costs",
        PASS,
        (
            "No negative costs reached "
            "fact_cost."
        )
    )

else:

    record_result(
        "Negative analytical costs",
        FAIL,
        (
            f"{negative_costs} negative "
            "cost record(s) detected."
        )
    )


# ------------------------------------------------------------
# COST ANOMALY FLAGS
# ------------------------------------------------------------

invalid_cost_flags = connection.execute(
    """
    SELECT COUNT(*)
    FROM fact_cost
    WHERE cost_anomaly_flag NOT IN (0, 1)
       OR cost_anomaly_flag IS NULL
    """
).fetchone()[0]


if invalid_cost_flags == 0:

    record_result(
        "Cost anomaly flags",
        PASS,
        (
            "Cost anomaly flags are valid "
            "binary values."
        )
    )

else:

    record_result(
        "Cost anomaly flags",
        FAIL,
        (
            f"{invalid_cost_flags} invalid "
            "cost anomaly flag(s) detected."
        )
    )


# ------------------------------------------------------------
# SCHEDULE FLAGS
# ------------------------------------------------------------

invalid_schedule_flags = connection.execute(
    """
    SELECT COUNT(*)
    FROM fact_schedule
    WHERE is_critical NOT IN (0, 1)
       OR delayed_activity_flag NOT IN (0, 1)
       OR is_critical IS NULL
       OR delayed_activity_flag IS NULL
    """
).fetchone()[0]


if invalid_schedule_flags == 0:

    record_result(
        "Schedule flags",
        PASS,
        (
            "Schedule control flags are "
            "valid binary values."
        )
    )

else:

    record_result(
        "Schedule flags",
        FAIL,
        (
            f"{invalid_schedule_flags} invalid "
            "schedule flag(s) detected."
        )
    )


# ------------------------------------------------------------
# PROCUREMENT FLAGS
# ------------------------------------------------------------

invalid_procurement_flags = (
    connection.execute(
        """
        SELECT COUNT(*)
        FROM fact_procurement
        WHERE delayed_delivery_flag NOT IN (0, 1)
           OR critical_delay_flag NOT IN (0, 1)
           OR delayed_delivery_flag IS NULL
           OR critical_delay_flag IS NULL
        """
    ).fetchone()[0]
)


if invalid_procurement_flags == 0:

    record_result(
        "Procurement flags",
        PASS,
        (
            "Procurement control flags are "
            "valid binary values."
        )
    )

else:

    record_result(
        "Procurement flags",
        FAIL,
        (
            f"{invalid_procurement_flags} "
            "invalid procurement flag(s) detected."
        )
    )


# ------------------------------------------------------------
# CRITICAL PROCUREMENT LOGIC
# ------------------------------------------------------------

invalid_critical_procurement = (
    connection.execute(
        """
        SELECT COUNT(*)
        FROM fact_procurement
        WHERE critical_delay_flag = 1
          AND delayed_delivery_flag != 1
        """
    ).fetchone()[0]
)


if invalid_critical_procurement == 0:

    record_result(
        "Critical procurement logic",
        PASS,
        (
            "Every critical procurement delay "
            "is also flagged as delayed."
        )
    )

else:

    record_result(
        "Critical procurement logic",
        FAIL,
        (
            f"{invalid_critical_procurement} "
            "critical delay(s) are not "
            "flagged as delayed."
        )
    )


# ------------------------------------------------------------
# SCHEDULE PERCENT COMPLETE
# ------------------------------------------------------------

invalid_schedule_progress = (
    connection.execute(
        """
        SELECT COUNT(*)
        FROM fact_schedule
        WHERE percent_complete < 0
           OR percent_complete > 100
        """
    ).fetchone()[0]
)


if invalid_schedule_progress == 0:

    record_result(
        "Schedule completion range",
        PASS,
        (
            "All schedule completion values "
            "are within 0–100%."
        )
    )

else:

    record_result(
        "Schedule completion range",
        FAIL,
        (
            f"{invalid_schedule_progress} "
            "invalid schedule completion "
            "record(s) detected."
        )
    )


# ============================================================
# FINAL SUMMARY
# ============================================================

print()
print("=" * 110)
print("QA SUMMARY")
print("=" * 110)


pass_count = sum(
    result["status"] == PASS
    for result in results
)

fail_count = sum(
    result["status"] == FAIL
    for result in results
)

warn_count = sum(
    result["status"] == WARN
    for result in results
)

total_count = len(results)


print(
    f"Checks executed : {total_count}"
)

print(
    f"PASS            : {pass_count}"
)

print(
    f"WARN            : {warn_count}"
)

print(
    f"FAIL            : {fail_count}"
)

print()


if fail_count == 0:

    print(
        "RESULT: QA PASSED"
    )

    print(
        "All tested reporting calculations "
        "reconcile to the analytical data layer."
    )

    if warn_count > 0:

        print(
            "Warnings represent retained source "
            "exceptions requiring management review, "
            "not calculation failures."
        )

else:

    print(
        "RESULT: QA FAILED"
    )

    print(
        "Do not freeze the analytical layer until "
        "all FAIL results have been investigated."
    )


print("=" * 110)
print()


connection.close()