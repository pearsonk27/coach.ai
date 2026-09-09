# AGENTS.md — coach.ai (project operating rules)

> Tier-1 global context. Every agent session starts here, then loads Tier-2 `CONTEXT.md` for the
> subsystem it touches and the Tier-3 `tasks/active/*.md` card. Human-owned; agents propose,
> humans approve (see `ai_native_monorepo_architecture_blueprint.md` principle #4).

## Golden rule
Treat this repo as **an AI-native engineering platform, not a pile of generated code.** Prefer a
stable, typed contract over fast-moving tooling. **Generated code is not complete until it passes
every gate in §Gating.**

## Mission (one line)
A web + mobile + TV-castable HIIT class player with a **precomputed, deterministic run timeline**,
a **periodized regiment**, **music throughout**, and a clean write-path for an AI to *generate
better* workouts.

## Stack (locked — do not churn)
- Web: Next.js + React + TS + Tailwind + TanStack Query + Zustand + Zod · packages via pnpm.
- Mobile: Expo + React Native + TS.
- API: FastAPI + uv + Pydantic v2 + SQLAlchemy + Alembic + pytest (Pyrefly type-checking).
- Contracts: `packages/shared-types` (Zod ⇄ Pydantic). CI fails on drift.
- Test: Vitest + Playwright (web/mobile), pytest (API, Testcontainers Postgres).
- Orchestration: Turborepo. Unified commands: `just format|lint|typecheck|test|dev`.

## Directory map (what's real now vs planned)
- `docs/HIIT_WORKOUT_APP_DESIGN.md` — **source of truth** (read first for scope).
- `seed/` — catalog + templates + regiment (the data the app plays).
- `standards/AGENTS.md` — this file.
- `packages/prompts/run-next-task.md` — the orchestrating prompt (§Workflow).
- `tasks/{backlog,active,completed}/`, `tasks/INDEX.md` — task registry + lifecycle.
- Planned: `apps/{api,web,mobile,docs}`, `packages/{ui,shared-types,api-client,prompts,testing}`,
  `casts/receiver` (v1.1), `.github/workflows/ci.yml`, `.env.example`.

## Invariants (structural drift prevention — enforce in CI)
- I1 — `workout_run.beats` is built by **`buildTimeline(template, params)`** (pure, D2); never
   hand-authored.
- I2 — `buildTimeline(...).totalSeconds == workout_template.total_seconds`.
- I3 — Zod (TS) ⇄ Pydantic (API) contract snapshot is identical.
- I4 — `fixed-hiit` templates contain exactly the 5 phases in order:
   warmup → main_circuit → accessory_circuit → abs_cardio → static_stretch.
- I5 — New env var ⇒ `.env.example` + docs updated in the **same** PR.
- I6 — No `pip install` / `npm install` in workspaces. Lockfiles (`uv.lock`, `pnpm-lock.yaml`)
   always committed.
- I7 — `fixed-hiit` structure is a **tag** (D5), not a DB constraint — upgrade via
   `structure_version`.
- I8 — Every PR must **update docs or CONTEXT.md**, or CI fails.

## Gating — Definition of Done (a task is "done" only when all pass)
Run and record these in the task handoff, in order:
```text
just format        → just lint        → just typecheck
just test (unit + integration)   → just build   → contract drift check ✓
docs / CONTEXT.md updated ✓        → invariant checks (I1,I2,I4) ✓
```
No untested generated code. No `done` status with a green lint but red tests.

## Verification procedures (the agent runs these; record results in the handoff)
1. `just format && just lint && just typecheck && just test && just build` — the pipeline gate.
2. `just check-contract` — I3 drift (TS⇄Pydantic).
3. `just check-invariants` — I1/I2/I4 over `seed/**`.
4. `just check-env` — I5 (`.env.example` ⊇ code-read env vars; env ⊇ docs).
5. Targeted test(s) for THIS task (named in the card).
Record: `verification: passed (pipeline, contract, invariants, env, <task test>) @ <commit>`.

## Human-review STOPs (never auto-commit past a STOP; halt and ask the human)
- **STOP-S** schema / migration change (I-shape + data impact).
- **STOP-A** new public API or any change to `shared-types` contract.
- **STOP-E** new env var or secret.
- **STOP-D** new external dependency or a major-version bump.
- **STOP-I** AI-loop write path (template generation, `evaluate`, `created_by='ai'`).
- **STOP-C** Chromecast / device / cross-origin surface or any new network egress.
- **STOP-H** health-data access.
Task cards declare `review_stops: [ … ]`; the run-next-task prompt halts at each.

## Context layering
- Tier 1 (always): this file + `docs/HIIT_WORKOUT_APP_DESIGN.md`.
- Tier 2 (per subsystem): `apps/<x>/CONTEXT.md`, `packages/<x>/CONTEXT.md`.
- Tier 3 (task): `tasks/active/<id>.md`.

## Before you implement (required)
1. Read §Mission + the open questions in the design doc §11.
2. Identify the single smallest "next" task (see Workflow) and its blast radius.
3. Implement TDD (failing test first) where a unit/integration test belongs.
4. Run the §Gating pipeline; record §Verification.
5. Update docs/CONTEXT.md; move the task to `tasks/completed/`.
6. **Stop** at any human-review STOP and report to the human.
