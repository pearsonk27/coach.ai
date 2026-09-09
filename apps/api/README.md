# apps/api — FastAPI backend

Owner of the API surface in `docs/HIIT_WORKOUT_APP_DESIGN.md` §6:
content (`/templates`, `/plans`, `/session`), runs (`/runs`, `/control`, `/feedback`),
`/music/resolve`, and the light-account playlist (`/me`, `/me/playlist`).

MVP-light (D9): playback path is auth-free; only *owning a playlist* uses the light account.
No secret in MVP (public SoundCloud oEmbed, D8).

**Stack (locked):** FastAPI + uv + Pydantic v2 + SQLAlchemy + Alembic + pytest,
Pyrefly type-checking. Python 3.12. Testcontainers Postgres lands in T-10.

Landed by T-10 (schema + Alembic) and T-30 (endpoints + OpenAPI).
