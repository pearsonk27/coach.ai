"""T-30 -- content API: browse workouts, exercise catalog, plans; materialise a run.

T-51 adds `GET /plans/{slug}/session?date=` -- "today's session" for a flat 3+1 plan, resolved by
calendar date. The rotation matches the client `packages/ui/session-today.ts` (Monday=0..Sunday=6,
`slotIndex = dayOfWeek mod slotCount`), so web and API agree on which slot plays when.
"""

import datetime as _dt
from pathlib import Path

import json
from fastapi import APIRouter, HTTPException, Query

from app.api import runs as runs_mod
from app.engine.build_timeline import build_timeline
from app.seed import default_seed_root, load_plans, load_workouts

router = APIRouter(prefix="/api/content", tags=["content"])


def _root() -> Path:
    return default_seed_root()


def _cat_raw() -> dict:
    return json.loads((_root() / "seed" / "catalog.json").read_text())


def _catalog_index() -> dict:
    return {ex["slug"]: ex for ex in _cat_raw().get("exercises", [])}


def _workout_summaries() -> list[dict]:
    cat = _catalog_index()
    out = []
    for t in load_workouts(_root()):
        beats = build_timeline(t, catalog=cat)
        summary = {
            "slug": t["slug"],
            "name": t["name"],
            "goal": t.get("goal"),
            "structure": t.get("structure", "fixed-hiit"),
            "emphasis": t.get("emphasis"),
            "total_seconds": t["total_seconds"],
            "equipment_required": t.get("equipment_required", []),
            "target_muscle_groups": t.get("target_muscle_groups", []),
            "beats": len(beats),
        }
        out.append(summary)
    return out


@router.get("/catalog")
def get_catalog() -> dict:
    return _cat_raw()


@router.get("/workouts")
def list_workouts_endpoint() -> list[dict]:
    return _workout_summaries()


def _find_template(slug: str) -> dict:
    tmpl = next((t for t in load_workouts(_root()) if t.get("slug") == slug), None)
    if tmpl is None:
        raise HTTPException(status_code=404, detail=f"unknown workout '{slug}'")
    return tmpl


@router.get("/workouts/{slug}")
def get_workout(slug: str) -> dict:
    tmpl = _find_template(slug)
    res = runs_mod.materialise_run(slug, catalog=_catalog_index(), root=_root())
    return {"template": tmpl, **res}


@router.get("/workouts/{slug}/beats")
def get_workout_beats(slug: str) -> list[dict]:
    # the run-flow clock consumes beats[]
    res = runs_mod.materialise_run(slug, catalog=_catalog_index(), root=_root())
    return res["beats"]


@router.get("/plans")
def list_plans() -> list[dict]:
    return runs_mod.list_plan_slots(root=_root())


@router.get("/plans/{slug}/slots")
def get_plan_slots(slug: str) -> list[dict]:
    for plan in load_plans(_root()):
        if plan.get("slug") == slug:
            return runs_mod.list_plan_slots_for(plan, root=_root())
    raise HTTPException(status_code=404, detail=f"unknown plan '{slug}'")


@router.get("/plans/{slug}/session")
def get_plan_session(slug: str, date: str | None = Query(None)) -> dict:
     # T-51: which slot of a flat 3+1 plan plays on `date` (default today). Mirrors the client's
     # session-today.ts: dayOfWeek (Mon=0..Sun=6) -> slotIndex = dayOfWeek mod len(slots).
    plan = next((p for p in load_plans(_root()) if p.get("slug") == slug), None)
    if plan is None:
        raise HTTPException(status_code=404, detail=f"unknown plan '{slug}'")
    slots = runs_mod.list_plan_slots_for(plan, root=_root())
    d = _dt.date.fromisoformat(date or "") if date else _dt.date.today()
    # isoweekday(): Mon=1..Sun=7 -> map to Mon=0..Sun=6 to match the client resolver.
    dow = d.isoweekday() - 1
    if slots:
        idx = ((dow % len(slots)) + len(slots)) % len(slots)
        slot = slots[idx]
        is_rest = slot.get("kind") == "rest" or slot.get("template_slug") is None
        return {
              "date": d.isoformat(),
              "dayOfWeek": dow,
              "slotIndex": idx,
              "slot": slot,
              "isRest": is_rest,
              }
     # No slots -> default to a rest day, matching the client's unresolvable => isRest=true.
    return {"date": d.isoformat(), "dayOfWeek": dow, "slotIndex": -1, "slot": None, "isRest": True}
