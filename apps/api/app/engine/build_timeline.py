"""Pure, deterministic ``buildTimeline`` -- the I1/I2 engine (design D1/D2/D6).

A ``WorkoutRun`` is a PRECOMPUTED, DETERMINISTIC ``beats[]`` + one ``started_at_ms`` (D1):
every device derives its state from ``elapsed = now - started_at_ms``. That beats array is the
OUTPUT of this function (I1) -- it is NEVER hand-authored at run time. I2: the sum of the
materialised beat durations (in seconds) equals ``template.total_seconds`` for the un-scaled
template (``params == {}``).

This is pure: no I/O, no clock, no randomness. It is the Python (API) half of a deliberate
two-language mirror -- the Node half lives in ``scripts/build-timeline.cjs`` (used by the I1/I2
invariant over ``seed/**``). Both consume the SAME oracle (the seed's stored ``total_seconds``),
so they cannot silently disagree on a total: a Python test recomputes every seed total, and the
invariant check does the same in Node.

Scaling (D6, ``plan_slot.params``): ``work_scale`` / ``rest_scale`` / ``rounds_mult`` (all
default 1). ``target_rpe_focus`` is advisory only -- it never changes the geometry. With every
default the rebuilt total equals the stored total, so I2 holds on the seed.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional


# Seconds -> milliseconds (beats carry durationMs, the D1 wire form).
_MS = 1000


@dataclass(frozen=True)
class Params:
    """Per-slot periodization knobs (design D6). All defaults keep the geometry == stored."""

    work_scale: float = 1.0
    rest_scale: float = 1.0
    rounds_mult: float = 1.0
    target_rpe_focus: Optional[int] = None

    @classmethod
    def from_mapping(cls, data: Optional[Mapping]) -> "Params":
        data = data or {}
        return cls(
            work_scale=float(data.get("work_scale", data.get("workScale", 1.0))),
            rest_scale=float(data.get("rest_scale", data.get("restScale", 1.0))),
            rounds_mult=float(data.get("rounds_mult", data.get("roundsMult", 1.0))),
            target_rpe_focus=data.get("target_rpe_focus", data.get("targetRpeFocus")),
        )


def _scale_floor(value: int, scale: float) -> int:
    """Scale a second count and SNAP to a whole second (>=0), stable across languages.

    Uses ``round()`` (banker's-safe for the integer scales the seed uses: 1.0) so the Python
    and Node halves agree bit-for-bit on the geometry.
    """
    return max(0, int(round(value * scale)))


def _scale_rounds(rounds: int, rounds_mult: float) -> int:
    """Round-scale the round COUNT, but NEVER below 1 (a phase always runs at least once)."""
    return max(1, int(round(rounds * rounds_mult)))


def _work_seconds(item: Mapping) -> int:
    if "work_seconds" in item:
        return int(item["work_seconds"])
    return int(item.get("workSeconds", 0))


def _cue_for(item: Mapping, catalog: Optional[Mapping]) -> Optional[str]:
    """A beat's spoken cue: the per-item override wins, else the catalogue's first cue."""
    override = item.get("cue_override") or item.get("cue")
    if override:
        return str(override)
    if catalog is not None:
        ex = catalog.get(str(item["exercise"]))
        cues = ex.get("cues") if ex else None
        if cues:
            return str(cues[0])
    return None


def _beats_for_phase(
    phase: Mapping,
    catalog: Optional[Mapping],
    params: Params,
) -> List[Dict[str, Any]]:
    """Expand one phase into its ordered beats.

    Emitted per phase (order):
    1. a single ``phase-intro`` hold for the prep/get-set ``prep_seconds`` (skipped when 0).
    2. for each round (1..rounds), each item in position order becomes a ``work`` beat, then a
       ``rest`` between the last round (``(rounds-1) * rest_seconds`` inter-round rest).
    3. one inter-phase ``rest`` equal to ``transition_seconds`` (the wind-into-the-next phase; a
       trailing tail for the final phase -- the run's natural end / music wind-down).

    This expansion is EXACTLY the arithmetic behind the stored total (see :func:`_phase_total`).
    """
    beats: List[Dict[str, Any]] = []
    pos = int(phase["position"])
    prep_seconds = int(phase.get("prep_seconds", phase.get("prepSeconds", 10)))
    rest_seconds = int(phase.get("rest_seconds", phase.get("restSeconds", 0)))
    transition_seconds = int(phase.get("transition_seconds", phase.get("transitionSeconds", 10)))
    rounds = _scale_rounds(int(phase.get("rounds", 1)), params.rounds_mult)

    # (1) prep / get-set position.
    prep_ms = _scale_floor(prep_seconds, 1.0) * _MS    # prep is not scaled by D6 knobs
    if prep_ms:
        beats.append({"id": f"p{pos}-intro", "kind": "phase-intro", "durationMs": prep_ms})

    items = sorted(phase.get("items", []), key=lambda it: int(it["position"]))
    rest_ms = _scale_floor(rest_seconds, params.rest_scale) * _MS

    # (2) rounds x items -> work beats, with inter-round rest.
    for r in range(1, rounds + 1):
        for item in items:
            work_ms = _scale_floor(_work_seconds(item), params.work_scale) * _MS
            beat = {
                "id": f"p{pos}-r{r}-e{int(item['position'])}",
                "kind": "work",
                "durationMs": work_ms,
                "exerciseRef": item["exercise"],
                "round": r,
            }
            cue = _cue_for(item, catalog)
            if cue:
                beat["cue"] = cue
            beats.append(beat)
        if r < rounds and rest_ms:
            beats.append({"id": f"p{pos}-r{r}-rest", "kind": "rest", "durationMs": rest_ms})

    # (3) inter-phase transition (a trailing tail for the final phase).
    if transition_seconds:
        beats.append(
            {"id": f"p{pos}-trans", "kind": "rest", "durationMs": transition_seconds * _MS}
        )
    return beats


def _phase_total(phase: Mapping, params: Params) -> int:
    """The closed-form seconds this phase contributes (what I2 checks against).

    Composed EXACTLY as the beater emits it (:func:`_beats_for_phase`), so
    ``sum(beats.durationMs)/1000 == total_seconds_of`` follows by construction:
    ``prep + rounds*work + (rounds-1)*rest + transition``.
    """
    prep = int(phase.get("prep_seconds", phase.get("prepSeconds", 10)))
    rest = int(phase.get("rest_seconds", phase.get("restSeconds", 0)))
    transition = int(phase.get("transition_seconds", phase.get("transitionSeconds", 10)))
    rounds = _scale_rounds(int(phase.get("rounds", 1)), params.rounds_mult)
    work = sum(_work_seconds(it) for it in phase.get("items", []))
    total = prep
    total += rounds * _scale_floor(work, params.work_scale)
    total += (rounds - 1) * _scale_floor(rest, params.rest_scale)
    total += transition
    return total


def build_timeline(
    template: Mapping,
    params: Optional[Mapping] = None,
    catalog: Optional[Mapping] = None,
) -> List[Dict[str, Any]]:
    """buildTimeline(template[, params, catalog]) -> Beat[].

    * ``template``: a ``WorkoutTemplate``-shaped mapping (the seed JSON, or a Pydantic mirror).
    * ``params``: optional D6 knobs (``{}`` == the stored geometry).
    * ``catalog``: optional ``{exercise_slug: {...}}`` used only to fill a work beat's default
      cue when the phase item carries no ``cue_override``.
    """
    p = Params.from_mapping(params)
    phases = sorted(template.get("phases", []), key=lambda ph: int(ph["position"]))
    beats: List[Dict[str, Any]] = []
    for phase in phases:
        beats.extend(_beats_for_phase(phase, catalog, p))
    return beats


def total_seconds_of(template: Mapping, params: Optional[Mapping] = None) -> int:
    """sum(beats.durationMs)/1000 -- the I2 left-hand side (rebuilt total)."""
    beats = build_timeline(template, params)
    return sum(int(b["durationMs"]) for b in beats) // _MS


def total_ms_of(template: Mapping, params: Optional[Mapping] = None) -> int:
    """Exact millisecond total the beat array sums to (I2 right-hand side, un-rounded)."""
    beats = build_timeline(template, params)
    return sum(int(b["durationMs"]) for b in beats)


# ---------------------------------------------------------------------------
# Seed-oracle helpers (used by I1/I2 + tests).
# ---------------------------------------------------------------------------
def _load_seed_workouts(root: Path) -> List[Mapping]:
    out: List[Mapping] = []
    for f in sorted((root / "seed" / "workouts").glob("*.json")):
        out.append(json.loads(f.read_text()))
    return out


def i1_i2_check(root: Path, *, verbose: bool = True) -> bool:
    """Recompute every seed workout's total from buildTimeline and compare to its stored
    ``total_seconds`` (I2). Also asserts beats are non-empty (I1 -- always built, never authored)."""
    ok = True
    catalog: Optional[Mapping] = None
    cat_path = root / "seed" / "catalog.json"
    if cat_path.exists():
        catalog = json.loads(cat_path.read_text())
    for tmpl in _load_seed_workouts(root):
        rebuilt = total_seconds_of(tmpl)
        stored = int(tmpl["total_seconds"])
        beats = build_timeline(tmpl, catalog=catalog)
        nonempty = len(beats) > 0
        good = rebuilt == stored and nonempty
        ok = ok and good
        status = "OK" if good else "FAIL"
        if verbose:
            print(
                f"I1/I2 {status}: {tmpl['slug']} rebuilt={rebuilt}s "
                f"stored={stored}s beats={len(beats)}"
            )
        if not good and verbose:
            print(f"   rebuilt total {rebuilt} != stored {stored}")
    return ok


if __name__ == "__main__":
    import sys

    sys.exit(0 if i1_i2_check(Path(__file__).resolve().parents[3]) else 1)
