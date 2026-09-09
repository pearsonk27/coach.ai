# HIIT Workout App — Design & Data Model

> **Status: v4 · LOCKED.** §11 open questions accepted as defaults; audio-cue + music-ducking spec added
> (§2.9 / D10). **T-00 landed** (monorepo skeleton + `just` + CI; STOP-D signed off). Next: T-01 (`shared-types`).
> This doc is the source of truth for the MVP. Locked decisions are in §0.
>
> Stack (from `ai_native_monorepo_architecture_blueprint.md`): Turborepo + pnpm monorepo ·
> Web: Next.js + React + TS + Tailwind + TanStack Query + Zustand + Zod · Mobile: Expo + RN + TS ·
> Backend: FastAPI + uv + Pydantic v2 + SQLAlchemy + Alembic + pytest (Pyrefly type-checking) ·
> Contracts: `packages/shared-types` · Tests: Vitest + Playwright (web/mobile), pytest (API).

## 0 · Locked decisions
| # | Decision |
|---|---|
| 1 | Chromecast **MVP = tab-mirror** (T-60, ~0 code). Embedded Cast Receiver is v1.1. |
| 2 | **Solo + single cast display** for MVP. Multi-device class sync = F-05 (future). |
| 3 | **Flat 3+1 regimen.** 3 HIIT days per week = **Upper, Lower, Full-body**; + 1 Stretch Reset. `cycle_weeks = 1` (every week identical). A deload/periodized schedule is future (F-04 can produce it). |
| 4 | Sustained phases (warmup, static hold) are **single timed holds** (`rest_seconds = 0`). |
| 5 | Seeds: `hiit-upper-30`, `hiit-lower-30`, `hiit-full-body-30` (fixed 5-phase), `stretch-reset-15`; plan `fullbody-periodized`. |
| 6 | **Half-auth-free.** *Running/watching* a workout is auth-free (local run, or join by `room`-code). A **light user account** exists **only** to own the user's one playlist and later preferences. `user`/auth is MVP-light, not a full auth system. |
| 7 | **Music = the user's one playlist.** SoundCloud via **oEmbed of a public URL** — no OAuth/secret in MVP (see §2.8). |
| 8 | **Structure is a tag** (`fixed-hiit` / `freeform`), not a DB limit; upgrades via `structure_version`.
| 9 | **Audio cues + music-ducking** (D10; T-42 + T-43): generated Web-Audio cues — a **countdown over the last 10 s** of every work interval, an **exercise-done bell** on work→rest, and a **workout-end buzzer** — each **ducks the SoundCloud playlist** temporarily. No assets, muteable, graceful no-op. See §2.9. |

## 1 · Vision & MVP scope
A workout-class player. A run is started (locally or joined by a `room`-code); a large **Class
Display** (browser or Chromecast) auto-advances with a countdown + two progress bars. **No touches
during playback.** MVP: web + mobile + cast-to-TV + the user's playlist playing throughout + a
working 4/week regimen + end-of-run feedback.

### "Regularly changing workouts" — how we get there
Variety rides on the same atoms: templates are reusable, and a `WorkoutPlan` schedules them by slot
with **`params`** (`work_scale`/`rest_scale`/`rounds_mult`/`target_rpe_focus`) and `cycle_weeks`.
- **MVP variety** = the *emphasis* of each day (Upper / Lower / Full) — already in the seed.
- **Periodized weeks** (heavy → cardio → recovery) = a multi-week cycle + per-slot params — *data*,
  no per-week code. The AI loop (F-07 `evaluate`, F-04 `generate/improve`) later *tunes* templates
  and *swaps* slots automatically.
This is the answer to "can the workouts change over time": **the structure + composition are data;
the design already supports it.** (Verified in `seed/`.)

### Hard MVP requirements
Auto-advance · countdown · two progress bars · web · mobile · Chromecast · **user playlist
throughout** · flat 3+1 regimen · end-of-run RPE/rating feedback.

### Future (designed-in, not built)
Per-exercise GIFs (F-01) · body-maps of targeted muscles (F-02) · user preferences (F-03) ·
AI `generate` + `evaluate` + MCP tool (F-04/F-07) · multi-device class sync (F-05) ·
Google Fit / Fitbit health data (F-06) · OAuth auto-pull of the user's SoundCloud playlists (F-08).

## 2 · Key architectural decisions
- **D1 — Run = deterministic timeline.** `WorkoutRun` = a precomputed `Beat[]` + one `startedAtMs`.
   Any device derives state from `elapsed = now − startedAtMs`. Makes auto-advance, cast display,
   resume, and multi-device sync all trivial (no live transport required).
- **D2 — Pure `buildTimeline(template, params) → Beat[]`.** No I/O, unit-tested, materialized as
   JSON on the run (byte-identical for every device/room).
- **D3 — `shared-types` is the anti-drift contract** (Zod ⇄ Pydantic, CI fails on drift).
- **D4 — Content-as-data, AI-ergonomic.** Every entity the AI touches is plain JSON/REST.
- **D5 — Structure is a tag** (`fixed-hiit` / `freeform`), enforced in seed-validation + API,
   upgraded via `structure_version`. (See also I8.)
- **D6 — Periodization via `WorkoutPlan`.** Regimen = `plan_week[slot] → {template_slug, params}` +
   `cycle_weeks`. Scaling is pure `buildTimeline(params)`; variety + AI-driven change ride on it.
- **D7 — Music is a provider-abstracted, server-resolved resource.** A `MusicRef`
   `{provider, playlist_ref, volume, start_on}`; the API resolves it to a public embed
   (`GET /music/resolve`). MVP `provider: "user"` ⇒ use the user's one playlist.
- **D8 — "Public" lives on SoundCloud, not in our DB.** The MVP takes a **public SoundCloud URL**
   the user pastes (they share it in the SoundCloud app; we oEmbed it) — **no OAuth, no secret**.
   "Make it public" is a SoundCloud-side toggle, not a field we manage.
- **D9 — Half-auth scope boundary.** The **class display / playback path is auth-free**; only
   *owning a playlist* (and later preferences) needs the light user account. This keeps the
   Chromecast/TV path frictionless while still giving the user a "my playlist" surface.

### 2.8 Music model (SoundCloud) — grounded in current API reality
- **oEmbed** (`https://api.soundcloud.com/oembed?format=json&url=<public-URL>` / v2 oEmbed)
   embeds any **public** SoundCloud URL (track, set, playlist, user) **without a token**. This is the
   MVP path.
- **OAuth 2.1 + PKCE** (`api.soundcloud.com`, ~1h tokens, single-use refresh, header
   `Authorization: OAuth <token>`) is required to **list/fetch a user's own (possibly non-shared)
   playlists** — the **future** path F-08 (pulls in a server-held refresh token + rotation ⇒
   STOP-E/STOP-D).
- **User → Playlist is one-to-one (MVP):** each user has **one** configured playlist that plays on
   their runs. Modelled as `playlists` with `user_id UNIQUE`; a future multi-playlist is just
   dropping the uniqueness + adding a "primary" flag.

## 2.9 Audio cues + music-ducking (D10; T-42 owns the graph, T-43 plugs the player in)
- **Audio graph (`useAudioGraph`, T-42):** one `AudioContext` with a master `GainNode`; it routes the
    SoundCloud `MusicPlayer` (T-43) through a `musicGain` node and generated cues through `cuesGain`.
    A shared `duck(level, durationMs, rampMs)` lowers `musicGain` (e.g. to 30% of its level) with a
    short smooth in/out, then restores. This is **why T-43 depends on T-42**.
- **Cue types (generated with Web Audio — no asset files, no network):**
    - `interval-count` — during the **last 10 s of every work interval**, tick once per second (10→1);
       pitches 10→6 normal, **5→1 emphasized** (higher/longer). A short "get ready" tick on work start is optional.
    - `exercise-done` — a **bell** (pleasant chime, ~880→1320 Hz, ~0.5 s) when a work interval **ends**
       (the work→rest transition).
    - `workout-complete` — a **buzzer** (low square/triangle ~150 Hz, ~1.5 s) at **run end**, after the
       final phase.
    - (retained: `work→rest` / `rest→work` transition ticks.)
- **Ducking (the requested "lower the playlist volume temporarily"):** any of the above fires a
    `duck()` — default `duckLevel = 0.3`, `duckDurationMs ≈ 1200`, ramp ≈ 150 ms; during a 10-s countdown
    the music is **held-ducked** so counting is clear, restoring when the interval completes.
- **Defaults (locked):** count window = **10 s**; duck ≈ **30% × 1.2 s**. All later tunable via
    `user_preferences.audio` (F-03). **Global mute** silences cues **and** music. No assets/network;
    **graceful no-op** (no crash) if the `AudioContext` is unavailable or muted.

## 3 · Domain model (relationships)
```text
Exercise ──< exercise_muscle_group >── MuscleGroup      (targets; drives body-map + eval)
Exercise ──< exercise_equipment     >── Equipment       (availability; eval/eligibility)

WorkoutTemplate ──< WorkoutPhase ──< PhaseExercise ──> Exercise
    .structure ∈ {fixed-hiit, freeform}  .emphasis {upper|lower|full|recovery}  .music?

WorkoutPlan ──< PlanWeek ──< PlanSlot ──> WorkoutTemplate   (regimen; slot.params scale it)

User ──1─< Playlist (ONE per user, MVP)        # "make a playlist, set it to play"
WorkoutPlan/Template ──1─< WorkoutRun ──< WorkoutFeedback
WorkoutRun.beats JSONB (from template+params) + started_at_ms + status + source + playlist_id
User ──1─1 UserPreferences                       (future F-03)
Wearable / HealthMetric                           (future F-06)
WorkoutEvaluation                                 (future F-07, pure engine over beats+catalog)
```

## 4 · Database schema (Postgres; UUID PKs)
```sql
-- ---------- catalog ----------
CREATE TABLE equipment        (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, icon_name TEXT, is_builtin BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE muscle_group      (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, region TEXT NOT NULL);
CREATE TABLE exercise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL,
  cues JSONB NOT NULL DEFAULT '[]', difficulty SMALLINT NOT NULL DEFAULT 1, intensity SMALLINT NOT NULL DEFAULT 4,
  gif_url TEXT, is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE exercise_muscle_group (exercise_id UUID NOT NULL REFERENCES exercise ON DELETE CASCADE, muscle_group_id UUID NOT NULL REFERENCES muscle_group ON DELETE CASCADE, is_primary BOOLEAN NOT NULL DEFAULT false, PRIMARY KEY (exercise_id, muscle_group_id));
CREATE TABLE exercise_equipment     (exercise_id UUID NOT NULL REFERENCES exercise ON DELETE CASCADE, equipment_id UUID NOT NULL REFERENCES equipment ON DELETE CASCADE, PRIMARY KEY (exercise_id, equipment_id));

-- ---------- composition ----------
CREATE TABLE workout_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  description TEXT, goal TEXT, structure TEXT NOT NULL DEFAULT 'fixed-hiit',
  emphasis TEXT, total_seconds INTEGER NOT NULL, structure_version INTEGER NOT NULL DEFAULT 1,
  music JSONB, enabled BOOLEAN NOT NULL DEFAULT true, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE workout_phase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES workout_template ON DELETE CASCADE,
  position INTEGER NOT NULL,
  phase_type TEXT NOT NULL,
  title TEXT NOT NULL, description TEXT,
  rounds INTEGER NOT NULL DEFAULT 1, rest_seconds INTEGER NOT NULL DEFAULT 0,
  prep_seconds INTEGER NOT NULL DEFAULT 10, transition_seconds INTEGER NOT NULL DEFAULT 10,
  CHECK (rounds >= 1 AND rest_seconds >= 0 AND prep_seconds >= 0),
  UNIQUE (template_id, position)
);
CREATE TABLE phase_exercise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES workout_phase ON DELETE CASCADE,
  position INTEGER NOT NULL, exercise_id UUID NOT NULL REFERENCES exercise ON DELETE RESTRICT,
  work_seconds INTEGER NOT NULL, cue_override TEXT,
  CHECK (work_seconds > 0), UNIQUE (phase_id, position)
);

-- ---------- regiment (periodization, D6) ----------
CREATE TABLE workout_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  description TEXT, cadence JSONB,
  cycle_weeks INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true, source TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE plan_week (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES workout_plan ON DELETE CASCADE,
  week_index INTEGER NOT NULL, theme TEXT, description TEXT, UNIQUE (plan_id, week_index)
);
CREATE TABLE plan_slot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES plan_week ON DELETE CASCADE,
  slot INTEGER NOT NULL, kind TEXT NOT NULL, label TEXT,
  template_slug TEXT, params JSONB NOT NULL DEFAULT '{}',
  CHECK ((kind = 'rest' AND template_slug IS NULL)
       OR (kind <> 'rest' AND template_slug IS NOT NULL))
);

-- ---------- account + playlist (MVP-light, D9) ----------
CREATE TABLE "user" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE, name TEXT,
  soundcloud_handle TEXT,           -- display only in MVP; OAuth in F-08
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE playlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES "user" ON DELETE CASCADE,  -- ONE per user (MVP)
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'soundcloud',
  playlist_ref TEXT NOT NULL,      -- public SoundCloud URL (or /playlists/<id>) the user pastes
  volume REAL NOT NULL DEFAULT 0.3 CHECK (volume BETWEEN 0 AND 1),
  start_on TEXT NOT NULL DEFAULT 'run_start',  -- 'run_start' | 'on_join'
  is_default BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- runs + feedback (the AI-loop substrate) ----------
CREATE TABLE workout_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES workout_template ON DELETE CASCADE,
  plan_slot_id UUID, owner_user_id UUID REFERENCES "user" ON DELETE SET NULL,
  playlist_id UUID REFERENCES playlist(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  source TEXT NOT NULL DEFAULT 'solo',
  started_at_ms BIGINT, ended_at_ms BIGINT,
  duration_ms BIGINT NOT NULL, beats JSONB NOT NULL, music JSONB
);
CREATE TABLE user_preferences (
  user_id UUID NOT NULL REFERENCES "user" ON DELETE CASCADE, level TEXT NOT NULL,
  target_duration_seconds INTEGER, focus TEXT,
  target_muscle_groups TEXT[] DEFAULT '{}', avoid_muscle_groups TEXT[] DEFAULT '{}',
  equipment_slugs TEXT[] DEFAULT '{}', notes TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE workout_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workout_run ON DELETE CASCADE,
  user_id UUID, rpe SMALLINT, rating SMALLINT, notes TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  skipped TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- future (F-06 health, F-07 evaluation) ----------
-- health_metric (run_id, kind, value, source {google_fit,fitbit,manual}, captured_at)        F-06
-- wearable (user_id, provider, refresh_token_ref, last_sync_at, enabled)  + user_soundcloud_  F-08
-- workout_evaluation (id, target {template/plan/run}_id, findings JSONB, overall, eval_version,
--                     created_by, created_at)                                                F-07
```
**Design notes**
- `workout_run.beats` is materialized from `template + plan_slot.params` via `buildTimeline`
   (D1/D2/D6) → identical for every device/room.
- `workout_run.playlist_id` ⇒ the run plays that playlist (resolved via `GET /music/resolve`).
 A **solo run** attaches the owning user's one playlist; a **room run** attaches the host's
 (students follow → same audio). No playlist ⇒ silence.
- `music` on a template is a **default/fallback**; the user's `playlist` wins when present.
- **Anti-drift invariant (CI):** rebuilt `total_seconds` == stored `total_seconds`; `fixed-hiit`
 templates contain exactly the 5 phases in order; **catalog cross-check** (every referenced
 equipment/muscle-group/exercise/template slug resolves) — already enforced by the seed validator.

## 5 · UI / playback + Music
- **Class Display (`/play`, `/class?room=`, the TV surface):** big countdown, two progress bars
   (current + overall), current + up-next, color-blind-safe, dark high-contrast, auto-advances via
   D1 (T-21). **Chrome-free** on the TV.
- **Instructor remote (`/instructor`, small screen only, T-41):** start/pause/resume/end,
   jump-phase, ±30s. Not shown on TV.
- **Audio cues + music-ducking (T-42 + T-43; D10):** a shared `AudioContext` graph owns a
   `musicGain` (the SoundCloud `MusicPlayer`) and a `cuesGain` (generated cues). Cues: a **3-2-1-style
   countdown over the last 10 s** of every work interval (ticks; final 5 emphasized), an **exercise-done
   bell** on work→rest, and a **workout-end buzzer** at run completion. Every cue **ducks the
   MusicPlayer** (default to 30% for ~1.2 s, smooth in/out, then restore); during a 10-s countdown the
   music is held-ducked so counting is audible. **Global mute** silences cues + music. Full spec: §2.9.
- **Music (T-43, MVP):** `GET /music/resolve {ref | playlistId}` → public **SoundCloud oEmbed**.
   `<MusicPlayer playlist autoplayAt startMs volume loop muted>` in `packages/ui`, used by the
   Class Display. Public-by-design ⇒ **no secret** in MVP. Future F-08 = OAuth auto-pull.
- **Mobile (T-70):** reuse `shared-types`, `api-client`, the display component, the D1 clock, plus
   a **"My playlist" settings screen** (T-33): paste a public SoundCloud URL, set volume, save.
   Running a workout never requires login; only *saving* a playlist does.
- **Future visuals:** GIF `exercise.gif_url` (F-01); body-map = **SVG muscle regions** (F-02)
   driven by `muscle_group` — one component, far less art.

## 6 · API contract (OpenAPI → generated `api-client`)
```text
# content
GET    /templates                 list enabled
GET    /templates/{slug}         template + phases + denormalized catalog
GET    /plans  /  /plans/{slug}  regiment + weeks + slots
GET    /plans/{slug}/session?week=N&slot=M   -> resolved template+params+beats+playlist
# runs (auth-free; owner_user_id optional)
POST   /runs                      { roomCode?, templateSlug?, planSlotId?, ownerUserId?, params? }
GET    /runs/{id}                full run incl. materialized beats + status + playlist (cacheable)
POST   /runs/{id}/control         { action: pause|resume|end|jump-phase|nudge }
POST   /runs/{id}/feedback        { rpe, rating, notes, completed, skipped[] }   <-- AI input
# account + playlist (MVP-light, D9)
POST   /me                        { email }              -> light session (or signed token)
GET/PUT/DELETE /me/playlist       the user's one playlist  (validate SoundCloud URL server-side)
GET    /music/resolve             { ref | playlistId } -> { provider, embedUrl, volume, startOn, loop }
# future
GET    /templates/{slug}/evaluate | POST /workouts/evaluate   (F-07)
GET    /me/health  /  POST /me/health/sync                    (F-06)
POST   /me/soundcloud/authorize  ...                        (F-08)
```
All requests/responses are **Zod (TS) ⇄ Pydantic (API)**. Playlist URL validation is server-side
so a bad URL never reaches the TV embed uncaught.

## 7 · Verification + human-review design
See `standards/AGENTS.md` + `packages/prompts/run-next-task.md` — the mechanism you asked for:
the agent **finds the next slice → delivers TDD → runs the gate → updates docs → preps the next
task**, and **halts at human-review STOPs** (`S schema/migration`, `A API/contract`,
`E env/secret`, `D dependency`, `I AI write-path`, `C cast/egress`, `H health`). MVP notes:
- New **`/me` playlist endpoints** ⇒ STOP-A (new public surface).
- MVP has **no secret** (oEmbed public) ⇒ no STOP-E *yet*; OAuth in F-08 introduces STOP-E/STOP-D.

## 8 · Roadmap (agent-sized; one focused PR each). Full registry: `tasks/INDEX.md`.
| id | phase | task | deps | MVP? |
|---|---|---|---|---|
| T-00 | 0 Foundations | monorepo skeleton + `just` + CI | – | Y |
| T-01 | 0 | `shared-types` contract + TS⇄Pydantic drift test | T-00 | Y |
| T-10 | 1 Domain | Postgres schema + Alembic migration | T-01 | Y |
| T-11 | 1 | Seed catalog + 3 HIIT + stretch + plan from `seed/**` | T-10 | Y |
| T-20 | 2 Engine | pure `buildTimeline(template, params)` + table tests | T-01, T-10 | Y |
| T-21 | 2 | client `useWorkoutClock` (elapsed/progress/countdown) | T-01 | Y |
| T-30 | 3 API | content + run + feedback endpoints (§6) + OpenAPI | T-10, T-20 | Y |
| T-31 | 3 | generated `api-client` | T-30 | Y |
| T-33 | 3 | **light account + "My playlist" (one-to-one) + URL validation** | T-10 | Y |
| T-40 | 4 Web | `/play` + `/class` Class Display (D1 auto-advance, 2 bars) | T-21, T-30, T-31 | Y |
| T-41 | 4 | `/instructor` remote + keyboard controls | T-40 | Y |
| T-42 | 4 | **audio cues + music-ducking** (Web-Audio, muteable; owns the Audio graph) | T-40 | Y |
| T-43 | 4 | **music throughout run** (SoundCloud oEmbed, user playlist, duckable) | T-33, T-42 | Y |
| T-50 | 4 | `WorkoutPlan` **flat 3+1** + slot scaling + rotation | T-20, T-11 | Y |
| T-51 | 4 | "Today's session" web view from the plan | T-50, T-40 | Y |
| T-60 | 5 Cast | Chromecast **tab-mirror** | T-40 | Y |
| T-70 | 6 Mobile | Expo app (reuse shared-types + clock + display + "My playlist") | T-21, T-31, T-40, T-33 | Y |
| F-01 | 7 Future | per-exercise GIF overlay | T-40 | – |
| F-02 | 7 | body-map SVG muscle regions | T-40 | – |
| F-03 | 7 | user `user_preferences` | T-33 | – |
| F-04 | 7 | AI `generate` + MCP `create/improve` | F-03 | – |
| F-05 | 7 | multi-device class sync | T-40 | – |
| F-06 | 7 | Google Fit / Fitbit health connector | F-03 | – |
| F-07 | 7 | `workout_evaluation` engine + API + agent skill | T-20 | – |
| F-08 | 7 | **SoundCloud OAuth 2.1+PKCE auto-pull of the user's playlists** | T-33 | – |

**Eval criteria (F-07), seeded by your examples** — pure function over `beats` + catalog:
- **Equipment-change pacing:** consecutive exercises needing different equipment ⇒ require the rest
   gap ≥ `EQUIP_CHANGE_SECONDS` (default 30); else `warn("equipment change tight — Ns to swap")`.
- **Over-targeting:** per-session exposure per `muscle_group` > `GROUP_EXPOSURE_CAP` ⇒ `warn`.
- **Under-targeting (plan-level):** across a `workout_plan` cycle, target groups under-worked, or a
   week with no recovery slot ⇒ `warn`/`fail`. (On the seed, flat 3+1 → the single stretch reset
  *is* the week's recovery slot ⇒ passes.)
Findings JSON (`{severity, rule, target, detail, suggestion}`) powers both a human screen and the
AI `improve-workout` skill.

## 9 · Testing (per blueprint)
- **Unit:** `buildTimeline`, `useWorkoutClock`, `evaluate`, formatting, audio triggers,
   TS⇄Pydantic contract, **seed cross-validation**.
- **Integration:** API endpoints; DB migrate+seed; `/music/resolve` with **mocked** oEmbed;
    `playlist` URL validation.
- **E2E (critical only):** `/play` auto-advances with **no input** over a short fake run;
    instructor control on a run; "My playlist" save reflects on a run.
- **Anti-drift CI:** rebuild `total_seconds` vs stored; contract snapshot; seed cross-validation;
   `fixed-hiit` phase-order; `.env.example` alignment; lockfiles; no `pip`/`npm install`.

## 10 · Suggested improvements
- **Join-by-`room`-code** — a class = "teacher starts, students join," no auth (MVP-friendly).
- **Offline solo cache** — D1 makes the class survive bad WiFi (mobile-first need).
- **Capture RPE + skipped-exercises immediately** — highest-ROI input for "better workouts."
- **Body-map = SVG regions, not per-exercise art** (F-02) — far less to author/maintain.
- **Adaptive pacing via `params`** (D6) — keeps the fixed structure, varies intensity per day/user.
- **Accessibility:** countdown ≥ ~8% of TV height, high contrast, reduce-motion, mono clock font;
   skip/hold hints live only in instructor mode.
- **Structured run-lifecycle events** (started/paused/completed) from day one.
- **Playlist: prefer "public URL paste" over OAuth in MVP** — fewer moving parts, no secret, and
    the user already controls publicness on SoundCloud; OAuth auto-pull is a strict upgrade (F-08).

## 11 · Open questions (§11) — **LOCKED as of v4**
All five accepted as defaults on approval:
1. **Load:** ~82 min HIIT/week + 1 stretch is fine as a starting point (AI/`evaluate` tunes later).
2. **Music:** paste a **public** SoundCloud URL, **one playlist per user**, **no OAuth** in MVP (F-08 later).
3. **Audio on TV:** the run's device/tab-mirror provides sound in MVP (acceptable; a real cast
   receiver is future).
4. **Eval thresholds:** equipment-change gap ≥ **30 s**; soft per-session **group-exposure cap** — defaults accepted.
5. **Half-auth split (§D9):** starting/watching a workout is **auth-free**; only *owning a playlist* uses the light account — accepted.
   New addition: **audio cues + music-ducking** locked per §2.9 (10-s countdown, exercise-done bell,
   workout-end buzzer, duck playlist to ~30% for ~1.2 s).
