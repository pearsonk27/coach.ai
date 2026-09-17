// src/mobile-model.ts -- T-70 shared-core shell.
//
// The point of T-70 is that the mobile app is a THIN shell around @coach/ui's pure core -- the SAME
// clock (`readClock`), cue schedule (`planCues`), and ducking math (`duckLevelAt`) the web uses.
// This module is that shell, in transport-agnostic TS so it typechecks without Expo/RN installed
// (headless, lean). The real App.tsx (RN JSX + navigation) builds on these selectors.
import {
   readClock,
   planCues,
   duckLevelAt,
   totalMs,
   formatMSS,
   todaySession,
   type Beat,
   type Cue,
   type ResolvedSlot,
   type TodaySession,
   type WorkoutClockState,
} from "@coach/ui";

export interface MobileRun {
   beats: Beat[];
   cues: Cue[];
   totalMs: number;
}

export function mobileRun(beats: Beat[]): MobileRun {
   return { beats, cues: planCues(beats), totalMs: totalMs(beats) };
}

export interface MobileView {
   clock: WorkoutClockState;
   remainingLabel: string;
   overallFraction: number;
   currentFraction: number;
   // Effective music gain at this offset (0.3 during a countdown, 1 otherwise); the AudioContext in the
   // real app multiplies its music gain by this. `muted` forces 0.
   duckLevel: number;
   nextCue: Cue | null;
}

export function viewState(run: MobileRun, elapsedMs: number, muted: boolean): MobileView {
   const clock = readClock(run.beats, elapsedMs);
   const overall = run.totalMs > 0 ? Math.min(1, elapsedMs / run.totalMs) : 0;
   const nextCue = run.cues.find((c) => c.atMs > elapsedMs) ?? null;
   return {
      clock,
      remainingLabel: formatMSS(clock.remainingMs),
      overallFraction: overall,
      currentFraction: clock.progress,
      duckLevel: duckLevelAt(elapsedMs, run.beats) * (muted ? 0 : 1),
      nextCue,
   };
}

// Today's session for the mobile "what am I doing today" screen -- same resolver as the web.
export function todayFor(slots: readonly ResolvedSlot[], date?: string): TodaySession {
   return todaySession(slots, date ? { date } : {});
}

// A demo run for the offline dev shell (mirrors the web's demo shape).
export function buildDemoRun(): Beat[] {
   const out: Beat[] = [];
   let t = 0;
   const push = (kind: Beat["kind"], durMs: number, extra: Record<string, unknown> = {}) => {
      out.push({ id: "b" + t, kind, startMs: t, endMs: t + durMs, durationMs: durMs, ...extra } as Beat);
      t += durMs;
       };
  push("phase-intro", 5000, { title: "Warm up" });
  for (const [ex, cue, round] of [["goblet-squat", "Drive", 1], ["incline-pushup", "Explode", 1], ["kettlebell-swing", "Hip hinge", 1]] as [string, string, number][]) {
    push("work", 40000, { exerciseRef: ex, cue, round });
    push("rest", 15000, { cue: "Recover" });
      }
  push("cooldown-hold", 30000, { title: "Cool down" });
  return out;
}
