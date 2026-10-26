"""
ControlSight API Smoke / Regression Tests

These tests intentionally focus on:
- application availability
- critical API contracts
- major reviewer-feedback modules
- response structure rather than fragile exact numbers

They are not intended to replace detailed unit testing.
"""

from __future__ import annotations

from pathlib import Path
import subprocess
import sys

import pytest
from fastapi.testclient import TestClient


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)

DATABASE_PATH = (
    PROJECT_ROOT
    / "data"
    / "database"
    / "controlsight.db"
)


# ============================================================
# DATABASE PREPARATION
# ============================================================

def ensure_database_exists() -> None:
    """
    Build the analytical database if it does not exist.

    This makes local testing and CI more reliable without
    requiring the generated SQLite file to be committed.
    """

    if DATABASE_PATH.exists():
        return

    build_script = (
        PROJECT_ROOT
        / "src"
        / "backend"
        / "build_database.py"
    )

    if not build_script.exists():
        pytest.fail(
            "ControlSight database is missing and "
            "src/backend/build_database.py was not found."
        )

    result = subprocess.run(
        [
            sys.executable,
            str(build_script),
        ],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:

        pytest.fail(
            "Database build failed.\n\n"
            f"STDOUT:\n{result.stdout}\n\n"
            f"STDERR:\n{result.stderr}"
        )

    if not DATABASE_PATH.exists():

        pytest.fail(
            "build_database.py completed but "
            "controlsight.db was not created."
        )


ensure_database_exists()


# ============================================================
# APP
# ============================================================

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(
        0,
        str(PROJECT_ROOT),
    )


from src.backend.main import app  # noqa: E402


client = TestClient(
    app
)


# ============================================================
# HELPERS
# ============================================================

def assert_ok(
    response,
):

    assert response.status_code == 200, (
        f"Expected HTTP 200 but received "
        f"{response.status_code}: "
        f"{response.text}"
    )


def extract_projects(
    payload,
):

    if isinstance(
        payload,
        list,
    ):
        return payload

    if isinstance(
        payload,
        dict,
    ):

        for key in [
            "projects",
            "data",
            "results",
        ]:

            value = payload.get(
                key
            )

            if isinstance(
                value,
                list,
            ):
                return value

    return []


def extract_project_code(
    project,
):

    return (
        project.get(
            "project_code"
        )
        or
        project.get(
            "code"
        )
    )


@pytest.fixture(
    scope="session"
)
def project_code():

    response = client.get(
        "/api/projects"
    )

    assert_ok(
        response
    )

    projects = extract_projects(
        response.json()
    )

    assert projects, (
        "/api/projects returned "
        "no projects."
    )

    code = extract_project_code(
        projects[0]
    )

    assert code, (
        "First project did not contain "
        "project_code or code."
    )

    return code


# ============================================================
# CORE APPLICATION
# ============================================================

def test_projects_endpoint():

    response = client.get(
        "/api/projects"
    )

    assert_ok(
        response
    )

    projects = extract_projects(
        response.json()
    )

    assert len(projects) > 0


def test_portfolio_kpis():

    response = client.get(
        "/api/kpis"
    )

    assert_ok(
        response
    )

    payload = response.json()

    assert isinstance(
        payload,
        dict,
    )


def test_data_quality():

    response = client.get(
        "/api/data-quality"
    )

    assert_ok(
        response
    )

    payload = response.json()

    assert isinstance(
        payload,
        dict,
    )


# ============================================================
# FORECAST CREDIBILITY
# ============================================================

def test_forecast_credibility(
    project_code,
):

    response = client.get(
        (
            f"/api/projects/"
            f"{project_code}/"
            f"forecast-credibility"
        )
    )

    assert_ok(
        response
    )

    payload = response.json()

    assert (
        payload.get(
            "project_code"
        )
        ==
        project_code
    )

    required_fields = [
        "reported_fac",
        "actual_cost_to_date",
        "actual_progress_pct",
        "progress_implied_eac",
        "forecast_credibility_gap",
        "forecast_credibility_gap_pct",
        "forecast_credibility_status",
        "formal_evm",
        "replaces_reported_fac",
    ]

    for field in required_fields:

        assert field in payload, (
            f"Forecast credibility response "
            f"is missing '{field}'."
        )


# ============================================================
# ATTENTION ENGINE
# ============================================================

def test_attention_health():

    response = client.get(
        "/api/attention/health/status"
    )

    assert_ok(
        response
    )

    payload = response.json()

    assert payload.get(
        "status"
    ) == "ok"

    assert payload.get(
        "custom_reranking"
    ) is True


def test_attention_ranking():

    response = client.get(
        "/api/attention/ranking"
    )

    assert_ok(
        response
    )

    payload = response.json()

    assert isinstance(
        payload,
        dict,
    )


# ============================================================
# BYO DATA UPLOAD
# ============================================================

def test_upload_health():

    response = client.get(
        "/api/uploads/health/status"
    )

    assert_ok(
        response
    )

    payload = response.json()

    assert payload.get(
        "status"
    ) == "ok"


def test_upload_templates():

    response = client.get(
        "/api/uploads/templates"
    )

    assert_ok(
        response
    )

    payload = response.json()

    assert isinstance(
        payload,
        dict,
    )


# ============================================================
# CHANGE CONTROL
# ============================================================

def test_change_control_health():

    response = client.get(
        "/api/change-control/health/status"
    )

    assert_ok(
        response
    )

    payload = response.json()

    assert payload.get(
        "status"
    ) == "ok"

    assert (
        payload.get(
            "approved_changes_affect_current_budget"
        )
        is True
    )


def test_change_control_summary(
    project_code,
):

    response = client.get(
        (
            "/api/change-control/"
            f"projects/{project_code}/summary"
        )
    )

    assert_ok(
        response
    )

    payload = response.json()

    required_fields = [
        "original_budget",
        "current_budget",
        "approved_changes",
        "pending_changes",
    ]

    for field in required_fields:

        assert field in payload, (
            f"Change-control summary "
            f"is missing '{field}'."
        )


# ============================================================
# CONTINGENCY / RISK / CASH FLOW
# ============================================================

def test_risk_cashflow_health():

    response = client.get(
        "/api/risk-cashflow/health/status"
    )

    assert_ok(
        response
    )

    payload = response.json()

    assert payload.get(
        "status"
    ) == "ok"

    assert (
        payload.get(
            "cashflow_separate_from_cost"
        )
        is True
    )


def test_contingency_summary(
    project_code,
):

    response = client.get(
        (
            "/api/risk-cashflow/"
            f"projects/{project_code}/"
            "contingency"
        )
    )

    assert_ok(
        response
    )

    payload = response.json()

    required_fields = [
        "current_budget",
        "contingency_budget",
        "remaining_contingency",
        "proposed_risk_exposure",
        "committed_contingency",
    ]

    for field in required_fields:

        assert field in payload, (
            f"Contingency response "
            f"is missing '{field}'."
        )


def test_cashflow_summary(
    project_code,
):

    response = client.get(
        (
            "/api/risk-cashflow/"
            f"projects/{project_code}/"
            "cashflow"
        )
    )

    assert_ok(
        response
    )

    payload = response.json()

    required_fields = [
        "total_forecast_cash",
        "total_actual_cash",
        "total_committed_cash",
        "periods",
    ]

    for field in required_fields:

        assert field in payload, (
            f"Cash-flow response "
            f"is missing '{field}'."
        )


# ============================================================
# MONTHLY REPORT PACK
# ============================================================

def test_report_pack_health():

    response = client.get(
        "/api/report-pack/health/status"
    )

    assert_ok(
        response
    )

    payload = response.json()

    assert payload.get(
        "status"
    ) == "ok"

    assert payload.get(
        "pdf_export"
    ) is True

    assert payload.get(
        "excel_export"
    ) is True


def test_report_pack_preview(
    project_code,
):

    response = client.get(
        (
            "/api/report-pack/"
            f"preview/{project_code}"
        )
    )

    assert_ok(
        response
    )

    payload = response.json()

    assert (
        payload.get(
            "project",
            {}
        ).get(
            "project_code"
        )
        ==
        project_code
    )

    required_sections = [
        "performance",
        "change_control",
        "risk_control",
        "cashflow",
        "schedule",
        "procurement",
        "commentary",
        "actions",
        "methodology_notes",
    ]

    for section in required_sections:

        assert section in payload, (
            f"Report preview missing "
            f"'{section}'."
        )


# ============================================================
# FRONTEND
# ============================================================

def test_dashboard_home():

    response = client.get(
        "/"
    )

    assert response.status_code == 200

    content_type = (
        response.headers.get(
            "content-type",
            ""
        )
    )

    assert "text/html" in content_type


def test_frontend_modules_available():

    modules = [
        "/js/polish.js",
        "/js/upload.js",
        "/js/attention-ui.js",
        "/js/change-control-ui.js",
        "/js/risk-cashflow-ui.js",
        "/js/report-pack-ui.js",
    ]

    for module in modules:

        response = client.get(
            module
        )

        assert response.status_code == 200, (
            f"{module} was not served. "
            f"HTTP {response.status_code}"
        )


# ============================================================
# OPENAPI
# ============================================================

def test_openapi_schema():

    response = client.get(
        "/openapi.json"
    )

    assert_ok(
        response
    )

    schema = response.json()

    assert schema.get(
        "openapi"
    )

    paths = schema.get(
        "paths",
        {}
    )

    expected_paths = [

        "/api/projects",

        (
            "/api/projects/"
            "{project_code}/"
            "forecast-credibility"
        ),

        "/api/attention/ranking",

        (
            "/api/change-control/"
            "projects/{project_code}/summary"
        ),

        (
            "/api/risk-cashflow/"
            "projects/{project_code}/contingency"
        ),

        "/api/report-pack/generate",
    ]


    for path in expected_paths:

        assert path in paths, (
            f"OpenAPI schema missing "
            f"expected route: {path}"
        )
