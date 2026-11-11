"""T-20 — buildTimeline engine tests (I1/I2 + D6 scaling + two-language agreement).

Run with the API venv: ``pytest tests/test_build_timeline.py -q``.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # app/ importable

from app.engine.build_timeline import (  # noqa: E402
    Params,
    build_timeline,
    total_seconds_of,
)

REPO_ROOT = Path(__file__).resolve().parents[3]


def _load(name: str) -> dict:
    return json.loads((REPO_ROOT / "seed" / name).read_text())


def _all_workouts() -> list[dict]:
    out = []
    for f in sorted((REPO_ROOT / "seed" / "workouts").glob("*.json")):
        out.append(json.loads(f.read_text()))
    return out


# ---- I2: every seed workout's rebuilt total == its stored total_seconds ----------------
def test_i2_all_seed_totals():
    for t in _all_workouts():
        assert total_seconds_of(t) == t["total_seconds"], t["slug"]
        assert sum(int(b["durationMs"]) for b in build_timeline(t)) == t["total_seconds"] * 1000


# ---- I1: beats are BUILT (never empty, well-shaped, in phase order) --------------------
def test_i1_beats_nonempty_and_shaped():
    for t in _all_workouts():
        beats = build_timeline(t)
        assert beats, t["slug"]
        for b in beats:
            assert b["durationMs"] > 0
            assert b["kind"] in {"phase-intro", "prep", "work", "rest", "cooldown-hold"}
            assert b["id"]
            if b["kind"] == "work":
                assert "exerciseRef" in b and b["round"] >= 1


def test_beats_start_with_phase_intro():
    t = _load("workouts/hiit-full-body-30.json")
    beats = build_timeline(t)
    assert beats[0]["kind"] == "phase-intro"
    first_work = next(b for b in beats if b["kind"] == "work")
    assert first_work["round"] == 1


# ---- D6 scaling knobs -----------------------------------------------------------------
def test_defaults_are_identity():
    t = _load("workouts/hiit-lower-30.json")
    base = total_seconds_of(t)
    assert total_seconds_of(t, {}) == base
    assert total_seconds_of(t, {"work_scale": 1.0, "rest_scale": 1.0, "rounds_mult": 1.0}) == base


def test_work_scale_shrinks_grows_total():
    t = _load("workouts/hiit-lower-30.json")
    base = total_seconds_of(t)
    assert total_seconds_of(t, {"work_scale": 0.5}) < base
    assert total_seconds_of(t, {"work_scale": 2.0}) > base


def test_rest_scale_affects_total():
    t = _load("workouts/hiit-lower-30.json")
    base = total_seconds_of(t)
    assert total_seconds_of(t, {"rest_scale": 0.0}) < base
    assert total_seconds_of(t, {"rest_scale": 2.0}) > base


def _synthetic_multiround() -> dict:
    """A minimal 3-round template so `rounds_mult` can be exercised.

    The seed flows are single-pass (every phase rounds=1, so each exercise runs once); with
    rounds=1 the `rounds_mult=0.0` floor can never shrink the total below one round. To test the
    scaling knob in isolation we use a dedicated multi-round template rather than coupling the
    engine test to the seed's (deliberately) single-pass shape.
    """
    return {
        "slug": "synthetic-3round",
        "structure": "freeform",
        "structure_version": 1,
        "total_seconds": 0,  # unused: total_seconds_of recomputes from the template
        "phases": [
            {
                "position": 0,
                "phase_type": "warmup",
                "rounds": 3,
                "rest_seconds": 20,
                "prep_seconds": 5,
                "transition_seconds": 5,
                "items": [
                    {"position": 0, "exercise": "push-up", "work_seconds": 30, "rest_seconds": 10},
                    {"position": 1, "exercise": "plank", "work_seconds": 30, "rest_seconds": 10},
                ],
            }
        ],
    }


def test_rounds_mult_multiplies_but_never_zero():
    t = _synthetic_multiround()
    base = total_seconds_of(t)
    assert total_seconds_of(t, {"rounds_mult": 2.0}) > base
    min_total = total_seconds_of(t, {"rounds_mult": 0.0})
    assert 0 < min_total < base
    assert len(build_timeline(t, {"rounds_mult": 0.0})) > 0


def test_camel_and_snake_params_accepted():
    t = _load("workouts/hiit-lower-30.json")
    assert total_seconds_of(t, {"work_scale": 0.5}) == total_seconds_of(t, {"workScale": 0.5})
    p = Params.from_mapping({"workScale": 0.5, "roundsMult": 2.0})
    assert p.work_scale == 0.5 and p.rounds_mult == 2.0


def test_rpe_focus_is_advisory_only():
    t = _load("workouts/hiit-lower-30.json")
    base = total_seconds_of(t)
    assert total_seconds_of(t, {"target_rpe_focus": 8}) == base
    assert total_seconds_of(t, {"targetRpeFocus": 9}) == base


# ---- two-language agreement with the Node half --------------------------------------
def test_py_node_agree_on_total():
    py = {t["slug"]: total_seconds_of(t) for t in _all_workouts()}
    timeline = str(REPO_ROOT / "scripts" / "build-timeline.cjs")
    probe = (
        "const m=require(process.argv[1]);const fs=require('fs');"
        "for(const f of fs.readdirSync(process.argv[2]).filter(x=>x.endsWith('.json'))){const t=JSON.parse(fs.readFileSync(process.argv[2]+'/'+f));console.log(t.slug+'\\t'+m.totalSecondsOf(t));}"
    )  # noqa: E501
    out = subprocess.check_output(
        ["node", "-e", probe, timeline, str(REPO_ROOT / "seed" / "workouts")]
    ).decode()
    node = {}
    for line in out.strip().splitlines():
        slug, secs = line.split("\t")
        node[slug] = int(secs)
    assert py == node, f"Py/Node disagreement: {py} vs {node}"


# ---- I5: each exercise appears at most once per workout (single-pass flow) ------------
def test_i5_no_repeated_exercise_per_workout():
    for t in _all_workouts():
        seen: dict[str, int] = {}
        for ph in t["phases"]:
            for it in ph["items"]:
                slug = it["exercise"]
                seen[slug] = seen.get(slug, 0) + 1
        dups = {s: n for s, n in seen.items() if n > 1}
        assert not dups, f"{t['slug']} repeats an exercise: {dups}"


# ---- inter-exercise rest: per-item rest_seconds emits a rest beat between work beats --
def test_inter_exercise_rest_emitted_single_pass():
    t = _load("workouts/hiit-upper-30.json")
    beats = build_timeline(t)
    rest_beats = [b for b in beats if b["kind"] == "rest"]
    # Inter-exercise rest beats carry id "p{pos}-r{r}-e{n}-rest" (per-item rest_seconds).
    inter = [b for b in rest_beats if re.search(r"-e\d+-rest$", b["id"])]
    assert inter, "expected inter-exercise rest beats (per-item rest_seconds)"
    # Upper flow: main (4×30s) + accessory (4×30s) + abs_cardio (4×15s) = 12 inter-exercise rests.
    assert len(inter) == 12

    # rest_scale scales inter-exercise rest (NOT inter-phase transitions, by design).
    def _inter(tpl: dict, params: dict) -> int:
        return sum(
            b["durationMs"]
            for b in build_timeline(tpl, params)
            if b["kind"] == "rest" and re.search(r"-e\d+-rest$", b["id"])
        )

    inter_base = _inter(t, {})
    assert _inter(t, {"rest_scale": 2.0}) == inter_base * 2
    assert _inter(t, {"rest_scale": 0.0}) == 0


def test_single_pass_phases_have_no_inter_round_rest():
    # Every seed phase is rounds=1, so the inter-round rest branch must not fire: there is no
    # "p{pos}-r{r}-rest" beat (rest is only inter-exercise or an inter-phase transition).
    t = _load("workouts/hiit-full-body-30.json")
    assert all(ph["rounds"] == 1 for ph in t["phases"])
    beats = build_timeline(t)
    for b in beats:
        if b["kind"] == "rest":
            assert b["id"].endswith("-trans") or re.search(r"-e\d+-rest$", b["id"]), (
                f"unexpected inter-round rest beat: {b['id']}"
            )
