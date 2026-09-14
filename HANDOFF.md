# HANDOFF — MVP implementation cycle (T-01b → T-99)

_Last updated: 2026-07-15 · owner: agent (proceeding with recommendations, no human gates per directive)._

## What is DONE and green this cycle
`just gates` (format/lint/typecheck/test/build, 7/7) and the full Python suite (40 passed / 3
skipped) both pass. Skips are the PG persistence smoke, which degrades cleanly — no PG18 cluster
runs locally.

### T-01b — Pydantic v2 discriminated-union mirror (DONE)
`apps/api/app/contracts/schema.py`: the T-10 latent bug is fixed.
- `Beat` union now uses `Annotated[Union[...], Discriminator("kind")]` (not the v1
 `Field(discriminator=...)` form).
- Each beat choice declares `kind: Literal[...]`.
- `Base` model config is `ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")`
 — strict, and camel/snake both accepted.
- `WorkoutTemplate` extended with `equipment_required: List[str]` + `target_muscle_groups: List[str]`
 (seed JSON carries them; strict `extra="forbid"` would have rejected them otherwise).
 - Verified 3 ways: `test_contract_mirror.py` (3 tests, incl. pydantic 2.13 import + a
 `bad-template` rejection proving `extra="forbid"` works) + `check_seed()` validates every template.

### T-20 — buildTimeline engine + I1/I2/I4/I7 + D6 (DONE, two languages)
- `apps/api/app/engine/build_timeline.py` — pure, deterministic.
   `phase_total = prep + rounds*Σ(item.work) + (rounds-1)*rest + transition`; total = Σ phase totals.
   Beats emitted phase-intro → rounds×items(work) → inter-round rest → inter-phase transition
  (tail only on the last phase); zero-duration beats skipped.
- `packages/shared-types/src/timeline.z.ts` — TS Zod mirror.
- Verified: hiit-full-body-30 = 1695s/60beats · hiit-lower-30 = 1605s/57 · hiit-upper-30 = 1605s/57
 · stretch-reset-15 = 895s/22 (freeform, I7 tag-exempt). D6: workScale 1.1 → 1842s; restScale 0.5 →
 1636s; prep/transition NOT scaled (only work/rest/rounds); RPE advisory only.
- `scripts/check-invariants.cjs` wires I1/I2/I4; runs green over seed/**.
- 11 engine tests in `apps/api/tests/test_build_timeline.py` incl. Py/Node agreement via subprocess.

### T-11 — seed loader + I1/I2/I4 enforcement (DONE)
- `apps/api/app/seed.py`: `check_seed(root)` is DB-free and the CI gate; `load_seed(db_url)` /
 `seed_all(session, root)` is the Postgres path (deterministic UUID5 keying, idempotent).
- `SeedReport` (ok / errors / warnings), `SeedError`, `FIXED_HIIT_PHASES`, `scale_params`,
 `list_plan_slots` / `list_plan_slots_for` (T-50 flat 3+1 resolution).
- 7 tests in `apps/api/tests/test_seed_loader.py`; 3 skip on the PG smoke
 (`apps/api/tests/test_pg_smoke.py`) when no PG is reachable.

### T-30 / T-33 — API (FastAPI, DB-free content + in-memory store) — DONE
- `app/api/content.py`, `app/api/accounts.py`, `app/main.py` (app factory).
- `app/api/store.py` — in-memory store (accounts / sessions / runs / feedback / streaks / prefs),
  swapping in SQLAlchemy later is local.
- Endpoints: `/api/health`, `/api/content/{catalog,workouts,workouts/{slug},workouts/{slug}/beats,
 plans,plans/{slug}/slots}`, `/api/accounts[/{aid}/preferences]`, `/api/sessions[{/{sid}}]`,
 `/api/runs`, `/api/feedback`.
   Run materialisation reuses `build_timeline` (I2-guarded). Feedback derives streak + folds
  `targetRpeFocus` back into preferences (T-51 loop closed on the server side).
- 7 tests in `apps/api/tests/test_api.py` (full lifecycle: create account → update prefs → session →
  run → feedback → streak).

### T-31 — OpenAPI → typed REST client (DONE)
- `apps/api/openapi.json` emitted from the FastAPI app (14 paths, v0.1.0).
- `scripts/gen-api-client.cjs` → `packages/api-client/src/generated.ts` (one typed function per
 op + a `fetch`-based `ApiClient`). `packages/api-client/src/index.ts` re-exports it.
- api-client typechecks under `npx tsc` (v5.6.3, from the root `tsconfig.base.json`).

### T-50 — flat 3+1 slot resolution (DONE, partial)
- `scripts/` flat-plan resolution lives in `app/api/runs.py::list_plan_slots[_for]`: each week →
 its 3+1 slots, each `active`/`stretch` slot materialised to a run; `rest` slots are gaps.
- `apps/api/app/seed.py::load_plans` / `check_seed` validate plan→template cross-refs.

### T-21 — useWorkoutClock core (DONE, pure + typechecked)
- `packages/ui/src/clock.ts`: `readClock`, `currentBeat`, `currentBeatIndex`, `beatProgress`,
 `totalMs`, `formatMSS`, `clicksForBeat` (D3/D10 metronome cueing). Pure, transport-agnostic.
- `packages/ui/test/clock.test.cjs` — smoke test passes under `node`.
- ui typechecks under `npx tsc`. React/Expo wrappers are deps-pending (no `react` yet).

### T-99 — gates (DONE)
- `just gates` = 7/7. `packages/api-client` + `packages/ui` now run REAL `tsc` in turbo (cache-miss
 builds succeeded). `packages/api-client/gen` regenerates the client from OpenAPI.

## Blockers / pending → next developer
1. **PG18 + psycopg not running** (decision, not a bug): the design targets PostgreSQL-18 + psycopg,
   but no cluster runs locally. Resolved for MVP: the DB-free `check_seed` carries the CI gate;
   `load_seed` / `test_pg_smoke` degrade to `pytest.skip` when no PG is reachable (a `PG_TEST_DSN`
   is honoured if a reviewer provides one). psycopg is now installed in `apps/api/.venv`; a future
   cycle stands up PG-18 (or uses a PGlite / testcontainers shim) to exercise the real upsert path.
2. **zod not installed** in node_modules → the contract guard's TS introspection layer is the SKIP
   branch. The snapshot agreement (TS↔snapshot, Py↔snapshot) still passes; once zod is installed the
   guarded TS introspection activates automatically.
3. **Deps-pending UI** (T-40 components, T-41 stores, T-42 run flow UI, T-43 feedback UI, T-60 mobile,
  T-70 web) — these need `react`/`react-native`/`zustand`/`expo-av`/`next`. Their PURE cores
  (T-21 clock, T-31 client, T-50 plan resolution) are done + green; the React/Expo layers are
   scaffolding stubs (`node -e 0`) awaiting deps-install. Wire them once dependencies land.

## How to run
- Python: `apps/api/.venv/bin/python -m pytest` (40 passed / 3 skipped). Seed check:
  `apps/api/.venv/bin/python -m app.seed`.
- Node gates: `just gates`. Invariants: `CT_PYTHON=apps/api/.venv/bin/node node scripts/check-invariants.cjs`
 (or `node scripts/check-invariants.cjs` — it picks the venv python automatically).
- Regenerate client: `node scripts/gen-api-client.cjs` after changing the OpenAPI surface.

## Notes / gotchas
- The `contracts/schema.py` `MusicProvider.LYRICAL` default was changed to `SOUND` (`"soundcloud"`)
   by T-10; leave it.
- Seed `total_seconds` is the oracle; `buildTimeline(t, {})` MUST sum to it (I2). The `enforce` /
 `materialise_run` paths assert this; `work_scale`/`rest_scale`/`rounds_mult` move the *rebuilt*
 total but I2 guards the identity case.
- Beat shape: `{ id, kind, startMs, endMs, durationMs }` base; `work` adds
  `{ exerciseRef, cue?, round? }`. `rest`/`prep`/`phase-intro`/`cooldown-hold` are strict.
- Deterministic seed UUIDs: `uuid5(NAMESPACE_URL, "coach.ai/seed", prefix:slug)` — idempotent re-seed.
