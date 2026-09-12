"""initial schema (design section 4) -- 16 core tables (incl. user_preferences).

Revision ID: 0001
Revises:
Create Date: 2026-07-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = postgresql.UUID


def upgrade() -> None:
    # catalog ---------------------------------------------------------------
    op.create_table(
        "equipment",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("icon_name", sa.String(), nullable=True),
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "muscle_group",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("region", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "exercise",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "cues",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column("difficulty", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("intensity", sa.SmallInteger(), nullable=False, server_default=sa.text("4")),
        sa.Column("gif_url", sa.String(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "exercise_muscle_group",
        sa.Column("exercise_id", UUID(), nullable=False),
        sa.Column("muscle_group_id", UUID(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(
            ["exercise_id"], ["exercise.id"], ondelete="CASCADE", name="fk_eeg_exercise"
        ),
        sa.ForeignKeyConstraint(
            ["muscle_group_id"], ["muscle_group.id"], ondelete="CASCADE", name="fk_eeg_muscle_group"
        ),
        sa.PrimaryKeyConstraint("exercise_id", "muscle_group_id"),
    )
    op.create_table(
        "exercise_equipment",
        sa.Column("exercise_id", UUID(), nullable=False),
        sa.Column("equipment_id", UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["exercise_id"], ["exercise.id"], ondelete="CASCADE", name="fk_eeq_exercise"
        ),
        sa.ForeignKeyConstraint(
            ["equipment_id"], ["equipment.id"], ondelete="CASCADE", name="fk_eeq_equipment"
        ),
        sa.PrimaryKeyConstraint("exercise_id", "equipment_id"),
    )
    # composition ----------------------------------------------------------
    op.create_table(
        "workout_template",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("goal", sa.String(), nullable=True),
        sa.Column("structure", sa.String(), nullable=False, server_default=sa.text("'fixed-hiit'")),
        sa.Column("emphasis", sa.String(), nullable=True),
        sa.Column("total_seconds", sa.Integer(), nullable=False),
        sa.Column("structure_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("music", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "workout_phase",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("template_id", UUID(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("phase_type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("rounds", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("rest_seconds", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("prep_seconds", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("transition_seconds", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.CheckConstraint(
            "rounds >= 1 AND rest_seconds >= 0 AND prep_seconds >= 0",
            name="ck_workout_phase_positive",
        ),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["workout_template.id"],
            ondelete="CASCADE",
            name="fk_workout_phase_template",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_id", "position", name="uq_workout_phase_template_position"),
    )
    op.create_table(
        "phase_exercise",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("phase_id", UUID(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("exercise_id", UUID(), nullable=False),
        sa.Column("work_seconds", sa.Integer(), nullable=False),
        sa.Column("cue_override", sa.String(), nullable=True),
        sa.CheckConstraint("work_seconds > 0", name="ck_phase_exercise_work_positive"),
        sa.ForeignKeyConstraint(
            ["phase_id"], ["workout_phase.id"], ondelete="CASCADE", name="fk_phase_exercise_phase"
        ),
        sa.ForeignKeyConstraint(
            ["exercise_id"], ["exercise.id"], ondelete="RESTRICT", name="fk_phase_exercise_exercise"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("phase_id", "position", name="uq_phase_exercise_phase_position"),
    )
    # regiment -------------------------------------------------------------
    op.create_table(
        "workout_plan",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cadence", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("cycle_weeks", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "plan_week",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("plan_id", UUID(), nullable=False),
        sa.Column("week_index", sa.Integer(), nullable=False),
        sa.Column("theme", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["plan_id"], ["workout_plan.id"], ondelete="CASCADE", name="fk_plan_week_plan"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "week_index", name="uq_plan_week_plan_week"),
    )
    op.create_table(
        "plan_slot",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("week_id", UUID(), nullable=False),
        sa.Column("slot", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("template_slug", sa.String(), nullable=True),
        sa.Column(
            "params",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.CheckConstraint(
            "(kind = 'rest' AND template_slug IS NULL) "
            "OR (kind <> 'rest' AND template_slug IS NOT NULL)",
            name="ck_plan_slot_kind_template",
        ),
        sa.ForeignKeyConstraint(
            ["week_id"], ["plan_week.id"], ondelete="CASCADE", name="fk_plan_slot_week"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # account + playlist (D9 one-to-one) -----------------------------------
    op.create_table(
        "user",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("email", sa.String(), nullable=False),
        sa.UniqueConstraint("email", name="uq_user_email"),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("soundcloud_handle", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "playlist",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("user_id", UUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False, server_default=sa.text("'soundcloud'")),
        sa.Column("playlist_ref", sa.String(), nullable=False),
        sa.Column("volume", sa.Numeric(), nullable=False, server_default=sa.text("0.3")),
        sa.Column("start_on", sa.String(), nullable=False, server_default=sa.text("'run_start'")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("volume BETWEEN 0 AND 1", name="ck_playlist_volume"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], ondelete="CASCADE", name="fk_playlist_user"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    # runs + feedback (AI-loop substrate, D1/D2) ---------------------------
    op.create_table(
        "workout_run",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("template_id", UUID(), nullable=False),
        sa.Column("plan_slot_id", UUID(), nullable=True),
        sa.Column("owner_user_id", UUID(), nullable=True),
        sa.Column("playlist_id", UUID(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default=sa.text("'scheduled'")),
        sa.Column("source", sa.String(), nullable=False, server_default=sa.text("'solo'")),
        sa.Column("started_at_ms", sa.BigInteger(), nullable=True),
        sa.Column("ended_at_ms", sa.BigInteger(), nullable=True),
        sa.Column("duration_ms", sa.BigInteger(), nullable=False),
        sa.Column("beats", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("music", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["workout_template.id"],
            ondelete="CASCADE",
            name="fk_workout_run_template",
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"], ["user.id"], ondelete="SET NULL", name="fk_workout_run_owner"
        ),
        sa.ForeignKeyConstraint(
            ["playlist_id"], ["playlist.id"], ondelete="SET NULL", name="fk_workout_run_playlist"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "user_preferences",
        sa.Column("user_id", UUID(), nullable=False),
        sa.Column("level", sa.String(), nullable=False),
        sa.Column("target_duration_seconds", sa.Integer(), nullable=True),
        sa.Column("focus", sa.String(), nullable=True),
        sa.Column(
            "target_muscle_groups",
            sa.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column(
            "avoid_muscle_groups",
            sa.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column(
            "equipment_slugs",
            sa.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], ondelete="CASCADE", name="fk_user_preferences_user"
        ),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "workout_feedback",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("uuidv7()")),
        sa.Column("run_id", UUID(), nullable=False),
        sa.Column("user_id", UUID(), nullable=True),
        sa.Column("rpe", sa.SmallInteger(), nullable=True),
        sa.Column("rating", sa.SmallInteger(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "skipped", sa.ARRAY(sa.Text()), nullable=False, server_default=sa.text("'{}'::text[]")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"], ["workout_run.id"], ondelete="CASCADE", name="fk_workout_feedback_run"
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("workout_feedback")
    op.drop_table("user_preferences")
    op.drop_table("workout_run")
    op.drop_table("playlist")
    op.drop_table("user")
    op.drop_table("plan_slot")
    op.drop_table("plan_week")
    op.drop_table("workout_plan")
    op.drop_table("phase_exercise")
    op.drop_table("workout_phase")
    op.drop_table("workout_template")
    op.drop_table("exercise_equipment")
    op.drop_table("exercise_muscle_group")
    op.drop_table("exercise")
    op.drop_table("muscle_group")
    op.drop_table("equipment")
