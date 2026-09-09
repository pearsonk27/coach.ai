# Task Index
**One task = one focused PR + one doc update, per `next-task.md`.** This is the registry the
agent reads to find the **next deliverable slice** and re-runs after each task. Task files live in
`tasks/backlog` → `tasks/active` → `tasks/completed`. A full card lives next to its id; this
index is the index. (See `../docs/HIIT_WORKOUT_APP_DESIGN.md` for prose, `../standards/AGENTS.md`
for rules, `../.pi/prompts/next-task.md` for the loop.)

Columns: **status** (`backlog|ready|active|completed|blocked`) · **deps** · **mvp** (`Y`/`–`) ·
**stops** (`S,A,E,D,I,C,H`, else `–`).

| id      | title                                                          | status    | deps              | mvp | stops |
|---------|--------------------------------------------------------------|-----------|------------------|-----|-------|
| T-00    | Monorepo skeleton + `just` + CI                               | done     | –                 | Y    | D      |
| T-01    | `shared-types` + TS⇄Pydantic contract + drift test           | **done**     | T-00              | Y    | A      |
| T-10    | Postgres schema + Alembic migration                           | **ready**   | T-01              | Y    | S      |
| T-11    | Seed catalog + 3 HIIT + stretch + plan from `seed/**`        | blocked   | T-10              | Y    | S      |
| T-20    | `buildTimeline(template, params)` + table-driven tests        | blocked   | T-01, T-10        | Y    | –      |
| T-21    | Client `useWorkoutClock` (D1: elapsed/progress/countdown)    | ready     | T-01              | Y    | –      |
| T-30    | API runs/content/feedback + OpenAPI                           | blocked   | T-10, T-20        | Y    | A      |
| T-31    | Generated `api-client` + contract drift test                  | blocked   | T-30              | Y    | A      |
| T-33    | Light account + "My playlist" (one-to-one) + URL validation   | blocked     | T-10              | Y    | A      |
| T-40    | Web `/play` + `/class` Class Display (auto-advance, 2 bars)  | blocked   | T-21,T-30,T-31    | Y    | C      |
| T-41    | `/instructor` remote + keyboard controls                      | blocked   | T-40              | Y    | C      |
| T-42    | Audio-cue + music-ducking system (Web-Audio, muteable)       | blocked   | T-40              | Y    | –      |
| T-43    | Music throughout run (SoundCloud oEmbed, duckable)            | blocked   | T-33,T-42         | Y    | D      |
| T-50    | `WorkoutPlan` flat 3+1 + slot scaling + rotation             | blocked   | T-20,T-11         | Y    | A,S    |
| T-51    | "Today's session": web view from the plan                    | blocked   | T-50,T-40         | Y    | –      |
| T-60    | Chromecast tab-mirror (zero-code path)                       | blocked   | T-40              | Y    | C      |
| T-70    | Expo mobile: reuse shared-types + clock + display + playlist  | blocked   | T-21,T-31,T-40,T-33 | Y | –       |
| F-01    | Per-exercise GIF overlay on the display                       | backlog   | T-40              | –    | A,C    |
| F-02    | Body-map SVG muscle regions                                   | backlog   | T-40              | –    | C      |
| F-03    | User `user_preferences` surface + API                         | backlog   | T-33              | –    | A,S    |
| F-04    | AI `generate` + `improve` + MCP tool                         | backlog   | F-03,F-07         | –    | I      |
| F-05    | Multi-device class sync (D1 `elapsed`)                        | backlog   | T-40              | –    | C,A    |
| F-06    | Google Fit / Fitbit health connector + metrics storage        | backlog   | F-03              | –    | H,D,E |
| F-07    | `workout_evaluation` engine + API + agent skill              | backlog   | T-20              | –    | I      |
| F-08    | SoundCloud OAuth 2.1+PKCE — auto-list user's playlists        | backlog   | T-33              | –    | D,E    |

**How the "3 × 30 + 1 × 15" regimen rides here:** `T-50` builds the flat 3+1
(upper → lower → full → stretch reset, `cycle_weeks=1`); `T-11` seeds the 4 templates + the plan;
`T-20`/`T-30` make the scaling + "session" endpoints real. The seed already runs it.

## Next ready slice
- **Now:** `T-00` and `T-01` are **DONE**. T-01 (the canonical `shared-types` contract: Zod
    schemas + Pydantic mirror + language-neutral snapshot + a runnable-now I3 drift guard with a
      `--mutate` sensitivity sweep) **passed `just check-contract`** and was **signed off at
      `2026-07-09`** (STOP-A). Its handoff + decisions are in `completed/T-01.md`.
- **Next lowest-id `ready` task with all deps `done` is `T-10`** (Postgres schema + Alembic
      migration; STOP-S). T-21 (`useWorkoutClock`) is `ready` too but has a higher id. T-20/T-30/
       T-31 stay `blocked` on T-10/T-20; T-33 was flipped to `blocked` (its dep T-10 isn't done).
- Note: `just` recipes use the **hyphen** form (`just check-env`, `just check-contract`, …); the
  old `check:` colon notation is not a valid `just` name.
- After a task completes, re-run `next-task.md`: it scans this index, picks the next
      `ready` + all-deps-`done` at lowest id, and delivers it.

