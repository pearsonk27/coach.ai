// lib/util.ts -- pure formatting/index helpers the web needs (unit-tested in cjs; no DOM/React).
import type { Beat } from "@coach/ui";

// Clamp a fraction to [0,1] (a normalized progress bar value).
export function clamp01(x: number): number {
   if (Number.isNaN(x)) return 0;
   return x < 0 ? 0 : x > 1 ? 1 : x;
}

// Format an absolute elapsed offset as M:SS (mirrors @coach/ui formatMSS but local + no import cost).
export function formatElapsedMs(ms: number): string {
   const total = Math.max(0, Math.round(ms / 1000));
   const m = Math.floor(total / 60);
   const s = total % 60;
   return `${m}:${s.toString().padStart(2, "0")}`;
}

// The next index after the given one, clamped to the last beat.
export function nextIndex(index: number, n: number): number {
   if (n <= 0) return 0;
   return Math.min(n - 1, index + 1);
}

// The upcoming work beats (for the "what's next" strip), excluding any fully-elapsed one.
export function upcomingWorkBeats(beats: readonly Beat[], elapsedMs: number, limit = 4): Beat[] {
   const out = beats.filter((b) => b.kind === "work" && b.startMs > elapsedMs);
   return out.slice(0, limit);
}
