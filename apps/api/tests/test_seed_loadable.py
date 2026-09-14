"""T-11 -- seed loader + invariant enforcement (DB-free). Run with the API venv:
``pytest tests/test_seed_loadable.py -q``."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))    # app/

from app.seed import check_seed, enforce, load_catalog, SeedReport, FIXED_HIIT_PHASES

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_check_seed_passes():
    r = check_seed(REPO_ROOT)
    assert r.ok, (
         f"errors:\n - " + "\n - ".join(r.errors)
      if r.errors else "failed with no error message"
      )
    assert r.exercise_count > 0
    assert set(r.template_slugs) == {
        "hiit-upper-30",
        "hiit-lower-30",
        "hiit-full-body-30",
        "stretch-reset-15",
          }
    assert not r.errors


def test_all_templates_i1_i2_pass():
     # I1 + I2 over every template, explicitly.
    catalog = load_catalog(json.loads((REPO_ROOT / "seed" / "catalog.json").read_text()))
    for name in [
        "hiit-upper-30",
        "hiit-lower-30",
        "hiit-full-body-30",
        "stretch-reset-15",
      ]:
        raw = json.loads((REPO_ROOT / f"seed/workouts/{name}.json").read_text())
        rep = SeedReport()
        ok = enforce(raw, rep, catalog=catalog)
        assert ok, f"{name}: " + " | ".join(rep.errors)


def test_fixed_hiit_phases_enforced():
    raw = json.loads(
        (REPO_ROOT / "seed" / "workouts" / "hiit-upper-30.json").read_text()
      )
    phases = sorted(raw["phases"], key=lambda p: p["position"])
    assert [p["phase_type"] for p in phases] == FIXED_HIIT_PHASES
    assert raw["structure"] == "fixed-hiit"


def test_freeform_tag_exemption():
     # stretch-reset-15 is freeform -- I4 must NOT be applied (logged as a warning).
    raw = json.loads((REPO_ROOT / "seed" / "workouts" / "stretch-reset-15.json").read_text())
    rep = SeedReport()
    assert enforce(raw, rep) is True
    assert any("I7 tag-exempt" in w for w in rep.warnings)
    # freeform should NOT have the 5-phase order forced onto it.
    assert [p["phase_type"] for p in raw["phases"]] != FIXED_HIIT_PHASES


def test_unknown_exercise_rejected():
     # I1/I2 + cross-ref: a phase_exercise referencing a non-catalog exercise fails.
    raw = json.loads((REPO_ROOT / "seed" / "workouts" / "hiit-upper-30.json").read_text())
    catalog = load_catalog(json.loads((REPO_ROOT / "seed" / "catalog.json").read_text()))
    raw["phases"][0]["items"][0]["exercise"] = "does-not-exist"
    rep = SeedReport()
    assert enforce(raw, rep, catalog=catalog) is False
    assert any("unknown exercise" in e for e in rep.errors)


def test_bad_template_rejected_by_contract():
      # strict extra=forbid: an unexpected key at the top level fails validation.
    raw = json.loads((REPO_ROOT / "seed" / "workouts" / "hiit-lower-30.json").read_text())
    raw["_bogus"] = 1
    rep = SeedReport()
    assert enforce(raw, rep, catalog={}) is False
    assert any("contract mirroring" in e for e in rep.errors)


def test_missing_total_seconds_fails_i2():
    raw = json.loads((REPO_ROOT / "seed" / "workouts" / "hiit-lower-30.json").read_text())
    raw["total_seconds"] = 1
    rep = SeedReport()
    assert enforce(raw, rep) is False
    assert any("I2" in e for e in rep.errors)


if __name__ == "__main__":
    r = check_seed(REPO_ROOT)
    print(f"check_seed ok={r.ok} templates={r.template_slugs}")
    if not r.ok:
        for e in r.errors:
            print("  -", e)
        raise SystemExit(1)
