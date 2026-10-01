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


def test_plan_session_today_resolves_slot() -> None:
      # T-51: date -> resolved slot, mirroring the client session-today.ts rotation.
    r = client.get("/api/content/plans/fullbody-periodized/session", params={"date": "2024-01-01"})
    assert r.status_code == 200
    body = r.json()
      # 2024-01-01 is a Monday (dow=0) -> slot index 0 of the flattened plan
    assert body["dayOfWeek"] == 0
    assert body["slotIndex"] == 0
    assert body["date"] == "2024-01-01"
    assert body["slot"]["slot_index"] == 1        # seed slots are 1-based; flattened[0] = slot 1
    assert body["slot"]["template_slug"] == "hiit-upper-30"


def test_plan_session_default_date_and_unknown() -> None:
    # No date -> today's resolution (200 with a computed dow)
    r = client.get("/api/content/plans/fullbody-periodized/session")
    assert r.status_code == 200
    assert isinstance(r.json()["dayOfWeek"], int)
    # Unknown plan -> 404
    assert client.get("/api/content/plans/nada/session").status_code == 404


def test_music_resolve_echoes_public_url() -> None:
      # T-43: hermetic oEmbed resolve -- no embed when no url; echo when a url is set.
    silent = client.get("/api/music/resolve", params={"accountId": "muser"}).json()
    assert silent["embedUrl"] is None       # default playlist has no url -> silence
    assert silent["provider"] == "soundcloud"
    assert silent["muted"] is False

    client.patch("/api/music", json={"accountId": "muser", "url": "https://sc.example/playlists/1"})
    resolved = client.get("/api/music/resolve", params={"accountId": "muser"}).json()
    assert resolved["embedUrl"] == "https://sc.example/playlists/1"


def test_music_resolve_builds_soundcloud_set_embed() -> None:
       # T-43: a public SoundCloud SET/track/playlist URL -> a real w.soundcloud.com embed the
       # client can play (no token / no secret, D8). This is the user-paste path.
    set_url = "https://soundcloud.com/kris-pearson-2/sets/coach-we-hip-hop?si=zzz&utm_source=clipboard"
    client.patch("/api/music", json={"accountId": "scuser", "provider": "soundcloud", "url": set_url})
    resolved = client.get("/api/music/resolve", params={"accountId": "scuser"}).json()
    assert resolved["provider"] == "soundcloud"
    assert resolved["source"] == set_url
    assert resolved["embedUrl"].startswith("https://w.soundcloud.com/player/")
        # player renders with SoundCloud's own params; tracking ?si=/?utm_ is stripped off resource
    assert "show_artwork=true" in resolved["embedUrl"]
    assert "visual=true" in resolved["embedUrl"]
    assert "coach-we-hip-hop" in resolved["embedUrl"]
    assert "kris-pearson-2" in resolved["embedUrl"]
    assert "si=zzz" not in resolved["embedUrl"]
    assert "utm_source" not in resolved["embedUrl"]
    tail = resolved["embedUrl"].split("url=", 1)[1]      # percent-encoded source URL
    assert "///" not in tail      # nested :// is escaped, not raw
    assert "kris-pearson-2" in tail
   
   
def test_playlist_cud() -> None:
    # PATCH upsert -> GET reflects it -> DELETE clears back to the default
    patched = client.patch("/api/music", json={"accountId": "pu", "loop": True, "volume": 0.7}).json()
    assert patched["loop"] is True and patched["volume"] == 0.7
    got = client.get("/api/music", params={"accountId": "pu"}).json()
    assert got["loop"] is True and got["volume"] == 0.7
    cleared = client.delete("/api/music", params={"accountId": "pu"}).json()
    assert cleared["loop"] is False and cleared["url"] is None


def test_run_control_commands() -> None:
       # T-41 instructor remote: pause/resume/end/jump-phase/nudge mutate the run's control state.
    run = client.post("/api/runs", json={"template": "hiit-upper-30"}).json()
    rid = run["run"]["id"]
    assert client.post(f"/api/runs/{rid}/control", json={"command": "pause"}).json()["run"]["control"]["state"] == "paused"
    assert client.post(f"/api/runs/{rid}/control", json={"command": "resume"}).json()["run"]["control"]["state"] == "playing"
    client.post(f"/api/runs/{rid}/control", json={"command": "nudge", "delta": 30000})
    client.post(f"/api/runs/{rid}/control", json={"command": "nudge", "delta": -30000})
       # jump-phase is monotonic-ish; nudge offsets cancel to 0
    assert client.post(f"/api/runs/{rid}/control", json={"command": "jump-phase", "phase": 2}).json()["run"]["control"]["phase"] == 2
       # a bad command is rejected
    assert client.post(f"/api/runs/{rid}/control", json={"command": "fly"}).status_code == 422
       # unknown run is 404
    assert client.post("/api/runs/nope/control", json={"command": "pause"}).status_code == 404
