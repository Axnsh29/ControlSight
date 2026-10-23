from pathlib import Path
from datetime import datetime, timezone
import csv
import io
import json
import re
import sqlite3
import uuid

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/uploads",
    tags=["BYO Data Upload"],
)


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

UPLOAD_ROOT = (
    PROJECT_ROOT
    / "data"
    / "uploads"
)

UPLOAD_DATABASE_PATH = (
    UPLOAD_ROOT
    / "uploads.db"
)

ANALYTICAL_DATABASE_PATH = (
    PROJECT_ROOT
    / "data"
    / "database"
    / "controlsight.db"
)


# ============================================================
# LIMITS
# ============================================================

MAX_UPLOAD_BYTES = (
    5
    *
    1024
    *
    1024
)

MAX_UPLOAD_ROWS = 10000


# ============================================================
# DATASET SCHEMAS
# ============================================================

DATASET_SCHEMAS = {

    "cost": {

        "label":
            "Cost",

        "required_columns": [
            "project_code",
            "package_code",
            "date_key",
            "planned_cost",
            "actual_cost",
            "committed_cost",
            "forecast_at_completion",
        ],

        "numeric_columns": [
            "planned_cost",
            "actual_cost",
            "committed_cost",
            "forecast_at_completion",
        ],

        "percentage_columns": [],

        "integer_columns": [],

        "date_columns": [
            "date_key",
        ],

        "template_row": {
            "project_code":
                "PRJ-001",

            "package_code":
                "PRJ-001-PKG-01",

            "date_key":
                "20260930",

            "planned_cost":
                "1250000",

            "actual_cost":
                "1315000",

            "committed_cost":
                "1450000",

            "forecast_at_completion":
                "38500000",
        },
    },


    "progress": {

        "label":
            "Progress",

        "required_columns": [
            "project_code",
            "date_key",
            "planned_progress_pct",
            "actual_progress_pct",
        ],

        "numeric_columns": [],

        "percentage_columns": [
            "planned_progress_pct",
            "actual_progress_pct",
        ],

        "integer_columns": [],

        "date_columns": [
            "date_key",
        ],

        "template_row": {
            "project_code":
                "PRJ-001",

            "date_key":
                "20260930",

            "planned_progress_pct":
                "81.50",

            "actual_progress_pct":
                "76.20",
        },
    },


    "schedule": {

        "label":
            "Schedule",

        "required_columns": [
            "project_code",
            "activity_id",
            "wbs_code",
            "activity_name",
            "discipline",
            "percent_complete",
            "status",
            "is_critical",
            "start_delay_days",
            "finish_delay_days",
        ],

        "numeric_columns": [
            "start_delay_days",
            "finish_delay_days",
        ],

        "percentage_columns": [
            "percent_complete",
        ],

        "integer_columns": [
            "is_critical",
        ],

        "date_columns": [],

        "template_row": {
            "project_code":
                "PRJ-001",

            "activity_id":
                "ACT-001",

            "wbs_code":
                "WBS-01",

            "activity_name":
                "Structural frame",

            "discipline":
                "Civil",

            "percent_complete":
                "68",

            "status":
                "In Progress",

            "is_critical":
                "1",

            "start_delay_days":
                "3",

            "finish_delay_days":
                "8",
        },
    },


    "procurement": {

        "label":
            "Procurement",

        "required_columns": [
            "procurement_id",
            "project_code",
            "package_code",
            "vendor_id",
            "category",
            "package_value",
            "status",
            "criticality",
            "delivery_delay_days",
        ],

        "numeric_columns": [
            "package_value",
            "delivery_delay_days",
        ],

        "percentage_columns": [],

        "integer_columns": [],

        "date_columns": [],

        "template_row": {
            "procurement_id":
                "PO-001",

            "project_code":
                "PRJ-001",

            "package_code":
                "PRJ-001-PKG-01",

            "vendor_id":
                "VEN-001",

            "category":
                "Structural Steel",

            "package_value":
                "2750000",

            "status":
                "In Transit",

            "criticality":
                "Critical",

            "delivery_delay_days":
                "14",
        },
    },
}


# ============================================================
# FILESYSTEM
# ============================================================

def ensure_upload_directories():

    UPLOAD_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )


# ============================================================
# DATABASE
# ============================================================

def get_upload_connection():

    ensure_upload_directories()

    connection = sqlite3.connect(
        UPLOAD_DATABASE_PATH
    )

    connection.row_factory = (
        sqlite3.Row
    )

    return connection


def initialise_upload_database():

    with get_upload_connection() as connection:

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS upload_batches (

                batch_id
                    TEXT PRIMARY KEY,

                dataset
                    TEXT NOT NULL,

                filename
                    TEXT NOT NULL,

                uploaded_at
                    TEXT NOT NULL,

                source_rows
                    INTEGER NOT NULL,

                accepted_rows
                    INTEGER NOT NULL,

                quarantined_rows
                    INTEGER NOT NULL,

                error_events
                    INTEGER NOT NULL,

                warning_events
                    INTEGER NOT NULL,

                validation_pass_rate
                    REAL NOT NULL,

                status
                    TEXT NOT NULL,

                staging_path
                    TEXT NOT NULL
            )
            """
        )


        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS upload_issues (

                issue_id
                    INTEGER PRIMARY KEY AUTOINCREMENT,

                batch_id
                    TEXT NOT NULL,

                row_number
                    INTEGER,

                severity
                    TEXT NOT NULL,

                issue_type
                    TEXT NOT NULL,

                column_name
                    TEXT,

                value
                    TEXT,

                message
                    TEXT NOT NULL,

                FOREIGN KEY (
                    batch_id
                )
                REFERENCES upload_batches(
                    batch_id
                )
            )
            """
        )


        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_upload_issues_batch

            ON upload_issues(
                batch_id
            )
            """
        )


        connection.commit()


# ============================================================
# HELPERS
# ============================================================

def utc_now():

    return (
        datetime.now(
            timezone.utc
        )
        .replace(
            microsecond=0
        )
        .isoformat()
    )


def safe_filename(
    filename
):

    filename = (
        filename
        or
        "upload.csv"
    )

    filename = (
        Path(filename)
        .name
    )

    filename = re.sub(
        r"[^A-Za-z0-9._-]",
        "_",
        filename,
    )

    if not filename.lower().endswith(
        ".csv"
    ):

        filename += ".csv"

    return filename


def get_schema(
    dataset
):

    dataset = (
        dataset
        or
        ""
    ).strip().lower()


    if dataset not in DATASET_SCHEMAS:

        raise HTTPException(
            status_code=422,
            detail=(
                "Unsupported dataset. "
                "Use one of: "
                + ", ".join(
                    DATASET_SCHEMAS.keys()
                )
            ),
        )


    return (
        dataset,
        DATASET_SCHEMAS[
            dataset
        ],
    )


def normalise_header(
    value
):

    return (
        str(
            value
            or
            ""
        )
        .strip()
        .lower()
        .replace(
            " ",
            "_",
        )
        .replace(
            "-",
            "_",
        )
    )


def clean_value(
    value
):

    if value is None:
        return ""

    return str(
        value
    ).strip()


def parse_float(
    value
):

    cleaned = (
        clean_value(
            value
        )
        .replace(
            ",",
            "",
        )
        .replace(
            "£",
            "",
        )
        .replace(
            "$",
            "",
        )
    )

    if cleaned == "":
        return None

    try:

        return float(
            cleaned
        )

    except ValueError:

        return None


def parse_integer(
    value
):

    cleaned = clean_value(
        value
    )

    if cleaned == "":
        return None

    try:

        number = float(
            cleaned
        )

        if not number.is_integer():
            return None

        return int(
            number
        )

    except ValueError:

        return None


def valid_date_key(
    value
):

    cleaned = clean_value(
        value
    )

    if not re.fullmatch(
        r"\d{8}",
        cleaned,
    ):

        return False


    try:

        datetime.strptime(
            cleaned,
            "%Y%m%d",
        )

        return True

    except ValueError:

        return False


def get_existing_project_codes():

    if not ANALYTICAL_DATABASE_PATH.exists():

        return set()


    try:

        with sqlite3.connect(
            ANALYTICAL_DATABASE_PATH
        ) as connection:

            rows = connection.execute(
                """
                SELECT project_code

                FROM dim_project
                """
            ).fetchall()


            return {
                str(
                    row[0]
                )
                for row in rows
            }

    except sqlite3.Error:

        return set()


# ============================================================
# ISSUE HELPER
# ============================================================

def add_issue(
    issues,
    *,
    row_number,
    severity,
    issue_type,
    column_name=None,
    value=None,
    message,
):

    issues.append(
        {
            "row_number":
                row_number,

            "severity":
                severity,

            "issue_type":
                issue_type,

            "column_name":
                column_name,

            "value":
                (
                    None
                    if value is None
                    else str(value)
                ),

            "message":
                message,
        }
    )


# ============================================================
# ROW VALIDATION
# ============================================================

def validate_row(
    dataset,
    schema,
    row,
    row_number,
    existing_project_codes,
):

    issues = []


    cleaned_row = {
        key:
            clean_value(
                value
            )
        for key, value
        in row.items()
    }


    # --------------------------------------------------------
    # REQUIRED FIELDS
    # --------------------------------------------------------

    for column in schema[
        "required_columns"
    ]:

        if (
            cleaned_row.get(
                column,
                ""
            )
            ==
            ""
        ):

            add_issue(
                issues,
                row_number=row_number,
                severity="ERROR",
                issue_type="MISSING_REQUIRED_VALUE",
                column_name=column,
                value="",
                message=(
                    f"Required field "
                    f"'{column}' is blank."
                ),
            )


    # --------------------------------------------------------
    # PROJECT REFERENCE
    # --------------------------------------------------------

    project_code = (
        cleaned_row.get(
            "project_code",
            ""
        )
    )


    if (
        project_code
        and
        existing_project_codes
        and
        project_code
        not in
        existing_project_codes
    ):

        add_issue(
            issues,
            row_number=row_number,
            severity="WARNING",
            issue_type="NEW_PROJECT_REFERENCE",
            column_name="project_code",
            value=project_code,
            message=(
                "Project code is not present "
                "in the current ControlSight "
                "portfolio. Row remains eligible "
                "for staging."
            ),
        )


    # --------------------------------------------------------
    # DATES
    # --------------------------------------------------------

    for column in schema[
        "date_columns"
    ]:

        value = cleaned_row.get(
            column,
            ""
        )


        if (
            value
            and
            not valid_date_key(
                value
            )
        ):

            add_issue(
                issues,
                row_number=row_number,
                severity="ERROR",
                issue_type="INVALID_DATE",
                column_name=column,
                value=value,
                message=(
                    f"'{column}' must use "
                    "YYYYMMDD format and be "
                    "a valid calendar date."
                ),
            )


    # --------------------------------------------------------
    # NUMERIC
    # --------------------------------------------------------

    for column in schema[
        "numeric_columns"
    ]:

        value = cleaned_row.get(
            column,
            ""
        )


        if value == "":
            continue


        number = parse_float(
            value
        )


        if number is None:

            add_issue(
                issues,
                row_number=row_number,
                severity="ERROR",
                issue_type="INVALID_NUMBER",
                column_name=column,
                value=value,
                message=(
                    f"'{column}' must contain "
                    "a valid numeric value."
                ),
            )


    # --------------------------------------------------------
    # INTEGER
    # --------------------------------------------------------

    for column in schema[
        "integer_columns"
    ]:

        value = cleaned_row.get(
            column,
            ""
        )


        if value == "":
            continue


        number = parse_integer(
            value
        )


        if number is None:

            add_issue(
                issues,
                row_number=row_number,
                severity="ERROR",
                issue_type="INVALID_INTEGER",
                column_name=column,
                value=value,
                message=(
                    f"'{column}' must contain "
                    "a whole-number value."
                ),
            )


    # --------------------------------------------------------
    # PERCENTAGES
    # --------------------------------------------------------

    for column in schema[
        "percentage_columns"
    ]:

        value = cleaned_row.get(
            column,
            ""
        )


        if value == "":
            continue


        number = parse_float(
            value
        )


        if number is None:

            add_issue(
                issues,
                row_number=row_number,
                severity="ERROR",
                issue_type="INVALID_PERCENTAGE",
                column_name=column,
                value=value,
                message=(
                    f"'{column}' must contain "
                    "a numeric percentage."
                ),
            )


        elif (
            number < 0
            or
            number > 100
        ):

            add_issue(
                issues,
                row_number=row_number,
                severity="ERROR",
                issue_type="PERCENTAGE_OUT_OF_RANGE",
                column_name=column,
                value=value,
                message=(
                    f"'{column}' must be "
                    "between 0 and 100."
                ),
            )


    # --------------------------------------------------------
    # DATASET-SPECIFIC CONTROLS
    # --------------------------------------------------------

    if dataset == "cost":

        for column in [
            "planned_cost",
            "actual_cost",
            "committed_cost",
            "forecast_at_completion",
        ]:

            number = parse_float(
                cleaned_row.get(
                    column
                )
            )


            if (
                number is not None
                and
                number < 0
            ):

                add_issue(
                    issues,
                    row_number=row_number,
                    severity="ERROR",
                    issue_type="NEGATIVE_COST",
                    column_name=column,
                    value=number,
                    message=(
                        f"'{column}' cannot be "
                        "negative in this upload "
                        "control."
                    ),
                )


        actual = parse_float(
            cleaned_row.get(
                "actual_cost"
            )
        )


        committed = parse_float(
            cleaned_row.get(
                "committed_cost"
            )
        )


        fac = parse_float(
            cleaned_row.get(
                "forecast_at_completion"
            )
        )


        if (
            actual is not None
            and
            fac is not None
            and
            fac < actual
        ):

            add_issue(
                issues,
                row_number=row_number,
                severity="ERROR",
                issue_type="FAC_BELOW_ACTUAL",
                column_name="forecast_at_completion",
                value=fac,
                message=(
                    "Forecast at Completion is "
                    "below reported actual cost."
                ),
            )


        if (
            committed is not None
            and
            fac is not None
            and
            fac < committed
        ):

            add_issue(
                issues,
                row_number=row_number,
                severity="ERROR",
                issue_type="FAC_BELOW_COMMITTED",
                column_name="forecast_at_completion",
                value=fac,
                message=(
                    "Forecast at Completion is "
                    "below reported committed cost."
                ),
            )


        planned = parse_float(
            cleaned_row.get(
                "planned_cost"
            )
        )


        if (
            planned is not None
            and
            planned > 0
            and
            actual is not None
            and
            actual
            /
            planned
            >=
            3
        ):

            add_issue(
                issues,
                row_number=row_number,
                severity="WARNING",
                issue_type="COST_ANOMALY",
                column_name="actual_cost",
                value=actual,
                message=(
                    "Actual cost is at least "
                    "3x planned cost. Row is "
                    "retained but flagged for review."
                ),
            )


    elif dataset == "progress":

        planned_progress = parse_float(
            cleaned_row.get(
                "planned_progress_pct"
            )
        )


        actual_progress = parse_float(
            cleaned_row.get(
                "actual_progress_pct"
            )
        )


        if (
            planned_progress is not None
            and
            actual_progress is not None
        ):

            variance = (
                actual_progress
                -
                planned_progress
            )


            cleaned_row[
                "progress_variance_pct"
            ] = str(
                round(
                    variance,
                    2,
                )
            )


            cleaned_row[
                "behind_schedule_flag"
            ] = (
                "1"
                if variance < 0
                else "0"
            )


    elif dataset == "schedule":

        critical = parse_integer(
            cleaned_row.get(
                "is_critical"
            )
        )


        if (
            critical is not None
            and
            critical not in {
                0,
                1,
            }
        ):

            add_issue(
                issues,
                row_number=row_number,
                severity="ERROR",
                issue_type="INVALID_BINARY_FLAG",
                column_name="is_critical",
                value=critical,
                message=(
                    "'is_critical' must be "
                    "0 or 1."
                ),
            )


        finish_delay = parse_float(
            cleaned_row.get(
                "finish_delay_days"
            )
        )


        cleaned_row[
            "delayed_activity_flag"
        ] = (
            "1"
            if (
                finish_delay is not None
                and
                finish_delay > 0
            )
            else "0"
        )


    elif dataset == "procurement":

        package_value = parse_float(
            cleaned_row.get(
                "package_value"
            )
        )


        if (
            package_value is not None
            and
            package_value < 0
        ):

            add_issue(
                issues,
                row_number=row_number,
                severity="ERROR",
                issue_type="NEGATIVE_PACKAGE_VALUE",
                column_name="package_value",
                value=package_value,
                message=(
                    "Package value cannot "
                    "be negative."
                ),
            )


        delivery_delay = parse_float(
            cleaned_row.get(
                "delivery_delay_days"
            )
        )


        cleaned_row[
            "delayed_delivery_flag"
        ] = (
            "1"
            if (
                delivery_delay is not None
                and
                delivery_delay > 0
            )
            else "0"
        )


        criticality = (
            cleaned_row.get(
                "criticality",
                ""
            )
            .lower()
        )


        cleaned_row[
            "critical_delay_flag"
        ] = (
            "1"
            if (
                delivery_delay is not None
                and
                delivery_delay > 0
                and
                criticality
                ==
                "critical"
            )
            else "0"
        )


    has_error = any(
        issue[
            "severity"
        ]
        ==
        "ERROR"

        for issue in issues
    )


    return (
        cleaned_row,
        issues,
        has_error,
    )


# ============================================================
# CSV WRITER
# ============================================================

def write_csv(
    path,
    rows,
    fieldnames,
):

    with path.open(
        "w",
        encoding="utf-8",
        newline="",
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames,
            extrasaction="ignore",
        )


        writer.writeheader()


        for row in rows:

            writer.writerow(
                {
                    field:
                        row.get(
                            field,
                            ""
                        )

                    for field
                    in fieldnames
                }
            )


# ============================================================
# TEMPLATE ENDPOINTS
# ============================================================

@router.get(
    "/templates"
)
def list_upload_templates():

    return {

        "datasets": [

            {
                "dataset":
                    dataset,

                "label":
                    schema[
                        "label"
                    ],

                "required_columns":
                    schema[
                        "required_columns"
                    ],

                "download_endpoint":
                    (
                        "/api/uploads/"
                        f"template/{dataset}"
                    ),
            }

            for dataset, schema
            in DATASET_SCHEMAS.items()
        ]
    }


@router.get(
    "/template/{dataset}"
)
def download_upload_template(
    dataset: str,
):

    dataset, schema = (
        get_schema(
            dataset
        )
    )


    output = io.StringIO()


    writer = csv.DictWriter(
        output,
        fieldnames=(
            schema[
                "required_columns"
            ]
        ),
    )


    writer.writeheader()


    writer.writerow(
        schema[
            "template_row"
        ]
    )


    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition":
                (
                    "attachment; "
                    f'filename="controlsight_'
                    f'{dataset}_template.csv"'
                )
        },
    )


# ============================================================
# UPLOAD
# ============================================================

@router.post(
    "/csv"
)
async def upload_csv(
    request: Request,
    dataset: str,
    filename: str = "upload.csv",
):

    initialise_upload_database()


    dataset, schema = (
        get_schema(
            dataset
        )
    )


    safe_name = (
        safe_filename(
            filename
        )
    )


    if not safe_name.lower().endswith(
        ".csv"
    ):

        raise HTTPException(
            status_code=422,
            detail=(
                "Only CSV files "
                "are supported."
            ),
        )


    body = await request.body()


    if not body:

        raise HTTPException(
            status_code=400,
            detail=(
                "Uploaded CSV is empty."
            ),
        )


    if len(body) > MAX_UPLOAD_BYTES:

        raise HTTPException(
            status_code=413,
            detail=(
                "CSV exceeds the "
                "5 MB upload limit."
            ),
        )


    try:

        csv_text = body.decode(
            "utf-8-sig"
        )

    except UnicodeDecodeError as error:

        raise HTTPException(
            status_code=422,
            detail=(
                "CSV must use UTF-8 "
                "text encoding."
            ),
        ) from error


    stream = io.StringIO(
        csv_text
    )


    try:

        reader = csv.DictReader(
            stream
        )

    except csv.Error as error:

        raise HTTPException(
            status_code=422,
            detail=(
                "Unable to parse CSV."
            ),
        ) from error


    if reader.fieldnames is None:

        raise HTTPException(
            status_code=422,
            detail=(
                "CSV header row "
                "is missing."
            ),
        )


    normalised_headers = [
        normalise_header(
            header
        )
        for header
        in reader.fieldnames
    ]


    duplicate_headers = {

        header

        for header
        in normalised_headers

        if normalised_headers.count(
            header
        )
        >
        1
    }


    if duplicate_headers:

        raise HTTPException(
            status_code=422,
            detail=(
                "Duplicate CSV columns: "
                +
                ", ".join(
                    sorted(
                        duplicate_headers
                    )
                )
            ),
        )


    missing_columns = [

        column

        for column
        in schema[
            "required_columns"
        ]

        if column
        not in
        normalised_headers
    ]


    if missing_columns:

        raise HTTPException(
            status_code=422,
            detail={
                "message":
                    (
                        "CSV does not match "
                        "the required schema."
                    ),

                "missing_columns":
                    missing_columns,

                "required_columns":
                    schema[
                        "required_columns"
                    ],
            },
        )


    header_mapping = {

        original:
            normalise_header(
                original
            )

        for original
        in reader.fieldnames
    }


    raw_rows = []


    for index, original_row in enumerate(
        reader,
        start=2,
    ):

        if (
            index - 1
            >
            MAX_UPLOAD_ROWS
        ):

            raise HTTPException(
                status_code=413,
                detail=(
                    "CSV exceeds the "
                    f"{MAX_UPLOAD_ROWS:,} row limit."
                ),
            )


        normalised_row = {

            header_mapping[
                original
            ]:
                value

            for original, value
            in original_row.items()

            if original is not None
        }


        if not any(
            clean_value(
                value
            )
            for value
            in normalised_row.values()
        ):

            continue


        raw_rows.append(
            (
                index,
                normalised_row,
            )
        )


    if not raw_rows:

        raise HTTPException(
            status_code=422,
            detail=(
                "CSV contains no data rows."
            ),
        )


    existing_project_codes = (
        get_existing_project_codes()
    )


    accepted_rows = []

    quarantined_rows = []

    issues = []


    for (
        row_number,
        row
    ) in raw_rows:

        (
            cleaned_row,
            row_issues,
            has_error,
        ) = validate_row(
            dataset,
            schema,
            row,
            row_number,
            existing_project_codes,
        )


        issues.extend(
            row_issues
        )


        output_row = {
            **cleaned_row,

            "_source_row_number":
                row_number,

            "_validation_status":
                (
                    "QUARANTINED"
                    if has_error
                    else "ACCEPTED"
                ),
        }


        if has_error:

            quarantined_rows.append(
                output_row
            )

        else:

            accepted_rows.append(
                output_row
            )


    source_count = len(
        raw_rows
    )


    accepted_count = len(
        accepted_rows
    )


    quarantined_count = len(
        quarantined_rows
    )


    error_events = sum(
        1

        for issue in issues

        if issue[
            "severity"
        ]
        ==
        "ERROR"
    )


    warning_events = sum(
        1

        for issue in issues

        if issue[
            "severity"
        ]
        ==
        "WARNING"
    )


    validation_pass_rate = round(
        accepted_count
        /
        source_count
        *
        100,
        2,
    )


    if quarantined_count == 0:

        status = (
            "PASSED_WITH_WARNINGS"
            if warning_events > 0
            else
            "PASSED"
        )

    elif accepted_count == 0:

        status = (
            "FAILED"
        )

    else:

        status = (
            "PARTIALLY_ACCEPTED"
        )


    batch_id = (
        uuid.uuid4()
        .hex[:16]
    )


    batch_directory = (
        UPLOAD_ROOT
        /
        batch_id
    )


    batch_directory.mkdir(
        parents=True,
        exist_ok=False,
    )


    # --------------------------------------------------------
    # ORIGINAL FILE
    # --------------------------------------------------------

    source_path = (
        batch_directory
        /
        safe_name
    )


    source_path.write_bytes(
        body
    )


    # --------------------------------------------------------
    # OUTPUT FIELDS
    # --------------------------------------------------------

    derived_fields = []


    if dataset == "progress":

        derived_fields = [
            "progress_variance_pct",
            "behind_schedule_flag",
        ]


    elif dataset == "schedule":

        derived_fields = [
            "delayed_activity_flag",
        ]


    elif dataset == "procurement":

        derived_fields = [
            "delayed_delivery_flag",
            "critical_delay_flag",
        ]


    output_fields = list(
        dict.fromkeys(
            schema[
                "required_columns"
            ]
            +
            derived_fields
            +
            [
                "_source_row_number",
                "_validation_status",
            ]
        )
    )


    # --------------------------------------------------------
    # ACCEPTED CSV
    # --------------------------------------------------------

    write_csv(
        (
            batch_directory
            /
            "accepted.csv"
        ),
        accepted_rows,
        output_fields,
    )


    # --------------------------------------------------------
    # QUARANTINE CSV
    # --------------------------------------------------------

    write_csv(
        (
            batch_directory
            /
            "quarantine.csv"
        ),
        quarantined_rows,
        output_fields,
    )


    # --------------------------------------------------------
    # ISSUES CSV
    # --------------------------------------------------------

    issue_fields = [
        "row_number",
        "severity",
        "issue_type",
        "column_name",
        "value",
        "message",
    ]


    write_csv(
        (
            batch_directory
            /
            "issues.csv"
        ),
        issues,
        issue_fields,
    )


    uploaded_at = (
        utc_now()
    )


    metadata = {

        "batch_id":
            batch_id,

        "dataset":
            dataset,

        "dataset_label":
            schema[
                "label"
            ],

        "filename":
            safe_name,

        "uploaded_at":
            uploaded_at,

        "source_rows":
            source_count,

        "accepted_rows":
            accepted_count,

        "quarantined_rows":
            quarantined_count,

        "error_events":
            error_events,

        "warning_events":
            warning_events,

        "validation_pass_rate":
            validation_pass_rate,

        "status":
            status,

        "staging_only":
            True,

        "loaded_to_analytical_database":
            False,

        "files": {
            "source":
                safe_name,

            "accepted":
                "accepted.csv",

            "quarantine":
                "quarantine.csv",

            "issues":
                "issues.csv",
        },
    }


    (
        batch_directory
        /
        "metadata.json"
    ).write_text(
        json.dumps(
            metadata,
            indent=2,
        ),
        encoding="utf-8",
    )


    # --------------------------------------------------------
    # DATABASE AUDIT
    # --------------------------------------------------------

    with get_upload_connection() as connection:

        connection.execute(
            """
            INSERT INTO upload_batches (

                batch_id,
                dataset,
                filename,
                uploaded_at,
                source_rows,
                accepted_rows,
                quarantined_rows,
                error_events,
                warning_events,
                validation_pass_rate,
                status,
                staging_path
            )

            VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?
            )
            """,
            (
                batch_id,
                dataset,
                safe_name,
                uploaded_at,
                source_count,
                accepted_count,
                quarantined_count,
                error_events,
                warning_events,
                validation_pass_rate,
                status,
                str(
                    batch_directory
                ),
            ),
        )


        for issue in issues:

            connection.execute(
                """
                INSERT INTO upload_issues (

                    batch_id,
                    row_number,
                    severity,
                    issue_type,
                    column_name,
                    value,
                    message
                )

                VALUES (
                    ?, ?, ?, ?, ?, ?, ?
                )
                """,
                (
                    batch_id,
                    issue[
                        "row_number"
                    ],

                    issue[
                        "severity"
                    ],

                    issue[
                        "issue_type"
                    ],

                    issue[
                        "column_name"
                    ],

                    issue[
                        "value"
                    ],

                    issue[
                        "message"
                    ],
                ),
            )


        connection.commit()


    return {

        **metadata,

        "quality_summary": {

            "accepted_pct":
                validation_pass_rate,

            "quarantined_pct":
                round(
                    quarantined_count
                    /
                    source_count
                    *
                    100,
                    2,
                ),

            "issues_per_100_rows":
                round(
                    len(
                        issues
                    )
                    /
                    source_count
                    *
                    100,
                    2,
                ),
        },

        "endpoints": {

            "batch":
                (
                    "/api/uploads/"
                    f"{batch_id}"
                ),

            "issues":
                (
                    "/api/uploads/"
                    f"{batch_id}/issues"
                ),
        },
    }


# ============================================================
# LIST UPLOADS
# ============================================================

@router.get("")
def list_upload_batches():

    initialise_upload_database()


    with get_upload_connection() as connection:

        rows = connection.execute(
            """
            SELECT *

            FROM upload_batches

            ORDER BY uploaded_at DESC
            """
        ).fetchall()


    return {

        "upload_count":
            len(
                rows
            ),

        "uploads":
            [
                dict(row)
                for row in rows
            ],
    }


# ============================================================
# BATCH DETAIL
# ============================================================

@router.get(
    "/{batch_id}"
)
def get_upload_batch(
    batch_id: str,
):

    initialise_upload_database()


    with get_upload_connection() as connection:

        row = connection.execute(
            """
            SELECT *

            FROM upload_batches

            WHERE batch_id = ?
            """,
            (
                batch_id,
            ),
        ).fetchone()


        if row is None:

            raise HTTPException(
                status_code=404,
                detail=(
                    "Upload batch not found."
                ),
            )


        issue_summary = (
            connection.execute(
                """
                SELECT
                    severity,
                    issue_type,
                    COUNT(*) AS issue_count

                FROM upload_issues

                WHERE batch_id = ?

                GROUP BY
                    severity,
                    issue_type

                ORDER BY
                    severity,
                    issue_type
                """,
                (
                    batch_id,
                ),
            ).fetchall()
        )


    result = dict(
        row
    )


    return {

        **result,

        "staging_only":
            True,

        "loaded_to_analytical_database":
            False,

        "issue_summary":
            [
                dict(issue)
                for issue in issue_summary
            ],
    }


# ============================================================
# ISSUE REGISTER
# ============================================================

@router.get(
    "/{batch_id}/issues"
)
def get_upload_issues(
    batch_id: str,
):

    initialise_upload_database()


    with get_upload_connection() as connection:

        batch = connection.execute(
            """
            SELECT
                batch_id,
                dataset,
                filename

            FROM upload_batches

            WHERE batch_id = ?
            """,
            (
                batch_id,
            ),
        ).fetchone()


        if batch is None:

            raise HTTPException(
                status_code=404,
                detail=(
                    "Upload batch not found."
                ),
            )


        issues = connection.execute(
            """
            SELECT
                issue_id,
                row_number,
                severity,
                issue_type,
                column_name,
                value,
                message

            FROM upload_issues

            WHERE batch_id = ?

            ORDER BY
                row_number,
                issue_id
            """,
            (
                batch_id,
            ),
        ).fetchall()


    return {

        "batch_id":
            batch_id,

        "dataset":
            batch[
                "dataset"
            ],

        "filename":
            batch[
                "filename"
            ],

        "issue_count":
            len(
                issues
            ),

        "issues":
            [
                dict(issue)
                for issue in issues
            ],
    }


# ============================================================
# DOWNLOAD STAGED OUTPUT
# ============================================================

@router.get(
    "/{batch_id}/file/{file_type}"
)
def download_staged_file(
    batch_id: str,
    file_type: str,
):

    allowed_files = {
        "accepted":
            "accepted.csv",

        "quarantine":
            "quarantine.csv",

        "issues":
            "issues.csv",

        "metadata":
            "metadata.json",
    }


    if file_type not in allowed_files:

        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid staged file type."
            ),
        )


    initialise_upload_database()


    with get_upload_connection() as connection:

        batch = connection.execute(
            """
            SELECT
                staging_path

            FROM upload_batches

            WHERE batch_id = ?
            """,
            (
                batch_id,
            ),
        ).fetchone()


    if batch is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Upload batch not found."
            ),
        )


    path = (
        Path(
            batch[
                "staging_path"
            ]
        )
        /
        allowed_files[
            file_type
        ]
    )


    if not path.exists():

        raise HTTPException(
            status_code=404,
            detail=(
                "Staged file not found."
            ),
        )


    media_type = (
        "application/json"
        if file_type == "metadata"
        else
        "text/csv"
    )


    return Response(
        content=path.read_bytes(),
        media_type=media_type,
        headers={
            "Content-Disposition":
                (
                    "attachment; "
                    f'filename="{path.name}"'
                )
        },
    )


# ============================================================
# HEALTH
# ============================================================

@router.get(
    "/health/status"
)
def upload_health():

    initialise_upload_database()


    return {

        "status":
            "ok",

        "upload_root":
            str(
                UPLOAD_ROOT
            ),

        "staging_only":
            True,

        "supported_datasets":
            list(
                DATASET_SCHEMAS.keys()
            ),

        "max_upload_mb":
            round(
                MAX_UPLOAD_BYTES
                /
                1024
                /
                1024,
                1,
            ),

        "max_rows":
            MAX_UPLOAD_ROWS,
    }


# ============================================================
# INITIALISE
# ============================================================

initialise_upload_database()
