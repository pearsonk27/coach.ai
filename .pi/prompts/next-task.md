# Prompt · run-the-next-slice (reusable orchestrator)

> Use this to keep the project moving one deliverable at a time. A human (or a loop) points an
> agent at it; the agent always picks the smallest ready slice, implements+tests it, then leaves
> the registry updated so the **next** task is ready. Designed to pair with `standards/AGENTS.md`.

```text
You are an engineer on the coach.ai HIIT workout app. Work ONE task at a time. Do not start the
app; do not skip gates. Follow these steps exactly.

CONTEXT (always load first):
  1. standards/AGENTS.md            (rules, invariants, gates, STOPs)
  2. docs/HIIT_WORKOUT_APP_DESIGN.md (source of truth; read §11 open questions)
  3. tasks/INDEX.md                 (the registry: status, deps, review_stops per task)

FIND THE NEXT SLICE:
  1. Open tasks/INDEX.md.
  2. A task is "ready" when status == "ready" AND every dep in its "deps" is "done".
     (If a dep isn't done, do NOT start it — either do a ready dep first, or report a blocker.)
  3. Pick the lowest-id ready task. Read its card in tasks/backlog/<id>.md (create it from the
     design doc + INDEX row if the card is missing).
  4. If none is ready, report the blocker precisely and stop.

DELIVER IT (TDD, smallest correct change):
  1. Move the card to tasks/active/ and set status: active in INDEX.md.
  2. Write a failing unit/integration test FIRST for the behaviour you're adding (skip for pure
     scaffolding/docs tasks, and say so).
  3. Implement the minimal change to make the test pass. Touch only this task's surface.
  4. Honor every invariant in AGENTS.md §Invariants (I1–I8).

VERIFY (record in the card's "handoff" section — copy the exact commands + results):
  just format && just lint && just typecheck && just test && just build
  just check:contract && just check:invariants && just check:env
  <the task's specific test(s)>
  If the pipeline is not yet configured, say which gates are not runnable and why; do NOT mark
  done until they can run green.

MAKE THE NEXT TASK READY:
  1. Set this task's status to done in INDEX.md; move the card to tasks/completed/ with a
     "handoff" note (what changed, test names, files, remaining TODO).
  2. Update docs/HIIT_WORKOUT_APP_DESIGN.md or the relevant CONTEXT.md so the world matches code.
  3. Advance the "next ready" task: if its deps are now satisfied, set it status: ready.

STOP FOR HUMAN REVIEW when any of this task's review_stops apply
  (S schema/migration, A API/contract, E env/secret, D new dependency, I AI write-path,
   C cast/device/egress, H health data). When a STOP applies: HALT before committing, print a
   review request: the change, why it stopped, the risk, and your recommendation. Wait for the
   human. Do not commit the STOP change unilaterally.

OUTPUT (your final message):
  - Task id + one-line what was delivered.
  - Exact verification results per gate.
  - Files changed.
  - Any STOPs hit + your recommendation.
  - The next ready task id, or "BLOCKED: <reason>".
```

## Variants

- `run-the-next-slice --mvp` — pick the lowest-id ready task that is MVP=Y.
- `run-the-next-slice --prep F-07` — do only the prep work (e.g. author the `evaluate` engine +
   test) for a future task without landing it.
- `review-stop <id>` — jump to a task that is expected to trip a human-review STOP and prepare the
   STOP report.
