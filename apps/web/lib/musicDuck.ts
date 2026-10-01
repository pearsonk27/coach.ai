// lib/musicDuck.ts -- duck the *real* in-class soundtrack around exercise cues, plus a tiny pub/sub.
//
// The store's `musicGain()` already computes the right number (full volume -> ~30% during the last 10
// s of each work block, 0 when muted); what was missing was a route to the *actual* SoundCloud audio.
// An <iframe> embed is opaque, so the host can't set its Web-Audio gain -- instead we drive the SoundCloud
// player's own API (`SC.Widget.setVolume`, 0..100). This module is that route: the pure math is tested
// here; a quantised pub/sub (`setDuck`/`onDuck`) hands the hook's per-frame level to the player, which
// only re-issues `setVolume` when the rounded percent actually changes (no postMessage spam).
//
// Fails soft: if `window.SC` / the widget isn't available the player still plays; ducking is best-effort
// and never throws into the clock loop (design §2.9 / D10 "never crash the play loop").

// 0..1 inclusive clamp.
export function clamp01(x: number): number {
   if (typeof x !== "number" || Number.isNaN(x)) return 1;
   return x < 0 ? 0 : x > 1 ? 1 : x;
}

// The absolute player volume (0..100) for a desired `base` (the user's 0..1 setting) ducked to `level`
// (0..1; 1 == full, 0.3 == the -~10 dB cue duck). Integer percent is what SC.Widget.setVolume expects.
export function duckVolumePercent(base: number, level: number): number {
   const pct = 100 * clamp01(base) * clamp01(level);
   return Math.round(Math.max(0, Math.min(100, pct)));
}

// A short, even ramp of integer percent values taking `totalMs` to cross `fromPct` -> `toPct` in
// `steps` steps (~one setVolume tick per step). Empty when already at target (so the loop doesn't
// churn). Smooths an instant 100->30 jump the web-player API can't itself ramp.
export interface RampStop {
   tMs: number;
   pct: number;
}
export function duckRampSchedule(
   fromPct: number,
   toPct: number,
   opts: { steps?: number; totalMs?: number } = {},
): RampStop[] {
   const steps = Math.max(1, opts.steps ?? 4);
   const totalMs = Math.max(1, opts.totalMs ?? 150);
   const from = Math.round(clamp01(fromPct / 100) * 100);
   const to = Math.round(clamp01(toPct / 100) * 100);
   if (from === to) return [];
   const stops: RampStop[] = [];
   for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      stops.push({ tMs: Math.round(totalMs * frac), pct: Math.round(from + (to - from) * frac) });
      }
   return stops;
}

// ---- the duck bus: the hook writes the level each frame; the player applies it on change ----------
export interface DuckListener {
   (level: number, reason: string): void;
}
// Emit only when the *quantised* level moves, so the per-frame rAF calls rarely notify.
const STEP = 0.05;
const quantize = (x: number): number => Math.round(clamp01(x) / STEP) * STEP;
let curLevel = 1;
let curReason = "idle";
const listeners = new Set<DuckListener>();

// The audio hook calls this every frame with the store's `musicGain()`; quantised so it's a no-op
// unless the effective duck actually changes.
export function setDuck(level: number, reason: string = "countdown"): void {
   const q = quantize(level);
   if (q === curLevel && reason === curReason) return;
   curLevel = q;
   curReason = reason;
   for (const l of listeners) l(q, reason);
}

// Subscribe; primed with the current level so a late subscriber gets the live value. Returns unsub.
export function onDuck(fn: DuckListener): () => void {
   listeners.add(fn);
   fn(curLevel, curReason);
   return () => {
      listeners.delete(fn);
      };
}

// Test/introspection surface.
export function duckState(): { level: number; reason: string } {
   return { level: curLevel, reason: curReason };
}

// Reset for tests.
export function __resetDuck(): void {
   curLevel = 1;
   curReason = "idle";
   listeners.clear();
}
