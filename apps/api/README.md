# apps/api — FastAPI backend

Owner of the API surface in `docs/HIIT_WORKOUT_APP_DESIGN.md` §6:
content (`/templates`, `/plans`, `/session`), runs (`/runs`, `/control`, `/feedback`),
`/music/resolve`, and the light-account playlist (`/me`, `/me/playlist`).

MVP-light (D9): playback path is auth-free; only *owning a playlist* uses the light account.
No secret in MVP (public SoundCloud oEmbed, D8).

**Stack (locked):** FastAPI + uv + Pydantic v2 + SQLAlchemy + Alembic + pytest,
Pyrefly type-checking. Python 3.12. Testcontainers Postgres lands in T-10.

Landed by T-10 (schema + Alembic) and T-30 (endpoints + OpenAPI).

## Cross-language contract (T-01)

`app/contracts/` holds the **Pydantic v2 mirror** of `@coach/shared-types` (the I3 anti-drift
contract). It is the API half of the `WorkoutRun`/`Beat` AI-loop substrate (D1/D2):

- `app/contracts/schema.py` — the mirror. JSON keys are **camelCase** over the wire (via a
     `to_camel` `alias_generator` + `populate_by_name=True`); the Python source names are snake
     (e.g. model field `started_at_ms` ↔ JSON key `startedAtMs`). Enum *values* are the shared
    literal strings (e.g. `"run_start"`, `"main_circuit"`).
- `app/contracts/contract.fields.json` — the Py per-type field manifest; the I3 guard asserts its
    `keys` (camel wire keys) equal the canonical snapshot's. `pyNames` records the snake side.

### Adding a field WITHOUT drift
1. Add it to the Zod schema in `packages/shared-types/src` (canonical).
2. Mirror it in `app/contracts/schema.py` with the **same JSON key** (snake field → camel alias).
3. Update `contract.fields.json` (`keys`, and `pyNames`).
4. Run `just check-contract` — it must go green and stay sensitive (`--mutate`).

> **Bootstrap note (STOP-A/D addendum)**: the manifest is hand-synced today. When `uv sync` lands
> (post SIGNOFF-D, with `pydantic` installed), regenerate it from
> `WorkoutRun.model_json_schema(by_alias=True)` and add that introspection layer to the guard.
