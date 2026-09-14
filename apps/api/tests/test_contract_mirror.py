"""T-01b — the Pydantic contract mirror (a) is importable under pydantic 2.13 and
(b) round-trips the discriminated-union `Beat` union via the camelCase wire form.

Before the fix `import app.contracts.schema` raised
``PydanticUserError: Model 'PhaseIntroBeat' needs field 'kind' to be of type Literal``
(`Field(discriminator=...)` is not the pydantic v2 API; the fix is
`Discriminator("kind")` + a `Literal` `kind` on every beat choice).
"""

from __future__ import annotations

import pytest

import app.contracts.schema as schema


def test_mirror_imports_under_real_pydantic() -> None:
    # The whole point of T-01b: the module import must not raise.
    assert schema.Beat is not None
    for cls in (
        schema.PhaseIntroBeat,
        schema.PrepBeat,
        schema.WorkBeat,
        schema.RestBeat,
        schema.CoolDownHoldBeat,
    ):
        assert cls is not None


def test_beat_is_a_discriminated_union() -> None:
    # Picking each of the 5 wire `kind` values must resolve to its own subtype.
    for kind, cls in (
        ("phase-intro", schema.PhaseIntroBeat),
        ("prep", schema.PrepBeat),
        ("work", schema.WorkBeat),
        ("rest", schema.RestBeat),
        ("cooldown-hold", schema.CoolDownHoldBeat),
    ):
        beat = schema.WorkoutRun(
            id="r",
            template="hiit-full-body-30",
            started_at_ms=0,
            duration_ms=0,
            status="scheduled",
            source="solo",
            beats=[
                {"kind": kind, "id": "b", "durationMs": 1, "exerciseRef": "x"}
                if kind == "work"
                else {"kind": kind, "id": "b", "durationMs": 1}
            ],
        )
        assert isinstance(beat.beats[0], cls), kind


def test_work_beat_camelCase_wire_roundtrip() -> None:
    beat = schema.WorkBeat(
        id="b1",
        duration_ms=40,
        kind="work",
        exercise_ref="goblet-squat",
        cue="sit back",
        round=1,
    )
    dumped = beat.model_dump(by_alias=True)
    assert dumped["kind"] == "work"
    assert dumped["exerciseRef"] == "goblet-squat"  # camelCase wire key
    assert dumped["durationMs"] == 40
    # Back again by wire keys.
    reparsed = schema.WorkBeat.model_validate(dumped)
    assert reparsed.exercise_ref == "goblet-squat"
    assert reparsed.round == 1
