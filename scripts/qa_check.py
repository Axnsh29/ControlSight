"""
ControlSight Engineering QA Runner

Runs:
1. Python compilation
2. Frontend JavaScript syntax validation
3. Critical Ruff correctness checks
4. API regression tests
"""

from pathlib import Path
import subprocess
import sys


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)


FRONTEND_JS_FILES = [
    "src/frontend/js/dashboard.js",
    "src/frontend/js/polish.js",
    "src/frontend/js/upload.js",
    "src/frontend/js/attention-ui.js",
    "src/frontend/js/change-control-ui.js",
    "src/frontend/js/risk-cashflow-ui.js",
    "src/frontend/js/report-pack-ui.js",
    "src/frontend/js/app-shell.js",
    "src/frontend/js/ui-polish.js",
    "src/frontend/js/navigation-layout.js",
    "src/frontend/js/sidebar-drawer.js",
]


def run(
    label: str,
    command: list[str],
) -> None:

    print()
    print("=" * 72)
    print(label)
    print("=" * 72)

    print(
        "$ "
        +
        " ".join(command)
    )

    result = subprocess.run(
        command,
        cwd=str(PROJECT_ROOT),
        check=False,
    )

    if result.returncode != 0:

        print()
        print(
            f"FAILED: {label}"
        )

        raise SystemExit(
            result.returncode
        )

    print(
        f"PASS: {label}"
    )


def main() -> None:

    run(
        "Python compilation",
        [
            sys.executable,
            "-m",
            "compileall",
            "-q",
            "src/backend",
            "tests",
            "scripts",
        ],
    )


    for relative_path in FRONTEND_JS_FILES:

        absolute_path = (
            PROJECT_ROOT
            /
            relative_path
        )

        if not absolute_path.exists():

            print()
            print(
                f"WARNING: frontend module missing: "
                f"{relative_path}"
            )

            continue


        run(
            (
                "JavaScript syntax: "
                f"{relative_path}"
            ),
            [
                "node",
                "--check",
                relative_path,
            ],
        )


    run(
        "Ruff critical correctness checks",
        [
            "ruff",
            "check",
            "--config",
            ".ruff.toml",
            "src",
            "tests",
        ],
    )


    run(
        "ControlSight API regression tests",
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
        ],
    )


    print()
    print("=" * 72)
    print("CONTROLSIGHT QA PASSED")
    print("=" * 72)


if __name__ == "__main__":
    main()
