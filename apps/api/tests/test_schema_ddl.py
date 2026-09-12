"""T-10 DDL validity (design section 4) -- DB-free.

Compiles every table's CREATE TABLE to the postgresql dialect and asserts non-empty DDL carrying
the Postgres-specific type forms the section-4 schema relies on (uuidv7(), JSONB,
TEXT[]). No live DB required.
"""

from __future__ import annotations

from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from app.db.models import EXPECTED_TABLES, Base


def _ddl(name: str) -> str:
    table = Base.metadata.tables[name]
    return str(CreateTable(table).compile(dialect=postgresql.dialect())).strip().lower()


def test_every_table_produces_postgres_ddl():
    for name in EXPECTED_TABLES:
        sql = _ddl(name)
        assert sql.startswith("create table"), f"{name}: {sql[:40]!r}"
        assert "id" in sql, f"{name}: DDL missing id column"


def test_postgres_specific_anchors_present():
    exercise = _ddl("exercise")
    assert "uuidv7()" in exercise, "exercise.id should default to uuidv7()"
    assert "jsonb" in exercise, "exercise.cues should render as JSONB"
    template = _ddl("workout_template")
    assert "structure" in template and "jsonb" in template


def test_text_array_render():
    sql = _ddl("user_preferences")
    assert "text[]" in sql, f"user_preferences should carry TEXT[] columns:\n{sql}"
