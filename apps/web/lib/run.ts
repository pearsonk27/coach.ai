// lib/run.ts -- produce a renderable run without a live API (offline demo), plus the fetch layer.
//
// The demo uses a valid clock.Beat[] so /play + /class render with zero network (no fetch at build
// time). Live runs come from `GET /api/content/workouts/{slug}/beats`. `sendControl` is the T-41
// instructor remote's wire.
import type { Beat } from "@coach/ui";
import { apiUrl } from "./env";
import type { ControlState } from "./types";

function beat(kind: Beat["kind"], startMs: number, durMs: number, extra: object = {}): Beat {
   return { id: "b" + startMs, kind, startMs, endMs: startMs + durMs, durationMs: durMs, ...extra } as unknown as Beat;
}

// A short, valid HIIT-ish run: intro -> 3x work/rest -> cooldown. Titles ride `extra` for the UI.
export function demoBeats(): Beat[] {
   const out: Beat[] = [];
   let t = 0;
   out.push(beat("phase-intro", t, 5000, { title: "Warm up", cue: "Ease in" }));
   t += 5000;
   const rounds: [string, string][] = [
      ["goblet-squat", "Drive"],
      ["incline-pushup", "Explode"],
      ["kettlebell-swing", "Hip hinge"],
    ];
   for (let r = 0; r < rounds.length; r++) {
      out.push(beat("work", t, 40000, { exerciseRef: rounds[r][0], cue: rounds[r][1], round: r + 1 }));
      t += 40000;
      out.push(beat("rest", t, 15000, { cue: "Recover, next up" }));
      t += 15000;
     }
   out.push(beat("cooldown-hold", t, 30000, { title: "Cool down", cue: "Breathe" }));
   return out;
}

export function demoRunId(): string {
   return "demo-" + demoBeats().length;
}

// The wire Beat contract is durationMs-only (beatBase = { id, durationMs } + .strict()), so the API
// can't carry startMs/endMs -- but the clock + the up-next filter need cumulative offsets. This stamps
// them from the single source of truth (durationMs; beats are contiguous), idempotently, so a real API
// run and the demo share one clock. Applied at the store boundary so no un-stamped beat ever reaches
// readClock -- without it an API run yields NaN:NaN and an empty up-next.
export function stampTimeline(beats: readonly Beat[]): Beat[] {
   let t = 0;
   return beats.map((b) => {
      const startMs = t;
      const endMs = t + b.durationMs;
      t = endMs;
      return { ...b, startMs, endMs };
        });
}

// ---- fetch layer (runtime only; guarded so SSR/prerender never hits the network) ----
async function jget<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
   const res = await fetch(apiUrl(path, query));
   if (!res.ok) throw new Error(`HTTP ${res.status} at ${path}`);
   return (await res.json()) as T;
}

async function jsend<T>(path: string, body: unknown, method = "POST"): Promise<T> {
   const res = await fetch(apiUrl(path), {
     method,
     headers: { "content-type": "application/json" },
     body: JSON.stringify(body),
   });
   if (!res.ok) throw new Error(`HTTP ${res.status} at ${path}`);
   return (await res.json()) as T;
}

export function fetchRunBeats(slug: string): Promise<Beat[]> {
    return jget<Beat[]>(`/api/content/workouts/${slug}/beats`);
}

// A browsable workout summary (GET /api/content/workouts).
export interface WorkoutSummary {
   slug: string;
   name: string;
   goal?: string;
   emphasis?: string;
   structure?: string;
   total_seconds: number;
   equipment_required?: string[];
   target_muscle_groups?: string[];
   beats: number;
}
export function fetchWorkouts(): Promise<WorkoutSummary[]> {
   return jget<WorkoutSummary[]>(`/api/content/workouts`);
}

export interface TodayResult {
   date: string;
   dayOfWeek: number;
   slotIndex: number;
   slot: { kind: string; label?: string; template_slug: string | null; params?: Record<string, unknown> } | null;
   isRest: boolean;
}
export function fetchToday(planSlug = "fullbody-periodized", date?: string): Promise<TodayResult> {
   return jget<TodayResult>(`/api/content/plans/${planSlug}/session`, { date });
}

// T-43: music resolve (hermetic oEmbed echo on the server side; embedUrl null => silence).
export function resolveMusic(accountId = "default", url: string | null = null) {
    return jget<{
     provider: string;
     source: string | null;
     embedUrl: string | null;
     volume: number;
     startOn: string;
     loop: boolean;
     muted: boolean;
   }>(`/api/music/resolve`, {
     accountId,
     url: url ?? undefined,
   });
}

export function saveMusic(pl: Record<string, unknown>, accountId = "default") {
   return jsend<Record<string, unknown>>(`/api/music`, { accountId, ...pl }, "PATCH");
}

// Post a run (I2-guarded server-side) and return its beats.
export async function startRun(templateSlug: string, accountId?: string): Promise<{ rid: string; beats: Beat[] }> {
   const body = await jsend<{ run: { id: string; beats: Beat[] } }>(`/api/runs`, {
      template: templateSlug,
      account_id: accountId,
   });
   return { rid: body.run.id, beats: body.run.beats };
}

// T-41: the instructor remote's wire.
export function sendControl(
   rid: string,
   command: "pause" | "resume" | "end" | "jump-phase" | "nudge",
   extra?: { phase?: number; delta?: number },
): Promise<{ run: { control: Partial<ControlState> } }> {
   return jsend<{ run: { control: Partial<ControlState> } }>(`/api/runs/${rid}/control`, {
      command,
      ...extra,
   });
}
