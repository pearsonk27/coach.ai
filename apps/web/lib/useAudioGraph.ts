"use client";
// lib/useAudioGraph.ts -- T-42 audio cues over a single Web Audio graph, plus the duck route.
//
// One AudioContext, a `cues` gain (the short cue tones) and a `master` gain to the destination. Each
// frame it (1) fires every cue that has crossed the clock and (2) writes the store's `musicGain()` to
// the duck bus so the REAL soundtrack ducks on the 5-count. The cue tones are transient pings, NOT a
// held drone -- there is no always-on oscillator, so the previous faint "buzz" (a 150 Hz stand-in tone
// that stood in for the song stream) is gone. Graceful no-op when there is no AudioContext
// (SSR / old browsers / "no music") -- never throws, never crashes the play loop (design §2.9 / D10).
import { useEffect, useRef, useCallback } from "react";
import {
   setDuck,
} from "./musicDuck";
import {
   cuesInWindow,
   type Beat,
   type Cue,
} from "@coach/ui";
import { useWebStore } from "./store";

// The only nodes the hook owns: a cues gain (transient tones) under a master gain to the output.
interface Graph {
   ctx: AudioContext;
   master: GainNode;
   cues: GainNode;
}

export interface AudioApi {
   ensureStarted: () => Promise<void>;
   toggleMute: () => void;
   cueFor: (c: Cue) => { freq: number; durMs: number; gain: number; label: string };
}

// Map a cue to its tone (pitch/length/loudness). 5..1 are emphasized (D10). Kept gentle + short so a
// burst of 1/s interval counts reads as a clean metronome, not a buzz.
export function toneForCue(c: Cue): { freq: number; durMs: number; gain: number; label: string } {
   const base = "click";
   if (c.type === "workout-complete") return { freq: 392, durMs: 520, gain: 0.28, label: "Done!" };
   if (c.type === "exercise-done") return { freq: 660, durMs: 180, gain: 0.22, label: "Rest" };
   if (c.type === "interval-count") {
      const n = c.n ?? 1;
      return {
         freq: c.emphasized ? 880 : 520,
         durMs: c.emphasized ? 110 : 70,
         gain: c.emphasized ? 0.3 : 0.16,
         label: String(n),
       };
   }
   return { freq: 520, durMs: 90, gain: 0.18, label: base };
}

export function useAudioGraph(active: boolean): AudioApi {
   const store = useWebStore;
   const graphRef = useRef<Graph | null>(null);
   const lastFiredRef = useRef<number>(0);
   const rafRef = useRef<number | undefined>(undefined);

   const ensureStarted = useCallback(async () => {
      if (typeof window === "undefined") return;
      type AudioCtor = { new (): AudioContext };
      const W = window as unknown as {
         AudioContext?: AudioCtor;
         webkitAudioContext?: AudioCtor;
       };
      const Ctor: AudioCtor | undefined = W.AudioContext || W.webkitAudioContext;
      if (!Ctor) return; // no Web Audio -> silent no-op
      if (graphRef.current) {
         // Resume a suspended context after a user gesture.
         if (graphRef.current.ctx.state === "suspended") await graphRef.current.ctx.resume();
         return;
         }
      const ctx = new Ctor();
      const master = ctx.createGain();
      const cues = ctx.createGain();
      cues.gain.value = 1;
      master.gain.value = 1;
      cues.connect(master);
      master.connect(ctx.destination);
      // No always-on tone: cues are the only sound. The real song ducks through the bus, not a stand-in.
      graphRef.current = { ctx, master, cues };
       }, []);

   const toggleMute = useCallback(() => {
       const s = store.getState();
       s.setMuted(!s.muted);
         }, []);

   useEffect(() => {
      if (!active) return;
       let mounted = true;
        const drive = () => {
          if (!mounted) return;
           const s = store.getState();
             // (1) Fire every cue that crossed the clock since last frame.
          const due = cuesInWindow(s.cues, lastFiredRef.current, s.elapsedMs);
           for (const c of due) {
             lastFiredRef.current = Math.max(lastFiredRef.current, c.atMs + 1);
             if (graphRef.current) playCue(graphRef.current, c);
                }
           // (2) Push the duck level to the real soundtrack via the bus (no-op when it hasn't changed).
            setDuck(s.musicGain());
            rafRef.current =
               typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(drive) : undefined;
             };
         drive();
         return () => {
          mounted = false;
           if (rafRef.current !== undefined && typeof cancelAnimationFrame !== "undefined") {
            cancelAnimationFrame(rafRef.current);
              }
            };
        }, [active, store]);

   return {
       ensureStarted,
      toggleMute,
      cueFor: toneForCue,
     };
}

// A short cue tone through the cues gain. Pitch/length/loudness from the cue shape. A brief attack
// (a few ms up from near-zero) kills the "click/buzz" onset of the old hard setValueAtTime spike.
function playCue(g: Graph, c: Cue) {
   const ctx = g.ctx;
   const spec = toneForCue(c);
   try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = spec.freq;
      const now = ctx.currentTime;
      const attack = 0.008;
      const peak = spec.gain;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.durMs / 1000);
      osc.connect(gain);
      gain.connect(g.cues);
      osc.start(now);
      osc.stop(now + spec.durMs / 1000 + 0.03);
       } catch {
       // no-op: the cue still shows on screen; audio is best-effort.
      }
}

// Test surface (pure): which tone a cue maps to. Exported for the cjs mirror.
export { toneForCue as cueTone };
