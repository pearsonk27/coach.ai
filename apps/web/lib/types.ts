// Web-side domain shapes (mirrors the API wire JSON). The generated @coach/api-client returns any,
// so the web keeps its own light types at the fetch boundary; pure logic below is typed in @coach/ui.
import type { Beat, Cue, WorkoutClockState, ResolvedSlot, TodaySession } from "@coach/ui";

export type RunState = "idle" | "playing" | "paused" | "ended";
export interface ControlState {
   phase: number;
   offsetMs: number;
   state: RunState;
   ended: boolean;
}

// Music playback config (MusicResolveResponse shape, T-43).
export interface MusicPlayback {
    id?: string;
   provider: string;
   embedUrl: string | null;
   volume: number;
   startOn: string;
   loop: boolean;
   muted: boolean;
 }

export type { Beat, Cue, WorkoutClockState, ResolvedSlot, TodaySession };

// The store owns the active run + its control state + the music config.
export interface RunStateShape {
  runId: string | null;
  templateSlug: string | null;
  beats: Beat[];
  totalMs: number;
  control: ControlState;
  music: MusicPlayback;
  muted: boolean;
  startedAtMs: number | null;
}
