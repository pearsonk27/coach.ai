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

_Status: T-01 (active, STOP-A pending sign-off). T-00 created the package; T-01 authors the contract + guard.

## Contract: the canonical shared data shape (T-01)

`packages/shared-types` (T-01) is the **cross-language contract** for the AI-loop substrate (D1)
— the `WorkoutRun`/`Beat` model plus composition + catalog shapes — authored on two sides that
must stay identical at the JSON wire level:

- **TS side** — `src/*.z.ts` Zod schemas + `src/index.ts` (re-exports + `z.infer` types). The
    **source of truth in the monorepo**.
- **Py side** — `apps/api/app/contracts/schema.py` Pydantic v2 mirror, camelCase-wire via a
    `to_camel` `alias_generator` (snake in Python, camel over JSON, like a Django serializer).
- **Canonical snapshot** — `contract.snapshot.json`: a language-neutral descriptor of every type,
    value-set, the Beat union, and a field-by-field TS⇄Py key map. Both sides are asserted
    against it, so the languages can't silently diverge.

### I3 drift guard (runnable now)
`scripts/contract-drift.cjs` (wired as `just check-contract` + CI `check:contract` /
`check:contract-mutations`) proves three things **with no runtime installed**:

1. **3-way agreement** — for every type, the normalized key/enum **signature is identical across
    the TS manifest, the Py manifest, and the canonical snapshot**; a canonical
    `workout_run.json` fixture round-trips and conforms to the Beat union.
2. **Sensitivity** — a `--mutate <name>` sweep proves each deliberate one-sided divergence
    (`drop-ts`, `drop-py`, `drop-snapshot`, `enum-drift-py`, `add-ts`) **breaks** the agreement,
    so a drift can't pass undetected; CI runs the whole sweep as its own step.
3. **Guarded runtime layers** — when `zod`/`pydantic` install, introspection layers activate
    (`z.toJSONSchema` / `safeParse`; `model_json_schema`); when `python3` is present, the mirror
    is `py_compile`-checked. Until then they **SKIP green** (documented, not fake-red).

The typed `test/contract.drift.test.ts` mirrors the 3-way + sensitivity assertions in TS
(zero-dep; runs once a TS runner lands in T-31). The live gate is `.cjs` harness → `pnpm -r test`.

### Bootstrap decision (recorded, STOP-A) — manifest is hand-synced today
The two manifests (`contract.fields.ts.json`, `contract.fields.json`) are **bootstrap hand-synced**
by the author because `zod`/`pydantic` aren't installed yet and `pnpm install`/`uv sync` are not
wired in this branch (a STOP-D addendum, T-31 / T-10). The guard treats the **snapshot as
canonical** and asserts both manifests match it. When runtimes land, the manifests must be
**regenerated** from `zod`'s `z.toJSONSchema` and Pydantic's `model_json_schema(by_alias=True)` so
agreement is enforced *against actual schema introspection* — not two JSON files that could drift
together. Flag that upgrade at T-10/T-31.

### Why STOP-A
T-01 **creates the public contract that every downstream task imports** (D1/D2/D6), so the sign-off
is that the shape, the key mapping (camel JSON ⇄ snake Python ⇄ `PhaseExercise.exercise` ⇄
runtime `Beat.exerciseRef`), and the Beat union are correct *in spirit* before T-10/T-20 depend on
it. (The key mapping is frozen in the snapshot's `keyAliasByType` block.)

## Decision Log
| when | who | decision/reason |
|------|-----|-----------------|
| T-00 | 2026-07-09 | Agent: created this CONTEXT.md |
| T-01 | 2026-07-09 | Agent: full canonical contract + Pydantic mirror; I3 drift guard runnable-now with guarded runtime layers; manifest bootstrap hand-synced (STOP-A/D-addendum), regenerate on runtime install |
