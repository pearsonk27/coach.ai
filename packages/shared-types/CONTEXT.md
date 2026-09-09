# @coach/shared-types — anti-drift contract

> Tier-2 subsystem context (AGENTS.md §Context layering).

## Goal
The single source of truth for cross-language types. **Canonical = Zod here; a
Pydantic v2 mirror lives in `apps/api`.** CI fails on drift (I3).

## What lands (T-01)
`timeline.z.ts` + `catalog.z.ts` authoring:
- `Beat` union: `phase-intro | prep | work | rest | cooldown-hold`, each `{id, kind, durationMs}`;
  `work` carries `exerciseRef`, `cue?`, `round?`.
- `WorkoutRun { id, template, startedAtMs, endedAtMs?, durationMs, status, source, beats }`.
- `WorkoutPhase`, `PhaseExercise`, catalog enums, `MusicRef { provider, playlist_ref?, volume?, start_on? }`.
- `PlanSlot.params { work_scale?, rest_scale?, rounds_mult?, target_rpe_focus? }`.

## Adding a field WITHOUT drift
1. Add the field to the Zod schema here (one line, the canonical shape).
2. Mirror it in the Pydantic model in `apps/api` with the **same** name + JSON key.
3. Add a fixture value; the `contract.drift.test` round-trips it through both sides.
4. Regenerate `contract.snapshot.json` and run `just check-contract` (I3) — it must go green.

Do **not** hand-author `workout_run.beats` (I1: it is the output of `buildTimeline`).

_Status: T-00 scaffolds this package; T-01 authors the schema + drift test. STOP-A on merge._
