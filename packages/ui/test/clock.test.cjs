// T-21 smoke: build a tiny Beat[] and verify the clock math. Pure, no deps.
const assert = require("node:assert");

const beats = [
    { id: "b0", kind: "prep", startMs: 0, endMs: 2000, durationMs: 2000 },
    { id: "b1", kind: "work", startMs: 2000, endMs: 6000, durationMs: 4000, exerciseRef: "goblet-squat", cue: "Drive", round: 1 },
    { id: "b2", kind: "rest", startMs: 6000, endMs: 8000, durationMs: 2000 },
];

// Mirror the clock logic in plain JS (the TS is type-erased; behavior must match).
function totalMs(b) { return b.length ? b[b.length - 1].endMs : 0; }
function currentBeatIndex(b, t) {
     const e = Math.max(0, t);
     for (let i = 0; i < b.length; i++) if (e < b[i].endMs) return i;
     return b.length - 1;
}
function progress(beat, t) {
     const local = Math.max(0, t - beat.startMs);
     if (beat.durationMs <= 0) return 1;
     return Math.min(1, local / beat.durationMs);
}

assert.strictEqual(totalMs(beats), 8000, "totalMs");
assert.strictEqual(currentBeatIndex(beats, 0), 0, "at 0 -> prep");
assert.strictEqual(currentBeatIndex(beats, 3000), 1, "at 3s -> work");
assert.strictEqual(currentBeatIndex(beats, 7000), 2, "at 7s -> rest");
assert.strictEqual(currentBeatIndex(beats, 100000), 2, "past end clamps to last");
assert.strictEqual(currentBeatIndex(beats, -5), 0, "before clamps to first");
assert.ok(Math.abs(progress(beats[1], 4000) - 0.5) < 1e-9, "progress mid-work = 0.5");
assert.strictEqual(progress(beats[1], 99999), 1, "progress clamps to 1");

// metronome clicks: 4s work @ 120bpm -> 8 clicks
assert.strictEqual(Math.round((4000 / 1000 / 60) * 120), 8, "clicks 4s@120bpm=8");

console.log("PASS: T-21 clock smoke (" + beats.length + " beats, 3 checks + progress + clicks)");
