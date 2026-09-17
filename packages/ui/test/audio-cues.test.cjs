// T-42 smoke: cue schedule + duck math. Pure, no deps (mirrors the TS in plain JS).
const assert = require("node:assert");

const beats = [
     { id: "p", kind: "prep", startMs: 0, endMs: 2000, durationMs: 2000 },
     { id: "w1", kind: "work", startMs: 2000, endMs: 42000, durationMs: 40000, exerciseRef: "squat", cue: "Drive", round: 1 },
      { id: "r1", kind: "rest", startMs: 42000, endMs: 45000, durationMs: 3000 },
      { id: "w2", kind: "work", startMs: 45000, endMs: 50000, durationMs: 5000, exerciseRef: "pushup", cue: "Explode", round: 1 },
      { id: "c", kind: "cooldown", startMs: 50000, endMs: 55000, durationMs: 5000 },
];

const WINDOW = 10000, TICK = 1000, DUCK = 0.3;

// Mirror planCues + duckLevelAt.
function planCues(beats, windowMs = WINDOW, tickMs = TICK, emph = 5) {
     const cues = [];
   for (const b of beats) {
      if (b.kind !== "work") continue;
      const covered = Math.min(windowMs, b.durationMs);
      const n = Math.max(0, Math.floor(covered / tickMs));
      for (let i = 1; i <= n; i++) {
        cues.push({ atMs: b.endMs - i * tickMs, type: "interval-count", n: i, emphasized: i <= emph });
         }
      cues.push({ atMs: b.endMs, type: "exercise-done" });
     }
   const last = beats[beats.length - 1];
   if (last) cues.push({ atMs: last.endMs, type: "workout-complete" });
   cues.sort((a, b) => (a.atMs - b.atMs) || 0);
   return cues;
}

function duckLevelAt(nowMs, beats, windowMs = WINDOW) {
   let level = 1.0;
   for (const b of beats) {
     if (b.kind !== "work") continue;
     const from = Math.max(b.startMs, b.endMs - windowMs);
    if (nowMs >= from && nowMs < b.endMs) level = Math.min(level, DUCK);
    }
   const last = beats[beats.length - 1];
   if (last && nowMs >= Math.max(0, last.endMs) && nowMs < last.endMs + 1200) level = Math.min(level, DUCK);
   return level;
}

// 10-s interval in 40-s -> 10 ticks counting down 10..1, emphasized on 5..1
const cues = planCues(beats);
// w1 is a 40-s interval: its last 10 s get a full 10..1 countdown; w2 (5 s) gets 5.
const w1Ticks = cues.filter((c) => c.type === "interval-count" && c.atMs >= 32000 && c.atMs <= 42000);
assert.strictEqual(w1Ticks.length, 10, "40s work @10s window => 10 ticks");
assert.strictEqual(w1Ticks[0].n, 10, "earliest tick counts 10");
assert.strictEqual(w1Ticks[9].n, 1, "latest tick counts 1");
assert.strictEqual(w1Ticks[0].atMs, 32000, "earliest tick at endMs-10s (n=10)");
assert.strictEqual(w1Ticks[9].atMs, 41000, "latest tick at endMs-1s (n=1)");
assert.ok(w1Ticks.find((c) => c.n === 5).emphasized === true, "n=5 emphasized");
assert.ok(w1Ticks.find((c) => c.n === 10).emphasized === false, "n=10 not emphasized");

// one exercise-done bell per work interval + one workout-complete buzzer at run end
assert.strictEqual(cues.filter((c) => c.type === "exercise-done").length, 2, "bell per work interval");
assert.strictEqual(cues.filter((c) => c.type === "workout-complete").length, 1, "one run-end buzzer");
assert.strictEqual(cues.filter((c) => c.type === "workout-complete")[0].atMs, 55000, "buzzer at run end");

// schedule is time-ordered
for (let i = 1; i < cues.length; i++) assert.ok(cues[i].atMs >= cues[i - 1].atMs, "cues sorted ascending");

// DUCK: held to ~30% inside a work interval's last 10s, full otherwise
assert.strictEqual(duckLevelAt(6000, beats), 1.0, "full volume early in work (t=6s, 36s before end)");
assert.ok(Math.abs(duckLevelAt(40000, beats) - DUCK) < 1e-9, "ducked within last 10s of work (t=40s)");
assert.strictEqual(duckLevelAt(43500, beats), 1.0, "rest => full volume (not in any duck window)");
assert.ok(Math.abs(duckLevelAt(55300, beats) - DUCK) < 1e-9, "ducked near run end for the buzzer");
assert.strictEqual(duckLevelAt(0, beats), 1.0, "empty/early => full");
assert.strictEqual(duckLevelAt(5000, []), 1.0, "no beats => full (graceful no-op, no crash)");

// DETERMINISM: same input => identical schedule
assert.deepStrictEqual(planCues(beats), planCues(beats), "deterministic cue schedule (D1)");

console.log("PASS: T-42 audio-cue + duck math (" + beats.length + " beats, " + cues.length + " cues)");
