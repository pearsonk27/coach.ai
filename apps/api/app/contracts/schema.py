"""Pydantic v2 mirror of the @coach/shared-types Zod contract.

Mirrors ``packages/shared-types/src/{catalog,timeline}.z.ts``. Field *names* are snake_case
(the Python idiom); a ``to_camel`` alias generator makes ``model_dump(by_alias=True)`` emit the
SAME camelCase wire keys the Zod schemas use (D1 device/client wire form). Enum VALUES are the
literal strings shared with the Zod enum (``main_circuit``, ``run_start`` ...) -- alias
generators rename *fields*, not *values*. The per-language field manifest
``contract.fields.json`` records these for the drift guard.

``zod``/``pydantic`` are not yet installed in this tree (a STOP-D addendum; see T-01 handoff),
so this module is validated now by ``python3 -m py_compile`` (syntax) and is introspection
checked by the Pydantic layer of the drift guard once the runtime lands (T-10).
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, List, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Discriminator, Field
from pydantic.alias_generators import to_camel


# --------------------------------------------------------------------------
# Enum values (shared literally with the Zod + snapshot enums).
# --------------------------------------------------------------------------
class PhaseType(str, Enum):
    WARMUP = "warmup"
    MAIN_CIRCUIT = "main_circuit"
    ACCESSORY_CIRCUIT = "accessory_circuit"
    ABS_CARDIO = "abs_cardio"
    STATIC_STRETCH = "static_stretch"
    MOBILITY = "mobility"


class Emphasis(str, Enum):
    UPPER = "upper"
    LOWER = "lower"
    FULLBODY = "fullbody"
    RECOVERY = "recovery"


class MusicProvider(str, Enum):
    USER = "user"
    SOUND = "soundcloud"


class StartOn(str, Enum):
    RUN_START = "run_start"
    ON_JOIN = "on_join"


class RunStatus(str, Enum):
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ABORTED = "aborted"


class RunSource(str, Enum):
    SOLO = "solo"
    ROOM = "room"


class PlanSlotKind(str, Enum):
    ACTIVE = "active"
    STRETCH = "stretch"
    HINIT = "hiit"
    REST = "rest"


class StructureTag(str, Enum):
    FIXED_HIIT = "fixed-hiit"
    FREEFORM = "freeform"


# --------------------------------------------------------------------------
# Base: shared camelCase-alias config for every model.
# --------------------------------------------------------------------------
class Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


# --------------------------------------------------------------------------
# Beat union (design D3/D10). `work` is the only beat that carries an exerciseRef.
# --------------------------------------------------------------------------
class _BeatBase(Base):
    id: str
    duration_ms: int  # alias: durationMs


class PhaseIntroBeat(_BeatBase):
    kind: Literal["phase-intro"] = "phase-intro"


class PrepBeat(_BeatBase):
    kind: Literal["prep"] = "prep"


class WorkBeat(_BeatBase):
    kind: Literal["work"] = "work"
    exercise_ref: str  # alias: exerciseRef (catalogue exercise slug)
    cue: Optional[str] = None
    round: Optional[int] = (
        None  # JSON key "round" (to_camel identity; shadows builtin int round, intentional)
    )


class RestBeat(_BeatBase):
    kind: Literal["rest"] = "rest"


class CoolDownHoldBeat(_BeatBase):
    kind: Literal["cooldown-hold"] = "cooldown-hold"


Beat = Annotated[
    Union[PhaseIntroBeat, PrepBeat, WorkBeat, RestBeat, CoolDownHoldBeat],
    Discriminator("kind"),
]


# --------------------------------------------------------------------------
# Music + plan periodization knobs (design D6/D7/D8).
# --------------------------------------------------------------------------
class MusicRef(Base):
    provider: MusicProvider
    playlist_ref: Optional[str] = None  # alias: playlistRef
    volume: Optional[float] = None
    start_on: Optional[StartOn] = None  # alias: startOn


class PlanSlotParams(Base):
    work_scale: Optional[float] = None  # alias: workScale
    rest_scale: Optional[float] = None  # alias: restScale
    rounds_mult: Optional[float] = None  # alias: roundsMult
    target_rpe_focus: Optional[int] = None  # alias: targetRpeFocus; 1..10 RPE


class PlanSlot(Base):
    slot: int
    kind: PlanSlotKind
    label: Optional[str] = None
    template_slug: Optional[str] = (
        None  # alias: template_slug; null when kind == "rest" (design D6 CHECK)
    )
    params: Optional[PlanSlotParams] = None


# --------------------------------------------------------------------------
# Catalog (design section 4 + seed/catalog.json).
# --------------------------------------------------------------------------
class Equipment(Base):
    slug: str
    name: str
    icon_name: Optional[str] = None  # alias: icon_name
    is_builtin: Optional[bool] = True  # alias: is_builtin


class MuscleGroup(Base):
    slug: str
    name: str
    region: str


class Exercise(Base):
    slug: str
    name: str
    description: Optional[str] = None
    cues: List[str] = Field(default_factory=list)
    difficulty: Optional[int] = None
    intensity: Optional[int] = None
    muscle_groups: Optional[List[str]] = None  # alias: muscle_groups
    equipment: Optional[List[str]] = None
    gif_url: Optional[str] = None  # alias: gif_url (F-01)


# --------------------------------------------------------------------------
# Composition + the deterministic run (design D1/D2/D6).
# --------------------------------------------------------------------------
class PhaseExercise(Base):
    position: int
    exercise: str  # catalogue exercise slug (PhaseExercise keys it `exercise`;
    # the runtime Beat keys the same slug `exerciseRef` -- see snapshot key map)
    work_seconds: int  # alias: workSeconds
    cue: Optional[str] = None  # design alias: cue_override


class WorkoutPhase(Base):
    position: int
    phase_type: PhaseType  # alias: phaseType
    title: str
    description: Optional[str] = None
    rounds: int = 1
    rest_seconds: int = 0  # alias: restSeconds
    prep_seconds: int = 10  # alias: prepSeconds
    transition_seconds: int = 10  # alias: transitionSeconds
    items: List[PhaseExercise] = Field(default_factory=list)


class WorkoutTemplate(Base):
    slug: str
    name: str
    description: Optional[str] = None
    goal: Optional[str] = None
    structure: StructureTag
    structure_version: int = 1  # alias: structureVersion
    total_seconds: int  # alias: totalSeconds
    emphasis: Optional[Emphasis] = None
    # Advisory domain metadata (consumed by picker/recommendations, not buildTimeline).
    equipment_required: List[str] = Field(default_factory=list)
    target_muscle_groups: List[str] = Field(default_factory=list)
    music: Optional[MusicRef] = None
    source: Optional[str] = None
    phases: List[WorkoutPhase] = Field(default_factory=list)


class WorkoutRun(Base):
    # The AI-loop substrate (D1): a materialised, deterministic run.
    id: str
    template: str  # template slug (content-as-data; API/DB form is `template_id`, T-10)
    started_at_ms: int  # alias: startedAtMs
    ended_at_ms: Optional[int] = None  # alias: endedAtMs
    duration_ms: int  # alias: durationMs
    status: RunStatus
    source: RunSource
    beats: List[Beat] = Field(default_factory=list)
