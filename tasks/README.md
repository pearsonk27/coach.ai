# Task lifecycle

One **task** = one focused PR = one smallest correct change. Tasks live in a lifecycle the agent
moves through automatically; humans approve STOPs.

## Folders
- `backlog/`  — not yet active.
- `active/`   — currently being delivered.
- `completed/`— delivered + gated + handoff written.
- `INDEX.md`  — the single authoritative registry (status, deps, MVP?, review_stops, one-liner).
   When a card's detail is missing, generate it from `docs/HIIT_WORKOUT_APP_DESIGN.md` §8 + the
   INDEX row.

## Task card frontmatter
```yaml
id: T-43
title: Music through run (SoundCloud /music/resolve)
status: ready            # backlog | ready | active | done | blocked
deps: [T-30, T-40]       # must be `done` before this is `ready`
mvp: true                # true ⇒ ships in MVP
review_stops: [E, C]     # subset of S,A,E,D,I,C,H (see AGENTS.md). Halts for human.
```

## Body of a card
- **Goal** — one paragraph (link to design section).
- **Contract** — exact types / endpoints / files this task owns.
- **Acceptance criteria** — bullet list, each independently verifiable.
- **Tests required** — named unit/integration/e2e tests.
- **Verification** — which `just` gates apply (all, by default).
- **Handoff** — filled in at completion: what changed, tests, files, TODOs.

## "Next task is ready" rule
A task becomes `ready` when its `deps` are all `done`. After completing a task, the agent (or
loop running `packages/prompts/next-task.md`) sets each unblocked successor to `ready`.
**Never** start a task whose deps are not `done`.
