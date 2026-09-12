"""T-10 schema: live migration round-trip (upgrade head -> verify -> downgrade base).

Runs against a real Postgres only when DATABASE_URL (and/or the live env) is configured; otherwise
skips cleanly so the committed pipeline stays green. The connection string is never hardcoded.
"""

from __future__ import annotations

import os

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.dialects import postgresql

CORE_TABLES = {
    "equipment",
    "muscle_group",
    "exercise",
    "exercise_muscle_group",
    "exercise_equipment",
    "workout_template",
    "workout_phase",
    "phase_exercise",
    "workout_plan",
    "plan_week",
    "plan_slot",
    "user",
    "playlist",
    "workout_run",
    "user_preferences",
    "workout_feedback",
}


@pytest.fixture(scope="session")
def live_url() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip(
            "no DATABASE_URL set; live round-trip skipped (wired via Testcontainers in T-11)"
        )
    return url.replace("+asyncpg", "")


def _cfg(url: str) -> Config:
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", url)
    return config


def _tables(url: str) -> set[str]:
    engine = create_engine(url)
    names = set(inspect(engine).get_table_names())
    engine.dispose()
    return names


def test_postgres_dialect_compiles() -> None:
    postgresql.dialect()


def test_upgrade_creates_all_core_tables_then_downgrades(live_url: str) -> None:
    cfg = _cfg(live_url)
    command.upgrade(cfg, "head")
    tables = _tables(live_url)
    missing = sorted(CORE_TABLES - tables)
    assert not missing, f"upgrade did not create all core tables; missing {missing}"
    leaked = [
        t for t in tables if t.startswith(("health_metric", "wearable", "workout_evaluation"))
    ]
    assert not leaked, f"a future (F-06/F-07/F-08) table leaked into T-10: {leaked}"
    command.downgrade(cfg, "base")
    remaining = _tables(live_url)
    left = sorted(CORE_TABLES & remaining)
    assert not left, f"downgrade left core tables: {left}"
