// Pure web utils smoke. Mirrors apps/web/lib/util.ts (the TS is type-erased; behavior must match).
const assert = require("node:assert");

function clamp01(x) {
   if (Number.isNaN(x)) return 0;
   return x < 0 ? 0 : x > 1 ? 1 : x;
}
function formatElapsedMs(ms) {
   const total = Math.max(0, Math.round(ms / 1000));
   const m = Math.floor(total / 60);
   const s = total % 60;
   return `${m}:${s.toString().padStart(2, "0")}`;
}
function nextIndex(index, n) {
   if (n <= 0) return 0;
   return Math.min(n - 1, index + 1);
}
function upcomingWorkBeats(beats, elapsedMs, limit = 4) {
   const out = beats.filter((b) => b.kind === "work" && b.startMs > elapsedMs);
   return out.slice(0, limit);
}

// clamp01
assert.strictEqual(clamp01(0.3), 0.3, "mid value unchanged");
assert.strictEqual(clamp01(-1), 0, "negative clamps to 0");
assert.strictEqual(clamp01(2), 1, ">1 clamps to 1");
assert.strictEqual(clamp01(NaN), 0, "NaN -> 0");
assert.strictEqual(clamp01(0), 0, "zero");
assert.strictEqual(clamp01(1), 1, "one");

// formatElapsedMs
assert.strictEqual(formatElapsedMs(0), "0:00", "0ms");
assert.strictEqual(formatElapsedMs(15000), "0:15", "15s");
assert.strictEqual(formatElapsedMs(372000), "6:12", "6m12s");
assert.strictEqual(formatElapsedMs(-5000), "0:00", "negative -> 0:00");

// nextIndex
assert.strictEqual(nextIndex(0, 5), 1, "advance by one");
assert.strictEqual(nextIndex(4, 5), 4, "clamps at last index");
assert.strictEqual(nextIndex(9, 5), 4, "over index clamps at last");
assert.strictEqual(nextIndex(0, 0), 0, "empty -> 0");

// upcomingWorkBeats
const beats = [
      { kind: "prep", startMs: 0, durationMs: 5000 },
      { kind: "work", startMs: 5000, durationMs: 40000, exerciseRef: "squats", round: 1 },
      { kind: "rest", startMs: 45000, durationMs: 15000 },
      { kind: "work", startMs: 60000, durationMs: 40000, exerciseRef: "pushups", round: 1 },
      { kind: "cooldown-hold", startMs: 100000, durationMs: 30000 },
   ];
const up = upcomingWorkBeats(beats, 0, 2);
assert.strictEqual(up.length, 2, "limit caps upcoming");
assert.strictEqual(up[0].exerciseRef, "squats", "first upcoming is the next work beat");
// At a time past the first work beat, only the second is upcoming.
assert.strictEqual(upcomingWorkBeats(beats, 50000, 5).length, 1, "past first work -> one upcoming");
// At run end, none are upcoming.
assert.strictEqual(upcomingWorkBeats(beats, 200000, 5).length, 0, "end -> none upcoming");

console.log("PASS: web pure utils (clamp01/formatElapsedMs/nextIndex/upcomingWorkBeats)");
