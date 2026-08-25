"""The migration must reproduce the schema from an empty database.

These are deliberately synchronous: Alembic's env.py calls ``asyncio.run``,
which cannot be nested inside an already running event loop.
"""

from pathlib import Path

from sqlalchemy import create_engine, inspect

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from app.core.config import settings
from app.models import Base

BACKEND_DIR = Path(__file__).resolve().parents[1]

EXPECTED_TABLES = {
    "users",
    "courses",
    "modules",
    "contents",
    "quizzes",
    "questions",
    "answers",
    "assignments",
    "enrollments",
    "content_progress",
    "module_progress",
    "quiz_attempts",
    "quiz_attempt_answers",
    "certificates",
}


def _alembic_config(db_path: Path, monkeypatch) -> Config:
    url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    monkeypatch.setattr(settings, "DATABASE_URL_OVERRIDE", url)
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return config


def test_upgrade_creates_every_table_from_empty(tmp_path, monkeypatch):
    db_path = tmp_path / "upgrade.db"
    config = _alembic_config(db_path, monkeypatch)

    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    try:
        tables = set(inspect(engine).get_table_names())
    finally:
        engine.dispose()

    assert EXPECTED_TABLES <= tables
    assert "alembic_version" in tables


def test_migrated_schema_matches_the_models(tmp_path, monkeypatch):
    """Guards against a model change that never made it into a migration."""
    db_path = tmp_path / "drift.db"
    config = _alembic_config(db_path, monkeypatch)
    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(connection, opts={"compare_type": True})
            differences = [
                difference
                for difference in compare_metadata(context, Base.metadata)
                if "alembic_version" not in str(difference)
            ]
    finally:
        engine.dispose()

    assert differences == [], f"schema drift between models and migration: {differences}"


def test_downgrade_removes_every_table(tmp_path, monkeypatch):
    db_path = tmp_path / "downgrade.db"
    config = _alembic_config(db_path, monkeypatch)
    command.upgrade(config, "head")

    command.downgrade(config, "base")

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    try:
        remaining = set(inspect(engine).get_table_names())
    finally:
        engine.dispose()

    assert remaining - {"alembic_version"} == set()
