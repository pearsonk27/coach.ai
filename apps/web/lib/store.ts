// lib/store.ts -- the single Zustand store the web + (soon) mobile share shape for.
//
// Holds the active run (beats + control + music) and the live clock offset. Pure scheduling/ducking
// math lives in @coach/ui; this module only composes it with React state.
import { create } from "zustand";
import type { Beat, Cue } from "@coach/ui";
import { planCues, duckLevelAt, DUCK_LEVEL } from "@coach/ui";
import { demoBeats, demoRunId, stampTimeline } from "./run";
import { defaultPlaylistEmbed } from "./music";
import type { ControlState, MusicPlayback } from "./types";

export type ControlCommand = "pause" | "resume" | "end" | "jump-phase" | "nudge";

export default interface WebStoreState {
    runId: string | null;
   templateSlug: string | null;
   beats: Beat[];
   cues: Cue[];
   totalMs: number;
   control: ControlState;
   music: MusicPlayback;
   muted: boolean;
   elapsedMs: number;
   error: string | null;

   loadDemo(): void;
   setRun(beats: Beat[], rid: string, slug: string): void;
   setElapsed(ms: number): void;
   setMusic(patch: Partial<MusicPlayback>): void;
   setMuted(m: boolean): void;
   applyControl(command: ControlCommand, extra?: { phase?: number; delta?: number }): void;
   // The effective music gain at the current offset: ducked on the countdown, 0 when muted.
   musicGain(): number;
   clearError(): void;
}

// Seed the default soundtrack with the user's own playlist so a started class has music from the
// first tap (the /play view renders it). /me or a server resolve can override this per account.
const defaultMusic: MusicPlayback = {
   provider: "soundcloud",
   embedUrl: defaultPlaylistEmbed() || null,
   volume: 1.0,
   startOn: "start",
   loop: true,
   muted: false,
 };

function demoState(beats: Beat[]) {
   return {
     runId: demoRunId(),
     templateSlug: "demo-hiit",
     beats,
     cues: planCues(beats),
     totalMs: beats.length ? beats[beats.length - 1].endMs : 0,
     control: { phase: -1, offsetMs: 0, state: "playing" as const, ended: false },
     music: defaultMusic,
     muted: false,
     elapsedMs: 0,
     error: null,
   };
}

const demo = demoState(stampTimeline(demoBeats()));

export const useWebStore = create<WebStoreState>((set, get) => ({
       ...demo,
       loadDemo() {
          set(demoState(stampTimeline(demoBeats())));
          },
          setRun(beats, rid, slug) {
          const stamped = stampTimeline(beats);
          set({
           beats: stamped,
          runId: rid,
          templateSlug: slug,
          cues: planCues(stamped),
          totalMs: stamped.length ? stamped[stamped.length - 1].endMs : 0,
          elapsedMs: 0,
          control: { phase: -1, offsetMs: 0, state: "playing", ended: false },
          error: null,
            });
           },
     setElapsed(ms) {
      const s = get();
      const clamped = Math.max(0, Math.min(ms, s.totalMs || ms));
      set({ elapsedMs: clamped });
     },
     setMusic(patch) {
       set((s) => ({ music: { ...s.music, ...patch } }));
      },
     setMuted(m) {
       set({ muted: m });
      },
     applyControl(command, extra) {
        set((s) => {
         const c = { ...s.control };
          switch (command) {
            case "pause":
                c.state = "paused";
                break;
             case "resume":
                c.state = "playing";
                c.ended = false;
                break;
            case "end":
                c.state = "ended";
                c.ended = true;
                break;
            case "jump-phase":
                c.phase = typeof extra?.phase === "number" ? extra.phase : c.phase + 1;
                break;
            case "nudge":
                c.offsetMs = c.offsetMs + (extra?.delta ?? 0);
                break;
            default:
                 break;
            }
          return { control: c };
          });
       },
     musicGain() {
       const s = get();
       if (s.muted) return 0;
       // The countdown ducks the music to ~30% so cues are audible; restore otherwise.
      const duck = duckLevelAt(s.elapsedMs, s.beats);
      const base = Math.min(1, s.music.volume ?? 1);
      return Math.max(0, duck <= DUCK_LEVEL + 1e-6 ? base * DUCK_LEVEL : base);
       },
     clearError() {
      set({ error: null });
     },
     }));
