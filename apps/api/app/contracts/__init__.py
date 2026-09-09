"""Cross-language contract mirror (Pydantic v2) for @coach/shared-types.

T-01: this is the API half of the I3 anti-drift contract. The canonical Zod schema lives in
``packages/shared-types/src/*.z.ts`` and a language-neutral snapshot in
``packages/shared-types/contract.snapshot.json``. The per-language field manifest is
``contract.fields.json`` beside this module. The drift guard (``scripts/contract-drift.cjs`` via
``just check-contract``) asserts this model's ``by_alias`` field set equals the snapshot equals
the TS manifest, so the two languages cannot diverge.
"""
from .schema import (
    Beat,
    CoolDownHoldBeat,
    Equipment,
    Exercise,
    MusicRef,
    MuscleGroup,
    PrepBeat,
    PhaseExercise,
    PhaseIntroBeat,
    PlanSlot,
    PlanSlotParams,
    RestBeat,
    WorkBeat,
    WorkoutPhase,
    WorkoutRun,
    WorkoutTemplate,
)

__all__ = [
    "Beat",
    "CoolDownHoldBeat",
    "Equipment",
    "Exercise",
    "MusicRef",
    "MuscleGroup",
    "PrepBeat",
    "PhaseExercise",
    "PhaseIntroBeat",
    "PlanSlot",
    "PlanSlotParams",
    "RestBeat",
    "WorkBeat",
    "WorkoutPhase",
    "WorkoutRun",
    "WorkoutTemplate",
]
