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
| T-40     | Web `/play` + `/class` Class Display (auto-advance, 2 bars)     | **done** | T-21,T-30,T-31       | Y     | C       |
| T-41     | `/instructor` remote + keyboard controls                        | **done** | T-40                  | Y     | C       |
| T-42     | Audio-cue + music-ducking system (Web-Audio, muteable)          | **done** | T-40                  | Y     | –       |
| T-43     | Music throughout run (SoundCloud oEmbed, duckable)              | **done** | T-33,T-42            | Y     | D       |
| T-51     | "Today's session": web view from the plan                       | **done** | T-50,T-40            | Y     | –       |
| T-60     | Chromecast tab-mirror (zero-code path)                          | **done** | T-40                  | Y     | C       |
| T-70     | Expo mobile: reuse shared-types + clock + display + playlist     | **partial** | T-21,T-31,T-40,T-33  | Y     | –       |
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

## Done this cycle (agent · web/MVP closeout · `just gates` green 7/7, Python 45 passed / 3 skipped)
**Web + mobile UI MVP is built and typecheck/build-clean.** Built on the already-green backend
(core) this session, the web surfaces + the shared pure core landed:

- **T-40** **done** — `apps/web` Class Display (`/play`, `/class`): big countdown ring, current beat,
   up-next strip, two progress bars, auto-advance via the live clock. Renders offline from a demo run;
   fetches real beats at runtime from `GET /api/content/workouts/{slug}/beats`. Next `next @16.3.5`
   build prerenders all 9 routes.
- **T-41** **done** — `/instructor` remote: keyboard (Space/→/±30s/Esc) + on-screen buttons apply
   control to the store and POST `POST /api/runs/{rid}/control` (new endpoint on `accounts.py`).
- **T-42** **done** — music-ducking + cue system. **Pure** scheduling/ducking math is in
   `@coach/ui` (`audio-cues.ts`: `planCues/duckWindows/duckLevelAt/cuesInWindow/rampEnvelope`) with a
   Node test suite; the React `useAudioGraph` (Web Audio: cue tones on `cuesGain`, music ducked to
   ~30% on the countdown, muteable) composes it. No music ⇒ no `AudioContext` ⇒ silent no-op, never
   crashes the play loop.
- **T-43** **done (MVP stub)** — `MusicPlayer` + `GET /api/music/resolve` (hermetic oEmbed echo) +
   playlist CRUD `GET/PATCH/DELETE /api/music` on `store.py`. **Caveat:** real SoundCloud oEmbed +
   OAuth are deferred (F-08); the MVP uses a demo embed + the gain-ducking path, not a live track.
- **T-51** **done** — `/today` view + `GET /api/plans/{slug}/session?date=` (pure `todaySession`
   resolver in `@coach/ui`, Node-tested). Rotates the flat 3+1 plan by ISO day-of-week.
- **T-60** **done (MVP stub)** — `/cast` tab-mirror: a self-documenting cast surface that opens the
   display in a new tab. **Caveat:** true Chromecast device control (`cast_sender.js`) is deferred.
- **T-70** **partial** — `apps/mobile` typecheck-only shell reusing `@coach/ui`'s clock/cue/duck/
   today core (the architectural point of T-70) **without** the Expo/RN runtime (intentional, lean —
   can't build/test headlessly). **Caveat:** the RN `App.tsx` screens are the next step.

**Contract + gate work:** extended the shared contract with `MusicResolveResponse` across all six
artifacts (TS/Snapshot/Pydantic/fields) — `just contract-drift` stays 5/5. Accepted
`@coach/web: @types/node` (devDep) to keep the Next TS toolchain's lock stable (types-only, no
runtime). No new third-party runtime deps for the web path (native Web Audio, plain CSS, zustand,
direct `fetch`).

## Prior cycles (agent · backend core)
T-01b · T-11 · T-20 · T-21 · T-30 · T-31 · T-33 · T-50 · T-99. See **`HANDOFF.md`**.

## What's next (MVP complete · headless closeout)
The MVP web/mobile surfaces are built (`just gates` 7/7, `just check-all` PASS, Python 45/3-skipped).
Remaining work is polish + the deferred real-integration stubs, all post-MVP:
- **Defer (documented):** real SoundCloud oEmbed + OAuth (F-08) in place of the T-43 demo embed; true
    Chromecast device control via `cast_sender.js` in place of the T-60 tab-mirror; the RN `App.tsx`
   screens for T-70 (the shared-core reuse is in place and typechecks).
- **Polish / F-line:** F-01 (per-exercise GIF overlay), F-02 (body-map), F-03 (preferences surface),
    F-04 (AI generate/improve + MCP), F-05 (multi-device class sync), F-06 (Fit/Fitbit connectors),
     F-07 (workout evaluation). These need human gates (A/C/D/E/I) or are deliberately deferred, per
      `next-task.md` / the no-human-gates directive.
- **Open (unchanged, T-10):** `user_preferences.{target,avoid}_muscle_groups` + `equipment_slugs` and
     `workout_feedback.skipped` are `TEXT[]` now; T-10 finalizes DDL + shape tests (agent chose
      **B = CHECK-constrained slug arrays** for the MVP; ratified for the no-human-gates directive).
- **Deps still not installed (intentional, lean):** `zod` (drift-guard TS introspection layer) and
     `react-native` / `*expo*` (RN runtime). Pure cores are done + typechecked; the real runtime
     layers are deferred. `react` / `zustand` / `next` **are installed** (the web builds).
