"""T-10 schema shape lock (design section 4) -- DB-free, pure metadata.

Walks app.db.models.Base.metadata and asserts the schema matches the DDL in
docs/HIIT_WORKOUT_APP_DESIGN.md section 4: tables, columns (+ JSONB / TEXT[] types),
primary/unique keys, foreign keys (+ ON DELETE), and CHECK constraints. No live DB required;
the live round-trip lives in test_migration_applies.py.
"""

from __future__ import annotations

from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from app.db.models import EXPECTED_TABLES, Base

# Table -> exact column names that must exist (order-independent).
EXPECTED_COLUMNS: dict[str, list[str]] = {
    "equipment": ["id", "slug", "name", "icon_name", "is_builtin"],
    "muscle_group": ["id", "slug", "name", "region"],
    "exercise": [
        "id",
        "slug",
        "name",
        "description",
        "cues",
        "difficulty",
        "intensity",
        "gif_url",
        "is_archived",
        "created_at",
        "updated_at",
    ],
    "exercise_muscle_group": ["exercise_id", "muscle_group_id", "is_primary"],
    "exercise_equipment": ["exercise_id", "equipment_id"],
    "workout_template": [
        "id",
        "slug",
        "name",
        "description",
        "goal",
        "structure",
        "emphasis",
        "total_seconds",
        "structure_version",
        "music",
        "equipment_required",
        "target_muscle_groups",
        "enabled",
        "created_by",
        "created_at",
    ],
    "workout_phase": [
        "id",
        "template_id",
        "position",
        "phase_type",
        "title",
        "description",
        "rounds",
        "rest_seconds",
        "prep_seconds",
        "transition_seconds",
    ],
    "phase_exercise": [
        "id",
        "phase_id",
        "position",
        "exercise_id",
        "work_seconds",
        "cue_override",
    ],
    "workout_plan": [
        "id",
        "slug",
        "name",
        "description",
        "cadence",
        "cycle_weeks",
        "enabled",
        "source",
        "created_at",
    ],
    "plan_week": ["id", "plan_id", "week_index", "theme", "description"],
    "plan_slot": ["id", "week_id", "slot", "kind", "label", "template_slug", "params"],
    "user": ["id", "email", "name", "soundcloud_handle", "created_at"],
    "playlist": [
        "id",
        "user_id",
        "name",
        "provider",
        "playlist_ref",
        "volume",
        "start_on",
        "is_default",
        "updated_at",
    ],
    "workout_run": [
        "id",
        "template_id",
        "plan_slot_id",
        "owner_user_id",
        "playlist_id",
        "status",
        "source",
        "started_at_ms",
        "ended_at_ms",
        "duration_ms",
        "beats",
        "music",
    ],
    "user_preferences": [
        "user_id",
        "level",
        "target_duration_seconds",
        "focus",
        "target_muscle_groups",
        "avoid_muscle_groups",
        "equipment_slugs",
        "notes",
        "updated_at",
    ],
    "workout_feedback": [
        "id",
        "run_id",
        "user_id",
        "rpe",
        "rating",
        "notes",
        "completed",
        "skipped",
        "created_at",
    ],
}

# (table, tuple of fk source columns) -> (referred table, ON DELETE action).
EXPECTED_FKS: dict[tuple[str, tuple[str, ...]], tuple[str, str]] = {
    ("exercise_muscle_group", ("exercise_id",)): ("exercise", "CASCADE"),
    ("exercise_muscle_group", ("muscle_group_id",)): ("muscle_group", "CASCADE"),
    ("exercise_equipment", ("exercise_id",)): ("exercise", "CASCADE"),
    ("exercise_equipment", ("equipment_id",)): ("equipment", "CASCADE"),
    ("workout_phase", ("template_id",)): ("workout_template", "CASCADE"),
    ("phase_exercise", ("phase_id",)): ("workout_phase", "CASCADE"),
    ("phase_exercise", ("exercise_id",)): ("exercise", "RESTRICT"),
    ("plan_week", ("plan_id",)): ("workout_plan", "CASCADE"),
    ("plan_slot", ("week_id",)): ("plan_week", "CASCADE"),
    ("playlist", ("user_id",)): ("user", "CASCADE"),
    ("workout_run", ("template_id",)): ("workout_template", "CASCADE"),
    ("workout_run", ("owner_user_id",)): ("user", "SET NULL"),
    ("workout_run", ("playlist_id",)): ("playlist", "SET NULL"),
    ("user_preferences", ("user_id",)): ("user", "CASCADE"),
    ("workout_feedback", ("run_id",)): ("workout_run", "CASCADE"),
}

# table -> expected composite primary key.
EXPECTED_PK: dict[str, list[str]] = {
    "exercise_muscle_group": ["exercise_id", "muscle_group_id"],
    "exercise_equipment": ["exercise_id", "equipment_id"],
    "user_preferences": ["user_id"],
}

UNIQUE: dict[str, list[str]] = {
    "workout_phase": ["template_id", "position"],
    "phase_exercise": ["phase_id", "position"],
    "plan_week": ["plan_id", "week_index"],
    "user": ["email"],
}

ARRAY_COLS = ("target_muscle_groups", "avoid_muscle_groups", "equipment_slugs", "skipped")


def _ddl(name: str) -> str:
    table = Base.metadata.tables[name]
    return str(CreateTable(table).compile(dialect=postgresql.dialect())).strip().lower()


def test_all_expected_tables_present():
    tables = set(Base.metadata.tables)
    assert tables == set(EXPECTED_TABLES), (
        f"mismatch missing={sorted(set(EXPECTED_TABLES) - tables)} "
        f"extra={sorted(tables - set(EXPECTED_TABLES))}"
    )
    assert set(EXPECTED_COLUMNS) == set(EXPECTED_TABLES), "EXPECTED_* disagree"


def test_columns_present():
    for table_name, cols in EXPECTED_COLUMNS.items():
        table = Base.metadata.tables[table_name]
        got = {c.name for c in table.columns}
        assert got == set(cols), f"{table_name}: columns {sorted(got)} != {sorted(cols)}"


def test_jsonb_and_array_types():
    d = {name: _ddl(name) for name in EXPECTED_TABLES}
    for table_name in ("exercise", "workout_template", "workout_plan", "plan_slot", "workout_run"):
        for jcol in ("cues", "music", "cadence", "params", "beats"):
            if jcol in EXPECTED_COLUMNS[table_name]:
                assert "jsonb" in d[table_name], f"{table_name}.{jcol} not JSONB"
    for acol in ARRAY_COLS:
        owner = {t for t, c in EXPECTED_COLUMNS.items() if acol in c}
        assert owner, f"{acol} expected in some table"
        for t in owner:
            assert "[]" in d[t], f"{t}.{acol} not an array type, got:\n{d[t]}"


def test_uuid_primary_keys_default_uuidv7():
    for table_name in EXPECTED_TABLES:
        if table_name in EXPECTED_PK:
            continue
        table = Base.metadata.tables[table_name]
        pk = [c.name for c in table.primary_key.columns]
        assert pk == ["id"], f"{table_name}: PK {pk} != ['id']"
        sd = table.c.id.server_default
        assert sd is not None and "uuidv7" in str(sd.arg), (
            f"{table_name}.id must default to uuidv7()"
        )


def test_composite_primary_keys():
    for table_name, cols in EXPECTED_PK.items():
        table = Base.metadata.tables[table_name]
        pk = [c.name for c in table.primary_key.columns]
        assert sorted(pk) == sorted(cols), f"{table_name}: composite PK {sorted(pk)} != {cols}"


def test_unique_constraints():
    for table_name, cols in UNIQUE.items():
        table = Base.metadata.tables[table_name]
        got = [
            sorted(c.name for c in u.columns)
            for u in table.constraints
            if type(u).__name__ == "UniqueConstraint"
        ]
        assert sorted(cols) in got, f"{table_name}: missing UNIQUE {cols} (have {got})"


def test_foreign_keys_and_on_delete():
    for (table_name, fcols), (ref_table, ondelete) in EXPECTED_FKS.items():
        table = Base.metadata.tables[table_name]
        match = None
        for fk in table.foreign_keys:
            if (fk.parent.name,) == fcols:
                match = fk
                break
        assert match is not None, f"{table_name}.{fcols}: no FK to {ref_table}"
        ref = match.column.table.name
        assert ref == ref_table, f"{table_name}.{fcols} -> {ref}, want {ref_table}"
        action = (match.ondelete or "NO ACTION").upper()
        assert action == ondelete, f"{table_name}.{fcols}: ondelete {action!r} != {ondelete!r}"


def _ddl_collapsed(name: str) -> str:
    return "".join(_ddl(name).split())


def test_check_constraints_present():
    phase = _ddl_collapsed("workout_phase")
    ex = _ddl_collapsed("phase_exercise")
    play = _ddl_collapsed("playlist")
    slot = _ddl_collapsed("plan_slot")
    assert "rounds>=1" in phase and "rest_seconds>=0" in phase and "prep_seconds>=0" in phase, phase
    assert "work_seconds>0" in ex, ex
    assert "volumebetween0and1" in play, play
    assert "kind" in slot and "template_slug" in slot and "isnull" in slot, slot


def test_no_future_tables_leaked():
    """F-06/F-07/F-08 tables must NOT be created by T-10."""
    leaked = ["health_metric", "wearable", "workout_evaluation", "user_soundcloud_"]
    assert not any(t in Base.metadata.tables for t in leaked), f"future table leaked: {leaked}"
