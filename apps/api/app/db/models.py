"""SQLAlchemy models for the coach.ai Postgres schema (design section 4).

Single source of truth for the schema -- the Alembic ``0001_initial`` migration materializes
exactly ``Base.metadata`` so the two cannot drift. The 15 core tables land here; the future
F-06/F-07/F-08 tables (``health_metric``, ``wearable``, ``workout_evaluation`` /
``user_soundcloud_*``) are intentionally absent (added by their own tasks).

Conventions (from section 4):
- UUID primary keys default to ``uuidv7()`` (Postgres 18+ core function; time-ordered, low index fragmentation).
- JSONB columns: exercise.cues, workout_template.music, workout_plan.cadence,
      plan_slot.params, workout_run.beats / workout_run.music.
- TEXT[] arrays: user_preferences.{target,avoid_muscle_groups,equipment_slugs},
      workout_feedback.skipped.
- ``structure`` / ``phase_type`` / ``kind`` are plain TEXT (structure is a *tag*, D5/I7 -- not a
   DB constraint), so the shape evolves via ``structure_version`` without a migration.
"""

from __future__ import annotations

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base

Base = declarative_base()

# The 15 core tables T-10 owns (re-exported for the DB-free shape / DDL tests).
EXPECTED_TABLES = [
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
]

AUTO = {"sqlite_autoincrement": False}


def _uuid_pk() -> Column:
    return Column("id", Uuid(), primary_key=True, server_default=text("uuidv7()"))


# ---------------------------------------------------------------------------
# catalog
# ---------------------------------------------------------------------------
class Equipment(Base):
    __tablename__ = "equipment"
    id = _uuid_pk()
    slug = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    icon_name = Column(String, nullable=True)
    is_builtin = Column(Boolean, nullable=False, server_default=text("true"))


class MuscleGroup(Base):
    __tablename__ = "muscle_group"
    id = _uuid_pk()
    slug = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    region = Column(String, nullable=False)


class Exercise(Base):
    __tablename__ = "exercise"
    __table_args__ = AUTO
    id = _uuid_pk()
    slug = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    cues = Column(JSONB, nullable=False, server_default=text("'[]'"))
    difficulty = Column(SmallInteger, nullable=False, server_default=text("1"))
    intensity = Column(SmallInteger, nullable=False, server_default=text("4"))
    gif_url = Column(String, nullable=True)
    is_archived = Column(Boolean, nullable=False, server_default=text("false"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class ExerciseMuscleGroup(Base):
    __tablename__ = "exercise_muscle_group"
    __table_args__ = (
        ForeignKeyConstraint(
            ["exercise_id"], ["exercise.id"], ondelete="CASCADE", name="fk_eeg_exercise"
        ),
        ForeignKeyConstraint(
            ["muscle_group_id"], ["muscle_group.id"], ondelete="CASCADE", name="fk_eeg_muscle_group"
        ),
        PrimaryKeyConstraint("exercise_id", "muscle_group_id"),
        AUTO,
    )
    exercise_id = Column(Uuid(), nullable=False)
    muscle_group_id = Column(Uuid(), nullable=False)
    is_primary = Column(Boolean, nullable=False, server_default=text("false"))


class ExerciseEquipment(Base):
    __tablename__ = "exercise_equipment"
    __table_args__ = (
        ForeignKeyConstraint(
            ["exercise_id"], ["exercise.id"], ondelete="CASCADE", name="fk_eeq_exercise"
        ),
        ForeignKeyConstraint(
            ["equipment_id"], ["equipment.id"], ondelete="CASCADE", name="fk_eeq_equipment"
        ),
        PrimaryKeyConstraint("exercise_id", "equipment_id"),
        AUTO,
    )
    exercise_id = Column(Uuid(), nullable=False)
    equipment_id = Column(Uuid(), nullable=False)


# ---------------------------------------------------------------------------
# composition
# ---------------------------------------------------------------------------
class WorkoutTemplate(Base):
    __tablename__ = "workout_template"
    __table_args__ = AUTO
    id = _uuid_pk()
    slug = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    goal = Column(String, nullable=True)
    structure = Column(String, nullable=False, server_default=text("'fixed-hiit'"))
    emphasis = Column(String, nullable=True)
    total_seconds = Column(Integer, nullable=False)
    structure_version = Column(Integer, nullable=False, server_default=text("1"))
    music = Column(JSONB, nullable=True)
    enabled = Column(Boolean, nullable=False, server_default=text("true"))
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class WorkoutPhase(Base):
    __tablename__ = "workout_phase"
    __table_args__ = (
        CheckConstraint(
            "rounds >= 1 AND rest_seconds >= 0 AND prep_seconds >= 0",
            name="ck_workout_phase_positive",
        ),
        UniqueConstraint("template_id", "position", name="uq_workout_phase_template_position"),
        ForeignKeyConstraint(
            ["template_id"],
            ["workout_template.id"],
            ondelete="CASCADE",
            name="fk_workout_phase_template",
        ),
        AUTO,
    )
    id = _uuid_pk()
    template_id = Column(Uuid(), nullable=False)
    position = Column(Integer, nullable=False)
    phase_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    rounds = Column(Integer, nullable=False, server_default=text("1"))
    rest_seconds = Column(Integer, nullable=False, server_default=text("0"))
    prep_seconds = Column(Integer, nullable=False, server_default=text("10"))
    transition_seconds = Column(Integer, nullable=False, server_default=text("10"))


class PhaseExercise(Base):
    __tablename__ = "phase_exercise"
    __table_args__ = (
        CheckConstraint("work_seconds > 0", name="ck_phase_exercise_work_positive"),
        UniqueConstraint("phase_id", "position", name="uq_phase_exercise_phase_position"),
        ForeignKeyConstraint(
            ["phase_id"], ["workout_phase.id"], ondelete="CASCADE", name="fk_phase_exercise_phase"
        ),
        ForeignKeyConstraint(
            ["exercise_id"], ["exercise.id"], ondelete="RESTRICT", name="fk_phase_exercise_exercise"
        ),
        AUTO,
    )
    id = _uuid_pk()
    phase_id = Column(Uuid(), nullable=False)
    position = Column(Integer, nullable=False)
    exercise_id = Column(Uuid(), nullable=False)
    work_seconds = Column(Integer, nullable=False)
    cue_override = Column(String, nullable=True)


# ---------------------------------------------------------------------------
# regiment (periodization, D6)
# ---------------------------------------------------------------------------
class WorkoutPlan(Base):
    __tablename__ = "workout_plan"
    __table_args__ = AUTO
    id = _uuid_pk()
    slug = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    cadence = Column(JSONB, nullable=True)
    cycle_weeks = Column(Integer, nullable=False, server_default=text("1"))
    enabled = Column(Boolean, nullable=False, server_default=text("true"))
    source = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class PlanWeek(Base):
    __tablename__ = "plan_week"
    __table_args__ = (
        UniqueConstraint("plan_id", "week_index", name="uq_plan_week_plan_week"),
        ForeignKeyConstraint(
            ["plan_id"], ["workout_plan.id"], ondelete="CASCADE", name="fk_plan_week_plan"
        ),
        AUTO,
    )
    id = _uuid_pk()
    plan_id = Column(Uuid(), nullable=False)
    week_index = Column(Integer, nullable=False)
    theme = Column(String, nullable=True)
    description = Column(Text, nullable=True)


class PlanSlot(Base):
    __tablename__ = "plan_slot"
    __table_args__ = (
        CheckConstraint(
            "(kind = 'rest' AND template_slug IS NULL) "
            "OR (kind <> 'rest' AND template_slug IS NOT NULL)",
            name="ck_plan_slot_kind_template",
        ),
        ForeignKeyConstraint(
            ["week_id"], ["plan_week.id"], ondelete="CASCADE", name="fk_plan_slot_week"
        ),
        AUTO,
    )
    id = _uuid_pk()
    week_id = Column(Uuid(), nullable=False)
    slot = Column(Integer, nullable=False)
    kind = Column(String, nullable=False)
    label = Column(String, nullable=True)
    template_slug = Column(String, nullable=True)
    params = Column(JSONB, nullable=False, server_default=text("'{}'"))


# ---------------------------------------------------------------------------
# account + playlist (MVP-light, D9 one-to-one)
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "user"
    __table_args__ = (UniqueConstraint("email", name="uq_user_email"), AUTO)
    id = _uuid_pk()
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=True)
    soundcloud_handle = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class Playlist(Base):
    __tablename__ = "playlist"
    __table_args__ = (
        CheckConstraint("volume BETWEEN 0 AND 1", name="ck_playlist_volume"),
        ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE", name="fk_playlist_user"),
        AUTO,
    )
    id = _uuid_pk()
    user_id = Column(Uuid(), nullable=False, unique=True)
    name = Column(String, nullable=False)
    provider = Column(String, nullable=False, server_default=text("'soundcloud'"))
    playlist_ref = Column(String, nullable=False)
    volume = Column(Numeric(), nullable=False, server_default=text("0.3"))
    start_on = Column(String, nullable=False, server_default=text("'run_start'"))
    is_default = Column(Boolean, nullable=False, server_default=text("true"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


# ---------------------------------------------------------------------------
# runs + feedback (the AI-loop substrate, D1/D2)
# ---------------------------------------------------------------------------
class WorkoutRun(Base):
    __tablename__ = "workout_run"
    __table_args__ = (
        ForeignKeyConstraint(
            ["template_id"],
            ["workout_template.id"],
            ondelete="CASCADE",
            name="fk_workout_run_template",
        ),
        ForeignKeyConstraint(
            ["owner_user_id"], ["user.id"], ondelete="SET NULL", name="fk_workout_run_owner"
        ),
        ForeignKeyConstraint(
            ["playlist_id"], ["playlist.id"], ondelete="SET NULL", name="fk_workout_run_playlist"
        ),
        AUTO,
    )
    id = _uuid_pk()
    template_id = Column(Uuid(), nullable=False)
    plan_slot_id = Column(Uuid(), nullable=True)
    owner_user_id = Column(Uuid(), nullable=True)
    playlist_id = Column(Uuid(), nullable=True)
    status = Column(String, nullable=False, server_default=text("'scheduled'"))
    source = Column(String, nullable=False, server_default=text("'solo'"))
    started_at_ms = Column(BigInteger, nullable=True)
    ended_at_ms = Column(BigInteger, nullable=True)
    duration_ms = Column(BigInteger, nullable=False)
    beats = Column(JSONB, nullable=False)
    music = Column(JSONB, nullable=True)


class UserPreferences(Base):
    # 1:1 with user: user_id IS the primary key (section 4 shows no other key).
    __tablename__ = "user_preferences"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id"], ["user.id"], ondelete="CASCADE", name="fk_user_preferences_user"
        ),
        AUTO,
    )
    user_id = Column(Uuid(), primary_key=True)
    level = Column(String, nullable=False)
    target_duration_seconds = Column(Integer, nullable=True)
    focus = Column(String, nullable=True)
    target_muscle_groups = Column(ARRAY(Text), nullable=False, server_default=text("'{}'::text[]"))
    avoid_muscle_groups = Column(ARRAY(Text), nullable=False, server_default=text("'{}'::text[]"))
    equipment_slugs = Column(ARRAY(Text), nullable=False, server_default=text("'{}'::text[]"))
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class WorkoutFeedback(Base):
    __tablename__ = "workout_feedback"
    __table_args__ = (
        ForeignKeyConstraint(
            ["run_id"], ["workout_run.id"], ondelete="CASCADE", name="fk_workout_feedback_run"
        ),
        AUTO,
    )
    id = _uuid_pk()
    run_id = Column(Uuid(), nullable=False)
    user_id = Column(Uuid(), nullable=True)
    rpe = Column(SmallInteger, nullable=True)
    rating = Column(SmallInteger, nullable=True)
    notes = Column(Text, nullable=True)
    completed = Column(Boolean, nullable=False, server_default=text("false"))
    skipped = Column(ARRAY(Text), nullable=False, server_default=text("'{}'::text[]"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
