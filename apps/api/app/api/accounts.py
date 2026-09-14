"""T-33 / T-51 -- account, session, run, feedback + streak endpoints (MVP, in-memory store)."""

from fastapi import APIRouter, HTTPException

from app.api import runs as runs_mod
from app.api.store import STORE

router = APIRouter(prefix="/api", tags=["account", "session", "feedback"])


@router.post("/accounts")
def create_account(payload: dict) -> dict:
    acct = STORE.create_account(payload)
    return {"account": acct, "preferences": STORE.get_preferences(acct["id"])}


@router.get("/accounts/{aid}")
def get_account(aid: str) -> dict:
    acct = STORE.get_account(aid)
    if acct is None:
        raise HTTPException(status_code=404, detail=f"unknown account '{aid}'")
    return {
        "account": acct,
        "preferences": STORE.get_preferences(aid),
        "streak": STORE.get_streak(aid),
    }


@router.put("/accounts/{aid}/preferences")
def update_preferences(aid: str, payload: dict) -> dict:
    if STORE.get_account(aid) is None:
        raise HTTPException(status_code=404, detail=f"unknown account '{aid}'")
    prefs = STORE.set_preferences(aid, payload)
    return {"account_id": aid, "preferences": prefs}


@router.post("/sessions")
def start_session(payload: dict) -> dict:
    sess = STORE.create_session(payload)
    return {"session": sess}


@router.get("/sessions/{sid}")
def get_session(sid: str) -> dict:
    sess = STORE.get_session(sid)
    if sess is None:
        raise HTTPException(status_code=404, detail=f"unknown session '{sid}'")
    return {"session": sess}


@router.post("/runs")
def create_run(payload: dict) -> dict:
    # materialise the requested template with optional D6 knobs (I2-guarded inside materialise_run)
    template_slug = (
        payload.get("template") or payload.get("templateSlug") or payload.get("template_slug")
    )
    if not template_slug:
        raise HTTPException(status_code=422, detail="template required")
    try:
        result = runs_mod.materialise_run(
            template_slug, params=payload.get("params") or payload.get("knobs")
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    run = STORE.create_run(
        {
            "account_id": payload.get("account_id"),
            "template_slug": template_slug,
            "beats": result["beats"],
            "total_seconds": result["total_seconds"],
            "duration_ms": result["duration_ms"],
            "params_applied": result["params_applied"],
            "i2_ok": result["i2_ok"],
        }
    )
    return {"run": run}


@router.get("/runs/{rid}")
def get_run(rid: str) -> dict:
    run = STORE.get_run(rid)
    if run is None:
        raise HTTPException(status_code=404, detail=f"unknown run '{rid}'")
    return {"run": run}


@router.post("/feedback")
def submit_feedback(payload: dict) -> dict:
    # derive streak, persist feedback, and fold targetRpeFocus back into preferences (T-51)
    fb = STORE.add_feedback(payload)
    aid = payload.get("account_id")
    streak = STORE.get_streak(aid)
    today = payload.get("date")
    if streak is None:
        streak = {"length": 1, "best": 1, "last_date": today}
    elif streak.get("last_date") != today:
        new_len = (streak.get("length", 0) or 0) + 1
        streak = {
            "length": new_len,
            "best": max(streak.get("best", 1), new_len),
            "last_date": today,
        }
    if aid and streak is not None:
        STORE.set_streak(aid, streak)
    if aid and payload.get("targetRpeFocus"):
        STORE.set_preferences(aid, {"target_rpe_focus": payload["targetRpeFocus"]})
    return {"feedback": fb, "streak": streak}
