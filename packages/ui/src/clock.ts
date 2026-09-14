// T-21 — useWorkoutClock: the beat clock.
//
// A `WorkoutRun` is a precomputed, deterministic `Beat[]` + one `startedAtMs` (D1). This module is
// the PURE core of the clock: given elapsed wall-clock time, compute the current beat and a few
// derived values UIs and the metronome need. The React/Expo hook wraps this with a timer; nothing
// here touches timers/DOM/React, so it is unit-testable and transport-agnostic.
//
// D3/D10: five beat kinds. A `work` beat is the only one that also carries exerciseRef / cue / round.

export interface BeatBase {
   id: string;
   startMs: number;
   endMs: number;
   durationMs: number;
   kind: "phase-intro" | "prep" | "work" | "rest" | "cooldown-hold";
}
export interface WorkBeat extends BeatBase {
   kind: "work";
   exerciseRef: string;
   cue?: string;
   round?: number;
}
export type Beat =
   | (BeatBase & { kind: "phase-intro" })
   | (BeatBase & { kind: "prep" })
   | WorkBeat
   | (BeatBase & { kind: "rest" })
   | (BeatBase & { kind: "cooldown-hold" });

export interface WorkoutClockState {
   current: Beat;
   index: number;
   progress: number;
   remainingMs: number;
   totalMs: number;
   elapsedMs: number;
   complete: boolean;
}

export function totalMs(beats: readonly Beat[]): number {
   if (beats.length === 0) return 0;
   return beats[beats.length - 1].endMs;
}

// Returns the index of the beat that contains the given absolute elapsed offset.
// Beats are precomputed + non-overlapping (endMs === next.startMs); O(n) scan, n is small.
// Clamps to first when before the run and to last when at/after the end.
export function currentBeatIndex(beats: readonly Beat[], elapsedMs: number): number {
   if (beats.length === 0) return 0;
   const t = Math.max(0, elapsedMs);
   for (let i = 0; i < beats.length; i++) {
        if (t < beats[i].endMs) return i;
       }
   return beats.length - 1;
}

export function currentBeat(beats: readonly Beat[], elapsedMs: number): Beat {
   return beats[currentBeatIndex(beats, elapsedMs)];
}

export function beatProgress(beat: Beat, elapsedMs: number): number {
   const local = Math.max(0, elapsedMs - beat.startMs);
   if (beat.durationMs <= 0) return 1;
   return Math.min(1, local / beat.durationMs);
}

// The authoritative clock read. `complete` flips true at/after the final beat's endMs.
export function readClock(beats: readonly Beat[], elapsedMs: number): WorkoutClockState {
   if (beats.length === 0) {
     return { current: {} as Beat, index: 0, progress: 1, remainingMs: 0, totalMs: 0, elapsedMs: 0, complete: true };
    }
   const total = totalMs(beats);
     const index = currentBeatIndex(beats, elapsedMs);
     const beat = beats[index];
     const progress = beatProgress(beat, elapsedMs);
   return {
       current: beat,
       index,
       progress,
       remainingMs: Math.max(0, beat.endMs - elapsedMs),
       totalMs: total,
       elapsedMs: Math.min(elapsedMs, total),
       complete: elapsedMs >= total,
          };
}

// Format ms as M:SS for the countdown ring.
export function formatMSS(ms: number): string {
     const total = Math.max(0, Math.round(ms / 1000));
     const m = Math.floor(total / 60);
     const s = total % 60;
     return `${m}:${s.toString().padStart(2, "0")}`;
}

// D3/D10 music cueing: a work beat's duration maps to a number of metronome "clicks" at tempo.
export function clicksForBeat(beat: Beat, beatsPerMinute: number): number {
     if (beat.kind !== "work") return 0;
     const seconds = beat.durationMs / 1000;
     if (beatsPerMinute <= 0) return 0;
     return Math.max(1, Math.round((seconds / 60) * beatsPerMinute));
}
