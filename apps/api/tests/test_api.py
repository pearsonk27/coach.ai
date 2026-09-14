"""T-30 / T-33 -- API integration: browse content, start a run, submit feedback."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

os.environ.pop("TEST_DATABASE_URL", None)
from app.main import app

client = TestClient(app)


def test_health_ok() -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["seed_ok"] is True
    assert "hiit-full-body-30" in r.json()["templates"]


def test_list_workouts() -> None:
    # I1: every returned workout has a non-empty beats[]
    r = client.get("/api/content/workouts")
    assert r.status_code == 200
    out = r.json()
    assert len(out) >= 3
    for w in out:
        assert w["beats"] > 0, f"{w['slug']} I1"
        assert w["total_seconds"] > 0


def test_get_workout_with_beats() -> None:
    r = client.get("/api/content/workouts/hiit-full-body-30")
    assert r.status_code == 200
    body = r.json()
    assert body["beats"] and len(body["beats"]) > 0
    assert body["i2_ok"] is True
    assert body["total_seconds"] == 1695.0


def test_workout_beats_are_camelCase() -> None:
    beats = client.get("/api/content/workouts/hiit-full-body-30/beats").json()
    assert beats and all("durationMs" in b for b in beats)
    work = next(b for b in beats if b.get("kind") == "work")
    assert "exerciseRef" in work and "cue" in work


def test_unknown_workout_404() -> None:
    assert client.get("/api/content/workouts/nope").status_code == 404


def test_accounts_lifecycle() -> None:
    # create -> update prefs -> start session -> create run (I2) -> submit feedback (streak)
    created = client.post("/api/accounts", json={"email": "a@b.co", "name": "Ada"}).json()
    aid = created["account"]["id"]
    assert created["account"]["id"]

    client.put("/api/accounts/%s/preferences" % aid, json={"target_rpe_focus": "8.0"})
    assert client.get("/api/accounts/%s" % aid).json()["preferences"]["target_rpe_focus"] == "8.0"

    sess = client.post("/api/sessions", json={"account_id": aid}).json()
    assert sess["session"]["id"]

    run = client.post("/api/runs", json={"account_id": aid, "template": "hiit-full-body-30"}).json()
    assert run["run"]["i2_ok"] is True
    assert run["run"]["total_seconds"] == 1695.0
    assert len(run["run"]["beats"]) > 0

    fb = client.post(
        "/api/feedback",
        json={
            "account_id": aid,
            "date": "2026-07-15",
            "targetRpeFocus": "8.5",
            "template_slug": "hiit-full-body-30",
        },
    ).json()
    assert fb["streak"]["length"] >= 1
    assert client.get("/api/accounts/%s" % aid).json()["streak"]["length"] == 1


def test_plan_slots_flatten_3plus1() -> None:
    r = client.get("/api/content/plans")
    assert r.status_code == 200
    slots = r.json()
    # fullbody-periodized: upper / lower / fullbody active + stretch
    kinds = [s["kind"] for s in slots]
    assert "active" in kinds
