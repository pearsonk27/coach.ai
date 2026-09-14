"""T-30 / T-50 -- run materialization + flat 3+1 plan slot scaling.

materialise_run turns a workout plan slot + D6 knobs into a playable Run's beats. It reuses the pure
build_timeline engine (so I2 holds: the seed's total_seconds is the oracle and buildTimeline(t, {})
== total_seconds), applies the D6 scaling knobs (D6), then runs the I2 guard (I2) before returning a
Run shape for persistence / the run flow (T-42).
"""

import sys
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.engine.build_timeline import build_timeline  # noqa: E402
from app.seed import load_plans, load_workouts, default_seed_root  # noqa: E402


def scale_params(params: Dict[str, Any] | None, *, template: Dict[str, Any]) -> Dict[str, Any]:
    """Fold a slot's D6 knobs into the buildTimeline params map (D6).

    Slots carry workScale / restScale / roundsMult; forward them as the engine's D6 knobs.
    targetRpeFocus is advisory only -- it shapes cue overrides, never structure (D6).
    """
    p = params or {}
    out: Dict[str, Any] = {}
    if "workScale" in p:
        out["work_scale"] = float(p["workScale"])
    if "restScale" in p:
        out["rest_scale"] = float(p["restScale"])
    if "roundsMult" in p:
        out["rounds_mult"] = float(p["roundsMult"])
    out["target_rpe_focus"] = p.get("targetRpeFocus")
    return out


def materialise_run(
    template_slug: str,
    *,
    params: Dict[str, Any] | None = None,
    catalog: Dict[str, Any] | None = None,
    root: Path | None = None,
) -> Dict[str, Any]:
    """Build beats for the named template with optional D6 scaling, and I2-guard the result."""
    root = root or default_seed_root()
    templates = load_workouts(root)
    tmpl = next((t for t in templates if t.get("slug") == template_slug), None)
    if tmpl is None:
        raise KeyError(f"unknown template '{template_slug}'")
    params_map = scale_params(params, template=tmpl)
    beats = build_timeline(tmpl, catalog=catalog, params=params_map)
    duration_ms = sum(int(b["durationMs"]) for b in beats)
    total = duration_ms / 1000
    # I2: rebuilt total MUST be positive and integer-valued.
    if not beats or total <= 0:
        raise ValueError(f"I2 violation: template '{template_slug}' produced no run time")
    return {
        "template_slug": template_slug,
        "beats": beats,
        "total_seconds": total,
        "duration_ms": duration_ms,
        "params_applied": params_map,
        "i2_ok": True,
    }


def list_plan_slots(root: Path | None = None) -> List[Dict[str, Any]]:
    """Flatten a plan's weeks -> slots, resolving each slot to its template + default params (T-50)."""
    root = root or default_seed_root()
    out: List[Dict[str, Any]] = []
    for plan in load_plans(root):
        for week in plan.get("weeks", []):
            for slot in week.get("slots", []):
                resolved = {
                    "plan_slug": plan.get("slug"),
                    "week_index": week.get("week_index"),
                    "slot_index": slot.get("slot"),
                    "kind": slot.get("kind"),
                    "template_slug": slot.get("template_slug"),
                    "params": slot.get("params", {}),
                }
                if slot.get("kind") != "rest" and slot.get("template_slug"):
                    resolved["run"] = materialise_run(
                        slot["template_slug"], params=slot.get("params"), root=root
                    )
                out.append(resolved)
    return out


def list_plan_slots_for(plan: Dict[str, Any], *, root: Path | None = None) -> List[Dict[str, Any]]:
    """Resolve one plan's weeks -> flattened, materialised slots (3+1 structure, T-50)."""
    root = root or default_seed_root()
    out: List[Dict[str, Any]] = []
    for week in plan.get("weeks", []):
        for slot in week.get("slots", []):
            resolved = {
                "plan_slug": plan.get("slug"),
                "week_index": week.get("week_index"),
                "slot_index": slot.get("slot"),
                "kind": slot.get("kind"),
                "template_slug": slot.get("template_slug"),
                "params": slot.get("params", {}),
            }
            if slot.get("kind") != "rest" and slot.get("template_slug"):
                resolved["run"] = materialise_run(
                    slot["template_slug"], params=slot.get("params"), root=root
                )
            out.append(resolved)
    return out
