"""T-11 (STOP-D) -- Postgres-18 persistence smoke for the seed loader.

The schema uses PG-18 core capabilities the SQLite fallback cannot express:
``uuidv7()`` PK defaults and ``JSONB`` columns. ``seed_all`` is exercised on a real Postgres when
one is reachable, else the test degrades to a clean ``pytest.skip`` (local / CI without a PG
service). Point it at one with ``PG_TEST_DSN`` (or ``TEST_DATABASE_URL``, non-sqlite), e.g.
``postgresql://postgres:postgres@localhost:5432/coach_test``.

When it runs, it builds ``Base.metadata`` in an isolation schema, seeds, re-seeds (idempotency),
and re-verifies I2 after the DB round-trip.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # app/

REPO_ROOT = Path(__file__).resolve().parents[3]

from app.db import models  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.engine.build_timeline import total_seconds_of  # noqa: E402
from app.seed import check_seed, load_workouts, seed_all  # noqa: E402

_SCHEMA = "coach_smoke"


def _dsn() -> str | None:
    raw = os.environ.get("PG_TEST_DSN") or os.environ.get("TEST_DATABASE_URL")
    if not raw or "sqlite" in raw:
        return None
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw.split("://", 1)[1]
    return raw


@pytest.fixture(scope="module")
def pg_session():
    dsn = _dsn()
    if dsn is None:
        pytest.skip("no PG_TEST_DSN/TEST_DATABASE_URL -- persistence path not exercised this run")
    engine = create_engine(dsn)
    session = None
    try:
        with engine.begin() as conn:
            conn.execute(f"DROP SCHEMA IF EXISTS {_SCHEMA} CASCADE")
            conn.execute(f"CREATE SCHEMA {_SCHEMA}")
        for c in Base.metadata.sorted_tables:
            with engine.begin() as conn:
                conn.run_sync(lambda s, t=c: t.create(s, checkfirst=True))
        session = sessionmaker(bind=engine)()
        session.execute(f"SET search_path TO {_SCHEMA}")
        yield session
    except Exception as e:  # noqa: BLE001 -- a dead PG is a skip, not a failure
        raise pytest.skip(f"PG not reachable at {dsn!r} -- {e}")
    finally:
        if session is not None:
            session.close()
        engine.dispose()


def test_seed_all_is_idempotent(pg_session) -> None:
    check = check_seed(REPO_ROOT)
    assert check.ok, check.errors

    seed_all(pg_session, REPO_ROOT, enforce_invariants=True)
    pg_session.commit()
    n1 = pg_session.query(models.WorkoutTemplate).with_entities(func.count()).scalar()
    assert n1 == len(check.template_slugs), n1

    # Re-seed: idempotent by slug -- no duplicates.
    seed_all(pg_session, REPO_ROOT, enforce_invariants=True)
    pg_session.commit()
    n2 = pg_session.query(models.WorkoutTemplate).with_entities(func.count()).scalar()
    assert n2 == n1, f"idempotency broken: {n1} -> {n2}"


def test_i2_survives_persistence(pg_session) -> None:
    # I2 survives the DB round-trip: stored total_seconds == rebuilt total.
    check = check_seed(REPO_ROOT)
    for tmpl in load_workouts(REPO_ROOT):
        rebuilt = total_seconds_of(tmpl)
        row = pg_session.query(models.WorkoutTemplate).filter_by(slug=tmpl["slug"]).one()
        assert row.total_seconds == rebuilt, f"{tmpl['slug']}: {row.total_seconds} != {rebuilt}"
        assert row.equipment_required is not None  # new JSONB column persisted
        assert row.target_muscle_groups is not None
