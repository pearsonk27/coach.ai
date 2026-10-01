// Regression guard for the T-51 clock fix: the API beat contract is durationMs-only (beatBase +
// .strict()), so the client MUST stamp cumulative startMs/endMs before readClock touches the run --
// otherwise remainingMs = endMs - elapsedMs = undefined - ms = NaN, the ring shows "NaN:NaN", and
// up-next's `startMs > elapsedMs` filter yields nothing. This mirrors lib/run.ts's stampTimeline and
// @coach/ui readClock against the *real API shape* (durationMs-only beats) and asserts a live timer.
const assert = require("node:assert");

// lib/run.ts stampTimeline
function stampTimeline(beats) {
   let t = 0;
   return beats.map((b) => {
      const startMs = t;
      const endMs = t + b.durationMs;
      t = endMs;
      return { ...b, startMs, endMs };
    });
}
// @coach/ui readClock (minimal) + formatMSS
function currentBeatIndex(beats, ms) {
   if (!beats.length) return 0;
   const x = Math.max(0, ms);
   for (let i = 0; i < beats.length; i++) if (x < beats[i].endMs) return i;
   return beats.length - 1;
}
function readClock(beats, ms) {
   const total = beats.length ? beats[beats.length - 1].endMs : 0;
   const beat = beats[currentBeatIndex(beats, ms)];
   return { beat, totalMs: total, remainingMs: Math.max(0, beat.endMs - ms), complete: ms >= total };
}
function fmt(ms) {
   const s = Math.max(0, Math.round(ms / 1000));
   return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// The exact shape the API returns: durationMs only, NO startMs/endMs (as in build_timeline._beats_for_phase).
const rawApiBeats = [
   { id: "p0-intro", kind: "phase-intro", durationMs: 10000 },
   { id: "p0-r1-e0", kind: "work", durationMs: 30000, exerciseRef: "cat-cow", round: 1 },
   { id: "p0-r1-e1", kind: "work", durationMs: 30000, exerciseRef: "arm-circles", round: 1 },
   { id: "p1-r1-e2", kind: "work", durationMs: 30000, exerciseRef: "push-up", round: 1 },
   { id: "p3-hold", kind: "cooldown-hold", durationMs: 20000 },
];

// 1. Unstamped beats have NO startMs/endMs -> readClock is NaN before the fix.
assert.strictEqual(rawApiBeats[1].endMs, undefined, "API beats carry no endMs (the bug's precondition)");
assert.ok(!Number.isFinite(readClock(rawApiBeats, 0).remainingMs), "without stamping the clock is not finite");

// 2. After stampTimeline: cumulative, finite, contiguous.
const stamped = stampTimeline(rawApiBeats);
assert.ok(stamped.every((b) => Number.isFinite(b.startMs) && Number.isFinite(b.endMs)), "stamps finite offsets");
assert.strictEqual(stamped[0].startMs, 0, "first beat starts at 0");
assert.strictEqual(stamped[1].startMs, 10000, "second beat offsets by prior durationMs");
stamped.forEach((b, i) => {
   if (i > 0) assert.strictEqual(b.startMs, stamped[i - 1].endMs, "beats are contiguous");
    });
assert.strictEqual(stamped.at(-1).endMs, 120000, "total = sum(durationMs)");

// 3. The clock now yields a real, finite countdown -- no NaN:NaN.
assert.strictEqual(fmt(readClock(stamped, 0).remainingMs), "0:10", "ring shows the current beat's remaining");
assert.strictEqual(fmt(readClock(stamped, 120000).remainingMs), "0:00", "at run end -> 0:00");
assert.ok(readClock(stamped, 120000).complete, "complete at end");
assert.strictEqual(readClock(stamped, 40000).beat.exerciseRef, "arm-circles", "mid-run resolves the right beat");

// 4. up-next works now (startMs is defined): the next work beats past t=0.
const up = stampTimeline(rawApiBeats).filter((b) => b.kind === "work" && b.startMs > 0).slice(0, 4);
assert.strictEqual(up.map((b) => b.exerciseRef).join(","), "cat-cow,arm-circles,push-up", "up-next non-empty after stamping");

// 5. Idempotent: stamping an already-stamped run keeps the same offsets.
assert.deepStrictEqual(stampTimeline(stampTimeline(rawApiBeats)), stamped, "stampTimeline is idempotent");

console.log("PASS: T-51 clock -- stampTimeline gives API (durationMs-only) beats a finite live timer");
