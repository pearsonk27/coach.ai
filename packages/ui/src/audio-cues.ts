// T-42 — audio-cue + music-ducking MATH (pure). See design §2.9 / D10.
//
// The browser `useAudioGraph` (apps/web/audio) wraps one AudioContext and owns the Web-Audio
// wiring (OscillatorNodes, GainNodes). Nothing here touches the DOM/AudioContext: it is the
// transport-agnostic core that decides (a) WHEN each cue fires and (b) the music-duck level at any
// instant, so it is unit-testable in Node with a fake clock. The hook consumes `planCues` +
// `duckLevelAt` and renders them with Web Audio, then ducks the SoundCloud MusicPlayer via the
// returned level (the requested "lower the playlist volume temporarily").
//
// Locked defaults (design §11, v4): 10-s count window; duck ~30% x 1.2 s; ramp 150 ms.

import type { Beat } from "./clock";

export const CUE_COUNT_WINDOW_MS = 10_000; // countdown covers the last 10 s of a work interval
export const CUE_TICK_MS = 1000; // one tick per second
export const DUCK_LEVEL = 0.3; // music ducks to 30% while a cue sounds
export const DUCK_DURATION_MS = 1200; // bell/buzzer duck window
export const DUCK_RAMP_MS = 150; // smooth in/out ramp
export const COUNT_EMPHASIZE_LE = 5; // count values <= 5 (5..1) are emphasized (higher/longer)

export type CueType =
  | "interval-count"   // per-work-interval countdown tick (10..1)
   | "exercise-done"   // bell on a work -> rest transition
   | "workout-complete" // buzzer at run end (after the final phase)
   | "work-to-rest"    // (retained) transition tick
   | "rest-to-work";   // (retained) transition tick

export interface Cue {
   atMs: number;          // absolute offset in run-time when this cue sounds
  type: CueType;
  n?: number;             // interval-count only: the integer count (N..1)
  emphasized?: boolean;   // interval-count only: true when n <= COUNT_EMPHASIZE_LE
}

export interface CueOptions {
   countWindowMs?: number;
  tickMs?: number;
  emphasizeAtOrBelow?: number;
}

export type DuckReason = "countdown" | "transition" | "run-end";
export interface DuckWindow {
   fromMs: number;
   toMs: number;
   level: number;
   reason: DuckReason;
}

// The full cue schedule for a run. Deterministic: same beats + opts => same cues, byte-stable
// (D1) so every device/room cues identically.
export function planCues(beats: readonly Beat[], opts: CueOptions = {}): Cue[] {
   const windowMs = opts.countWindowMs ?? CUE_COUNT_WINDOW_MS;
   const tickMs = opts.tickMs ?? CUE_TICK_MS;
   const emphasizeAtOrBelow = opts.emphasizeAtOrBelow ?? COUNT_EMPHASIZE_LE;
   const cues: Cue[] = [];

   for (const b of beats) {
     if (b.kind !== "work") continue;
     // (1) Interval-count: one tick/sec over the last min(window, duration) ms of the interval,
     //      counting N down to 1. A short interval emits as many whole-second ticks as it holds.
     const covered = Math.min(windowMs, b.durationMs);
     const nTicks = tickMs > 0 ? Math.max(0, Math.floor(covered / tickMs)) : 0;
     for (let i = 1; i <= nTicks; i++) {
        const n = i;
        // n=1 lands 1 s before endMs; n=N at endMs-N s
        cues.push({
         atMs: b.endMs - i * tickMs,
         type: "interval-count",
         n,
         emphasized: i <= emphasizeAtOrBelow,
        });
       }
     // (2) Exercise-done bell at the end of the work interval (the work -> rest transition).
    cues.push({ atMs: b.endMs, type: "exercise-done" });
   }

   // (3) Workout-complete buzzer at run end (after the final phase).
   const last = beats[beats.length - 1];
   if (last) cues.push({ atMs: last.endMs, type: "workout-complete" });

   // Stable ascending time order (ties broken so schedule playback is deterministic).
   cues.sort((a, b) => (a.atMs - b.atMs) || typeRank(a.type) - typeRank(b.type));
   return cues;
}

// A cue's duck window(s) -> the music-gain level the SoundCloud player should ride to at nowMs.
// A 10-s interval-count HOLDS the music at DUCK_LEVEL for the whole window (so counting is clear),
// then it restores. bell/buzzer duck briefly at run end.
export function duckWindows(beats: readonly Beat[], opts: CueOptions = {}): DuckWindow[] {
   const windowMs = opts.countWindowMs ?? CUE_COUNT_WINDOW_MS;
   const windows: DuckWindow[] = [];

   for (const b of beats) {
     if (b.kind !== "work") continue;
     windows.push({
        fromMs: Math.max(b.startMs, b.endMs - windowMs),
        toMs: b.endMs,
        level: DUCK_LEVEL,
        reason: "countdown",
       });
     }

   const last = beats[beats.length - 1];
   if (last) {
     windows.push({
        fromMs: Math.max(0, last.endMs - DUCK_DURATION_MS),
        toMs: last.endMs + DUCK_DURATION_MS,
        level: DUCK_LEVEL,
        reason: "run-end",
       });
     }

   return windows;
}

// The music-gain multiplier at nowMs: the MINIMUM level across any duck window that contains it
// (1.0 == full volume; DUCK_LEVEL == ducked). Global mute is the caller's responsibility
// (force level 0). "Graceful no-op" => an empty beat array yields full volume, never a crash.
export function duckLevelAt(
   nowMs: number,
   beats: readonly Beat[] = [],
   opts: CueOptions = {},
 ): number {
   let level = 1.0;
   for (const w of duckWindows(beats, opts)) {
     if (nowMs >= w.fromMs && nowMs < w.toMs) level = Math.min(level, w.level);
   }
   return level;
}

// Cues that fell due on the open interval [fromMs, toMs) -- the hook fires these per tick.
export function cuesInWindow(
   cues: readonly Cue[],
   fromMs: number,
   toMs: number,
): Cue[] {
   return cues.filter((c) => c.atMs >= fromMs && c.atMs < toMs);
}

// A ramp envelope for ducking from `from` to `to` over `rampMs` (linear), so the Web-Audio gain
// node can setValueAtTime/linearRampToValueAtTime deterministically.
export function rampEnvelope(opts: {
   from: number;
   to: number;
   rampMs: number;
  atMs: number;
}): number {
   const { from, to, rampMs, atMs } = opts;
   if (from === to) return to;
   if (atMs <= 0) return from;
   if (atMs >= rampMs) return to;
   const t = atMs / Math.max(1, rampMs);
   return from + (to - from) * t;
}

function typeRank(t: CueType): number {
   switch (t) {
     case "interval-count": return 0;
     case "exercise-done": return 1;
     case "work-to-rest": return 2;
     case "rest-to-work": return 3;
     case "workout-complete": return 4;
     default: return 99;
   }
}
