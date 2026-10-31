from pathlib import Path
import os
import shutil


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

BUNDLED_DATABASE_PATH = (
    PROJECT_ROOT
    / "data"
    / "database"
    / "controlsight.db"
)


def get_runtime_database_path():

    # Local development keeps using the normal database.
    if not os.getenv("VERCEL"):
        return BUNDLED_DATABASE_PATH

    # Vercel allows temporary writable storage under /tmp.
    runtime_path = Path(
        "/tmp/controlsight.db"
    )

    if not BUNDLED_DATABASE_PATH.exists():
        raise FileNotFoundError(
            f"Bundled ControlSight database not found: "
            f"{BUNDLED_DATABASE_PATH}"
        )

    # Each new serverless instance gets its own writable copy.
    if not runtime_path.exists():
        shutil.copy2(
            BUNDLED_DATABASE_PATH,
            runtime_path
        )

    return runtime_path
