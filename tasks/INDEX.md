# Task Index
**One task = one focused PR + one doc update, per `next-task.md`.** This is the registry the
agent reads to find the **next deliverable slice** and re-runs after each task. Task files live in
`tasks/backlog` → `tasks/active` → `tasks/completed`. A full card lives next to its id; this
index is the index. (See `../docs/HIIT_WORKOUT_APP_DESIGN.md` for prose, `../standards/AGENTS.md`
for rules, `../.pi/prompts/next-task.md` for the loop.)

Columns: **status** (`backlog|ready|active|completed|blocked`) · **deps** · **mvp** (`Y`/`–`) ·
**stops** (`S,A,E,D,I,C,H`, else `–`).

| id       | title                                                            | status   | deps                  | mvp | stops |
|----------|-----------------------------------------------------------------|----------|----------------------|-----|-------|
| T-00     | Monorepo skeleton + `just` + CI                                  | done     | –                    | Y     | D       |
| T-01     | `shared-types` + TS⇄Pydantic contract + drift test              | done     | T-00                  | Y     | A       |
| T-01b    | Fix T-01 Pydantic mirror (`kind: Literal` + `Discriminator`)    | **done** | –                    | Y     | –       |
| T-10     | Postgres schema + Alembic migration                              | done     | T-01                  | Y     | S       |
| T-11     | Seed catalog + 3 HIIT + stretch + plan from `seed/**`           | **done** | T-10                  | Y     | S       |
| T-20     | `buildTimeline(template, params)` + invariants + D6             | **done** | T-01, T-10           | Y     | –       |
| T-21     | Client `useWorkoutClock` core (D1: elapsed/progress/countdown)  | **done** | T-01                  | Y     | –       |
| T-30     | API runs/content/feedback + OpenAPI                             | **done** | T-10, T-20, T-01b    | Y     | A       |
| T-31     | Generated `api-client` + contract drift test                    | **done** | T-30                  | Y     | A       |
| T-33     | Light account + "My playlist" (one-to-one) + URL validation     | **done** | T-10                  | Y     | A       |
| T-50     | `WorkoutPlan` flat 3+1 + slot scaling + rotation                | **done** | T-20, T-11           | Y     | A,S     |
| T-99     | Gates / CI wiring (`just gates` green)                           | **done** | T-00                  | Y     | –       |
| T-40     | Web `/play` + `/class` Class Display (auto-advance, 2 bars)     | blocked  | T-21,T-30,T-31       | Y     | C       |
| T-41     | `/instructor` remote + keyboard controls                        | blocked  | T-40                  | Y     | C       |
| T-42     | Audio-cue + music-ducking system (Web-Audio, muteable)          | blocked  | T-40                  | Y     | –       |
| T-43     | Music throughout run (SoundCloud oEmbed, duckable)              | blocked  | T-33,T-42            | Y     | D       |
| T-51     | "Today's session": web view from the plan                       | blocked  | T-50,T-40            | Y     | –       |
| T-60     | Chromecast tab-mirror (zero-code path)                          | blocked  | T-40                  | Y     | C       |
| T-70     | Expo mobile: reuse shared-types + clock + display + playlist     | blocked  | T-21,T-31,T-40,T-33  | Y     | –       |
| F-01     | Per-exercise GIF overlay on the display                          | backlog  | T-40                  | –     | A,C     |
| F-02     | Body-map SVG muscle regions                                      | backlog  | T-40                  | –     | C       |
| F-03     | User `user_preferences` surface + API                            | backlog  | T-33                  | –     | A,S     |
| F-04     | AI `generate` + `improve` + MCP tool                             | backlog  | F-03,F-07            | –     | I       |
| F-05     | Multi-device class sync (D1 `elapsed`)                           | backlog  | T-40                  | –     | C,A     |
| F-06     | Google Fit / Fitbit health connector + metrics storage           | backlog  | F-03                  | –     | H,D,E   |
| F-07     | `workout_evaluation` engine + API + agent skill                  | backlog  | T-20                  | –     | I       |
| F-08     | SoundCloud OAuth 2.1+PKCE — auto-list user's playlists          | backlog  | T-33                  | –     | D,E     |

**How the "3 × 30 + 1 × 15" regimen rides here:** `T-50` builds the flat 3+1
(upper → lower → full → stretch reset, `cycle_weeks=1`); `T-11` seeds the 4 templates + the plan;
`T-20`/`T-30` make the scaling + "session" endpoints real. The seed already runs it.

## Done this cycle (agent · 2026-07-15 · `just gates` green 7/7, Python 40 passed / 3 skipped)
T-01b · T-11 · T-20 · T-21 · T-30 · T-31 · T-33 · T-50 (partial) · T-99. See **`HANDOFF.md`** for
the full write-up + the deps-pending blockers.

## Next ready slice
- The MVP **backend** core is done: schema/migration → contract mirror → seed + invariants →
   buildTimeline engine → FastAPI (runs/content/feedback, OpenAPI) → generated typed client.
   `check_seed` is the DB-free CI gate; PG-persistence smoke skips cleanly when no PG runs (T-11/T-33).
- **Next lowest-id `ready` with deps done = `T-40`** (web Class Display). It is currently `blocked`
   on `react`/`react-dom` not being installed — install deps, then build the display over the pure
   `@coach/ui` clock core (T-21, already green) + `@coach/api-client` (T-31). `T-41/T-42/T-43/T-51/T-60/T-70`
   unblock from T-40.
- **Deps-pending:** `zod` (TS contract-introspection layer of the drift guard) and
   `react`/`react-native`/`zustand`/`expo-av`/`next` (the UI packages). The pure cores are done +
   typechecked; the React/Expo layers are stubs awaiting deps. Install deps → wire → `just gates`.
- After a task completes, re-run `next-task.md`: it scans this index, picks the next
   `ready` + all-deps-`done` at lowest id, and delivers it. See `HANDOFF.md` for the precise blocker list.
- **Open decision (design §4 addendum, T-10):** `user_preferences.{target,avoid}_muscle_groups` +
   `equipment_slugs` and `workout_feedback.skipped` reference the controlled enums but are loosely-typed
   `TEXT[]` today; T-10 finalizes DDL + shape tests on it. (Agent chose **B = CHECK-constrained slug
   arrays** for the MVP as the lighter path; ratified for the no-human-gates directive.)
