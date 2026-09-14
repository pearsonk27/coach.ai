"""T-11 -- seed loader + I1/I2/I4 enforcement.

Two entry points, split by whether a Postgres connection is available (design section 3 / D1):
check_seed(root)   -- DB-free: load + strict-validate every template, build beats, enforce I1/I2/I4,
                      cross-ref exercises/plan-slots. The CI gate.
load_seed(db_url)  -- Postgres persistence (API boot / T-11 smoke; stops when no PG).
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.contracts.schema import WorkoutTemplate
from app.db import models
from app.db.base import Base
from app.engine.build_timeline import build_timeline, total_seconds_of

# Namespace for deterministic seed UUIDs -- idempotent re-seed, stable FK resolution.
_NS = uuid.uuid5(uuid.NAMESPACE_URL, "coach.ai/seed")
SEED_ROOT: Optional[Path] = None
SEED_DIR: Optional[Path] = None


def _uid(prefix: str, key: str) -> uuid.UUID:
    return uuid.uuid5(_NS, f"{prefix}:{key}")


def default_seed_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _read(root: Path, rel: str) -> Any:
    return json.loads((root / rel).read_text())


def load_catalog(catalog: Dict[str, Any]) -> Dict[str, Any]:
    ex_by_slug = {ex["slug"]: ex for ex in catalog.get("exercises", [])}
    equipment = {e["slug"] for e in catalog.get("equipment", [])}
    muscle = {m["slug"] for m in catalog.get("muscle_groups", [])}
    return {"exercises_by_slug": ex_by_slug, "equipment": equipment, "muscle_groups": muscle}


def load_workouts(root: Path) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    wdir = (root / "seed" / "workouts") if root else default_seed_root() / "seed" / "workouts"
    for f in sorted(wdir.glob("*.json")):
        out.append(json.loads(f.read_text()))
    return out


def load_plans(root: Path) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    pdir = root / "seed" / "plans" if root else default_seed_root() / "seed" / "plans"
    if pdir.exists():
        for f in sorted(pdir.glob("*.json")):
            out.append(json.loads(f.read_text()))
    return out


@dataclass
class SeedReport:
    ok: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    template_slugs: List[str] = field(default_factory=list)
    exercise_count: int = 0

    def fail(self, msg: str) -> None:
        self.ok = False
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


class SeedError(Exception):
    pass


FIXED_HIIT_PHASES = ["warmup", "main_circuit", "accessory_circuit", "abs_cardio", "static_stretch"]


def _validate_template(tmpl: Dict[str, Any]) -> Optional[str]:
    try:
        WorkoutTemplate.model_validate(tmpl)
    except Exception as e:  # noqa: BLE001
        return f"template '{tmpl.get('slug', '?')}' failed contract mirroring: {e}"
    return None


def enforce(tmpl, report, catalog=None) -> bool:
    ok = True
    err = _validate_template(tmpl)
    if err:
        report.fail(err)
        return False

    beats = build_timeline(tmpl, catalog=catalog)
    if not beats:
        report.fail(f"I1: template '{tmpl['slug']}' built zero beats")
        ok = False
    rebuilt = total_seconds_of(tmpl)
    stored = int(tmpl.get("total_seconds", 0))
    if rebuilt != stored:
        report.fail(f"I2: template '{tmpl['slug']}' rebuilt {rebuilt}s != stored {stored}s")
        ok = False
    else:
        report.warn(
            f"I1/I2 pass: {tmpl['slug']} rebuilt == stored ({rebuilt}s, {len(beats)} beats)"
        )

    structure = tmpl.get("structure", "fixed-hiit")
    phases = sorted(tmpl.get("phases", []), key=lambda p: int(p.get("position", 0)))
    if structure == "fixed-hiit":
        order = [p.get("phase_type") for p in phases]
        if order != FIXED_HIIT_PHASES:
            report.fail(
                f"I4: template '{tmpl['slug']}' phases {order} != canonical {FIXED_HIIT_PHASES}"
            )
            ok = False
    else:
        report.warn(f"I7 tag-exempt: '{tmpl['slug']}' is '{structure}' -- I4 not applied")

    if catalog:
        known = catalog["exercises_by_slug"]
        for ph in phases:
            for it in ph.get("items", []) or []:
                if it.get("exercise") not in known:
                    report.fail(
                        f"XF: template '{tmpl['slug']}' phase '{ph.get('phase_type')}' "
                        f"references unknown exercise '{it.get('exercise')}'"
                    )
                    ok = False
    return ok


def check_seed(root: Optional[Path] = None) -> SeedReport:
    report = SeedReport()
    root = root or default_seed_root()
    catalog = load_catalog(_read(root, "seed/catalog.json"))
    report.exercise_count = len(catalog["exercises_by_slug"])

    for tmpl in load_workouts(root):
        report.template_slugs.append(tmpl.get("slug", "<unknown>"))
        enforce(tmpl, report, catalog=catalog)

    known_templates = set(report.template_slugs)
    for plan in load_plans(root):
        for week in plan.get("weeks", []):
            for slot in week.get("slots", []):
                ts = slot.get("template_slug")
                if slot.get("kind") != "rest" and ts and ts not in known_templates:
                    report.fail(
                        f"XF: plan '{plan.get('slug')}' slot {slot.get('slot')} "
                        f"references unknown template '{ts}'"
                    )
    return report


def _upsert(session, obj):
    existing = session.get(type(obj), obj.id)
    if existing is not None:
        for c in type(obj).__table__.columns:
            if c.name == "id":
                continue
            if hasattr(obj, c.name):
                setattr(existing, c.name, getattr(obj, c.name))
        session.add(existing)
        return existing
    session.add(obj)
    session.flush()
    return obj


def seed_all(session, root: Optional[Path] = None, *, enforce_invariants: bool = True) -> None:
    from sqlalchemy import delete

    root = root or default_seed_root()
    report = check_seed(root)
    if enforce_invariants and not report.ok:
        raise SeedError("seed pre-write gate failed: " + " ".join(report.errors))
    catalog_raw = _read(root, "seed/catalog.json")
    catalog = load_catalog(catalog_raw)
    for cls in (
        models.ExerciseEquipment,
        models.ExerciseMuscleGroup,
        models.PlanSlot,
        models.PlanWeek,
        models.WorkoutPhase,
        models.PhaseExercise,
    ):
        session.execute(delete(cls))
    session.flush()
    for mg in catalog_raw.get("muscle_groups", []):
        _upsert(
            session,
            models.MuscleGroup(
                id=_uid("mg", mg["slug"]), slug=mg["slug"], name=mg["name"], region=mg.get("region")
            ),
        )
    for eq in catalog_raw.get("equipment", []):
        _upsert(
            session,
            models.Equipment(
                id=_uid("eq", eq["slug"]),
                slug=eq["slug"],
                name=eq["name"],
                icon_name=eq.get("icon_name"),
                is_builtin=bool(eq.get("is_builtin")),
            ),
        )
    ex_ids: Dict[str, uuid.UUID] = {}
    for ex in catalog["exercises_by_slug"].values():
        eid = _uid("ex", ex["slug"])
        _upsert(
            session,
            models.Exercise(
                id=eid,
                slug=ex["slug"],
                name=ex["name"],
                description=ex.get("description", ""),
                cues=ex.get("cues", []),
                difficulty=ex.get("difficulty", 1),
                intensity=ex.get("intensity", 4),
                gif_url=ex.get("gif_url"),
            ),
        )
        ex_ids[ex["slug"]] = eid
    for ex in catalog["exercises_by_slug"].values():
        eid = ex_ids[ex["slug"]]
        for mgsl in ex.get("muscle_groups", []):
            _upsert(
                session,
                models.ExerciseMuscleGroup(exercise_id=eid, muscle_group_id=_uid("mg", mgsl)),
            )
        for eqsl in ex.get("equipment", []):
            _upsert(
                session, models.ExerciseEquipment(exercise_id=eid, equipment_id=_uid("eq", eqsl))
            )
    for tmpl in load_workouts(root):
        t_id = _uid("tmpl", tmpl["slug"])
        ts = tmpl["slug"]
        _upsert(
            session,
            models.WorkoutTemplate(
                id=t_id,
                slug=ts,
                name=tmpl["name"],
                description=tmpl.get("description"),
                goal=tmpl.get("goal"),
                structure=tmpl.get("structure", "fixed-hiit"),
                emphasis=tmpl.get("emphasis"),
                total_seconds=tmpl["total_seconds"],
                structure_version=tmpl.get("structure_version", 1),
                music=tmpl.get("music"),
                equipment_required=tmpl.get("equipment_required", []),
                target_muscle_groups=tmpl.get("target_muscle_groups", []),
            ),
        )
        for ph in sorted(tmpl.get("phases", []), key=lambda p: int(p.get("position", 0))):
            p_idx = int(ph.get("position", 0))
            p_id = _uid("phase", "tmpl-slug:" + ts + ":" + str(p_idx))
            _upsert(
                session,
                models.WorkoutPhase(
                    id=p_id,
                    template_id=t_id,
                    position=p_idx,
                    phase_type=ph["phase_type"],
                    title=ph.get("title", ""),
                    description=ph.get("description"),
                    rounds=ph.get("rounds", 1),
                    rest_seconds=ph.get("rest_seconds", 0),
                    prep_seconds=ph.get("prep_seconds", 10),
                    transition_seconds=ph.get("transition_seconds", 10),
                ),
            )
            for it in ph.get("items", []) or []:
                it_idx = int(it.get("position", 0))
                iid = "tmpl-slug:" + ts + ":" + str(p_idx) + ":" + str(it_idx)
                _upsert(
                    session,
                    models.PhaseExercise(
                        id=_uid("item", iid),
                        phase_id=p_id,
                        position=it_idx,
                        exercise_id=ex_ids[it["exercise"]],
                        work_seconds=it.get("work_seconds", it.get("workSeconds", 0)),
                        cue_override=it.get("cue_override", it.get("cue")),
                    ),
                )
    for plan in load_plans(root):
        plan_id = _uid("plan", plan["slug"])
        ps = plan["slug"]
        _upsert(
            session,
            models.WorkoutPlan(
                id=plan_id,
                slug=ps,
                name=plan["name"],
                description=plan.get("description"),
                cadence=plan.get("cadence"),
                cycle_weeks=plan.get("cycle_weeks", 1),
                source=plan.get("source"),
            ),
        )
        for week in plan.get("weeks", []):
            wi = int(week.get("week_index", 0))
            wk_id = _uid("week", "plan-slug:" + ps + ":" + str(wi))
            _upsert(
                session,
                models.PlanWeek(
                    id=wk_id,
                    plan_id=plan_id,
                    week_index=wi,
                    theme=week.get("theme"),
                    description=week.get("description"),
                ),
            )
            for slot in week.get("slots", []):
                slot_i = int(slot.get("slot", 0))
                slot_id = _uid("slot", "plan-slug:" + ps + ":" + str(wi) + ":" + str(slot_i))
                _upsert(
                    session,
                    models.PlanSlot(
                        id=slot_id,
                        week_id=wk_id,
                        slot=slot_i,
                        kind=slot["kind"],
                        label=slot.get("label"),
                        template_slug=slot.get("template_slug"),
                        params=slot.get("params", {}),
                    ),
                )
    session.flush()


def load_seed(
    db_url: str, *, enforce_invariants: bool = True, seed_root: Optional[Path] = None
) -> dict:
    from sqlalchemy import create_engine, func
    from sqlalchemy.orm import sessionmaker

    global SEED_DIR, SEED_ROOT
    root = seed_root or SEED_ROOT or default_seed_root()
    SEED_ROOT, SEED_DIR = root, root / "seed"

    report = check_seed(root)
    if enforce_invariants and not report.ok:
        raise SeedError("seed pre-write gate failed: " + "\n - ".join(report.errors))

    engine = create_engine(db_url)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    seed_all(session, root, enforce_invariants=enforce_invariants)
    session.commit()
    summary = {
        "templates": session.query(models.WorkoutTemplate).with_entities(func.count()).scalar(),
        "plans": session.query(models.WorkoutPlan).with_entities(func.count()).scalar(),
        "exercises": session.query(models.Exercise).with_entities(func.count()).scalar(),
        "phase_exercises": session.query(models.PhaseExercise).with_entities(func.count()).scalar(),
        "workouts": session.query(models.WorkoutTemplate).with_entities(func.count()).scalar(),
    }
    session.close()
    engine.dispose()
    return summary


if __name__ == "__main__":
    rep = check_seed()
    print(f"seed check ok={rep.ok} templates={rep.template_slugs}")
    if not rep.ok:
        for e in rep.errors:
            print("      -", e)
        raise SystemExit(1)
    print("seed check PASS")
