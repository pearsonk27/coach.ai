# coach.ai

A web + mobile + TV-castable **HIIT class player** with a precomputed, deterministic run
timeline, a periodized regiment, music throughout, and a clean write-path for an AI to
generate better workouts. See `docs/HIIT_WORKOUT_APP_DESIGN.md` (source of truth) and
`standards/AGENTS.md` (operating rules).

## Unified commands (`just`)

The `just` interface mirrors `standards/AGENTS.md` §Gating exactly.

\```bash
just format   just lint   just typecheck   just test   just build   just dev
# or all pipeline gates in order:
just gates
just check-env         # I5  (.env.example ⊇ code-read env vars)
just check-contract    # I3  (Zod ⇄ Pydantic snapshot)
just check-invariants  # I1/I2/I4 over seed/**
just check             # run all three
\```

On a not-yet-installed tree the turbo-backed gates **SKIP cleanly** (turbo isn't present yet)
so the skeleton is runnable; after STOP-D sign-off + `just install`, they execute the real
pipeline.

## Layout
- `apps/{api,web,mobile,docs}` — user-facing (api = FastAPI+uv; web = Next; mobile = Expo).
- `packages/{ui,shared-types,api-client,prompts,testing}` — shared code + contracts + prompts.
- `seed/**` — the catalog + templates + plan the app plays (content-as-data, D4).
- `tasks/` — the task registry + lifecycle (backlog → active → completed).

## How work moves
Run `packages/prompts/run-next-task.md`: pick the lowest-id `ready` task whose deps are
`done`, deliver it TDD, run the gates, update docs, and prep the next task. Halt at any
human-review STOP (S/A/E/D/I/C/H).
