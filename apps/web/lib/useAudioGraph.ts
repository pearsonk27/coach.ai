"use client";
// lib/useAudioGraph.ts -- T-42 audio cues + music ducking over a single Web Audio graph.
//
// Pure scheduling/ducking math is @coach/ui (planCues/duckLevelAt/cuesInWindow/rampEnvelope). This
// hook renders it: one AudioContext, a musicGain (the Song plays through it) and a cuesGain (the
// cue tones), a master gain. Each frame it rides the music gain to duckLevelAt() and fires any cue
// that has crossed the clock. Graceful no-op when there is no AudioContext (SSR / old browsers /
// "no music") -- never throws, never crashes the play loop (design §2.9 / D10).
import { useEffect, useRef, useCallback } from "react";
import {
   cuesInWindow,
   rampEnvelope,
   DUCK_LEVEL,
   DUCK_RAMP_MS,
   type Beat,
   type Cue,
} from "@coach/ui";
import { useWebStore } from "./store";

interface Graph {
   ctx: AudioContext;
   master: GainNode;
   music: GainNode;
   cues: GainNode;
   backing: OscillatorNode | null;
}

export interface AudioApi {
   ensureStarted: () => Promise<void>;
   toggleMute: () => void;
   cueFor: (c: Cue) => { freq: number; durMs: number; gain: number; label: string };
}

// Map a cue to its tone (pitch/length/loudness). 5..1 are emphasized (D10).
export function toneForCue(c: Cue): { freq: number; durMs: number; gain: number; label: string } {
   const base = "click";
   if (c.type === "workout-complete") return { freq: 220, durMs: 600, gain: 0.5, label: "Done!" };
   if (c.type === "exercise-done") return { freq: 880, durMs: 220, gain: 0.4, label: "Rep done" };
   if (c.type === "interval-count") {
     const n = c.n ?? 1;
      return {
        freq: c.emphasized ? 1320 : 900,
        durMs: c.emphasized ? 140 : 90,
        gain: c.emphasized ? 0.55 : 0.3,
        label: String(n),
         };
     }
   return { freq: 760, durMs: 120, gain: 0.3, label: base };
}

export function useAudioGraph(active: boolean): AudioApi {
   const store = useWebStore;
   const graphRef = useRef<Graph | null>(null);
   const lastFiredRef = useRef<number>(0);
   const rafRef = useRef<number | undefined>(undefined);
   const visibleRef = useRef<Cue | null>(null);

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
      const music = ctx.createGain();
      const cues = ctx.createGain();
      cues.connect(master);
      music.connect(master);
      master.connect(ctx.destination);
      let backing: OscillatorNode | null = null;
       // A quiet backing tone stands in for the Song stream routed through the SAME musicGain, so the
       // ducking is audible/demonstrable. A real integration feeds the SoundCloud Audio API's output
       // to `music` instead of this oscillator.
      try {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 150;
        const bg = ctx.createGain();
        bg.gain.value = 0.02;
        osc.connect(bg);
        bg.connect(music);
        osc.start();
        backing = osc;
        } catch {
         // oscillator unsupported -> still run cue tones through cues->master
         backing = null;
          }
      const g: Graph = { ctx, master, music, cues, backing };
       // Prime from the current store state.
       s_apply(ctx, music, store.getState());
       graphRef.current = g;
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
         // (1) Fire cues that crossed the clock since last frame.
        const due = cuesInWindow(s.cues, lastFiredRef.current, s.elapsedMs);
         for (const c of due) {
            lastFiredRef.current = Math.max(lastFiredRef.current, c.atMs + 1);
            visibleRef.current = c;
            if (graphRef.current) playCue(graphRef.current, c);
              }
         // (2) Ride the music gain to the duck envelope (ramped).
        const target = s.musicGain();
        const g = graphRef.current;
        if (g) {
           const now = g.ctx.currentTime;
           const from = g.music.gain.value;
           const to = rampEnvelope({ from, to: target, rampMs: DUCK_RAMP_MS, atMs: DUCK_RAMP_MS });
          g.music.gain.setTargetAtTime(to, now, DUCK_RAMP_MS / 1000 / 4);
            }
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

// Set the music gain to where the envelope wants it right now (for the prime + tests via export).
function s_apply(ctx: AudioContext, musicGain: GainNode, s: { musicGain: () => number }): number {
   const target = Math.max(0, Math.min(1, s.musicGain()));
   musicGain.gain.setTargetAtTime(target, ctx.currentTime, 0.01);
   return target;
}

// A short cue tone through the cuesGain. Pitch/length/loudness from @coach/ui's cue shape.
function playCue(g: Graph, c: Cue) {
   const ctx = g.ctx;
   const spec = toneForCue(c);
   try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = spec.freq;
      osc.type = "sine";
      gain.gain.value = 0.0001;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(spec.gain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.durMs / 1000);
      osc.connect(gain);
      gain.connect(g.cues);
      osc.start(now);
      osc.stop(now + spec.durMs / 1000 + 0.05);
      } catch {
      // no-op: the cue is "played" visually regardless (visibleRef), audio is best-effort.
     }
}

// Test surface (pure): which tone a cue maps to. Exported for the cjs mirror.
export { toneForCue as cueTone };
