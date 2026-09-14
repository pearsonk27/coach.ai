"""T-33 / T-30 -- MVP in-memory store for accounts, sessions, runs, feedback, streaks.

The design targets PostgreSQL-18 (T-01). For the DB-free MVP -- and because the PG cluster is not
running this cycle -- persistence is an in-process store that mirrors the relational rows. Swapping
in SQLAlchemy later is a localised change behind this interface.
"""
from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

import app.api._util as _util


class Store:

    def __init__(self) -> None:
        self.accounts: Dict[str, Dict[str, Any]] = {}
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.runs: Dict[str, Dict[str, Any]] = {}
        self.feedback: Dict[str, Dict[str, Any]] = {}
        self.streaks: Dict[str, Dict[str, Any]] = {}
        self.preferences: Dict[str, Dict[str, Any]] = {}

    def new_id(self) -> str:
        return str(uuid.uuid4())

    def create_account(self, data: Dict[str, Any]) -> Dict[str, Any]:
        aid = self.new_id()
        acct = {
            "id": aid,
            "email": data.get("email"),
            "name": data.get("name"),
            "created_at": _util.now_iso(),
            }
        self.accounts[aid] = acct
        self.preferences[aid] = dict(data.get("preferences", {}))
        return acct

    def get_account(self, aid: str) -> Optional[Dict[str, Any]]:
        return self.accounts.get(aid)

    def get_preferences(self, aid: str) -> Dict[str, Any]:
        return dict(self.preferences.get(aid, {}))

    def set_preferences(self, aid: str, prefs: Dict[str, Any]) -> Dict[str, Any]:
        merged = dict(self.preferences.get(aid, {}))
        merged.update({k: v for k, v in prefs.items() if v is not None})
        self.preferences[aid] = merged
        return merged

    def create_session(self, data: Dict[str, Any]) -> Dict[str, Any]:
        sid = self.new_id()
        sess = {"id": sid, "account_id": data.get("account_id"), "started_at": _util.now_iso()}
        self.sessions[sid] = sess
        return sess

    def get_session(self, sid: str) -> Optional[Dict[str, Any]]:
        return self.sessions.get(sid)

    def create_run(self, data: Dict[str, Any]) -> Dict[str, Any]:
        rid = self.new_id()
        run = {"id": rid, "account_id": data.get("account_id")}
        run.update(data)
        self.runs[rid] = run
        return run

    def get_run(self, rid: str) -> Optional[Dict[str, Any]]:
        return self.runs.get(rid)

    def add_feedback(self, fb: Dict[str, Any]) -> Dict[str, Any]:
        fid = self.new_id()
        rec = dict(fb)
        rec["id"] = fid
        self.feedback[fid] = rec
        return rec

    def set_streak(self, aid: str, streak: Dict[str, Any]) -> None:
        self.streaks[aid] = streak

    def get_streak(self, aid: str) -> Optional[Dict[str, Any]]:
        return self.streaks.get(aid)


STORE = Store()
