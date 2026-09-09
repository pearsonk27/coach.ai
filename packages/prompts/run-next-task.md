# run-next-task — orchestrating loop

> Use this to keep the project moving one deliverable at a time. A human (or a loop)
> points an agent at it; the agent always picks the smallest ready slice, implements +
> tests it, then leaves the registry updated so the **next** task is ready. Pairs with
> `standards/AGENTS.md`.

```text
CONTEXT (always load first):
 1. standards/AGENTS.md             (rules, invariants, gates, STOPs)
 2. docs/HIIT_WORKOUT_APP_DESIGN.md (source of truth; read §11 open questions)
 3. tasks/INDEX.md                  (registry: status, deps, review_stops per task)

FIND THE NEXT SLICE:
 1. Open tasks/INDEX.md.
 2. A task is "ready" when status == "ready" AND every dep in its "deps" is "done".
    If a dep isn't done, do NOT start it — do a ready dep first, or report a blocker.
 3. Pick the lowest-id ready task. Read its card in tasks/backlog/<id>.md, and move it
    to tasks/active/ with status: active.
 4. If none is ready, report the blocker precisely and stop.

DELIVER IT (TDD, smallest correct change):
 1. Write a failing unit/integration test FIRST (skip for pure scaffolding/docs; say so).
 2. Implement the minimal change to make the test pass. Touch only this task's surface.
 3. Honor every invariant in AGENTS.md §Invariants (I1–I8).

VERIFY (record in the card's "handoff" section — exact commands + results):
  just format && just lint && just typecheck && just test && just build
  just check-contract && just check-invariants && just check-env
  <the task's specific test(s)>
  If a gate isn't runnable yet, say which and why; do NOT mark done until they can run green.

MAKE THE NEXT TASK READY:
 1. Set status: done in INDEX.md; move the card to tasks/completed/ with a handoff note
    (what changed, test names, files, remaining TODO).
 2. Update docs/HIIT_WORKOUT_APP_DESIGN.md or the relevant CONTEXT.md so the world matches code.
 3. Advance the "next ready" task: if its deps are now satisfied, set its status to ready.

STOP FOR HUMAN REVIEW when a review_stop applies (S schema/migration, A API/contract,
 E env/secret, D new dependency, I AI write-path, C cast/device/egress, H health).
 When a STOP applies: HALT before committing, print a review request (the change, why it
 stopped, the risk, your recommendation), and wait for the human. Do not commit a STOP change.
```

## Variants
- `--mvp`   — pick the lowest-id ready task with `mvp: Y`.
- `--prep F-07` — do only the prep (e.g. author the `evaluate` engine + test) without landing it.
- `review-stop <id>` — jump to a task expected to trip a human-review STOP and prepare the report.
