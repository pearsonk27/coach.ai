// Regression guard for the cue-duck route. Mirrors apps/web/lib/musicDuck.ts (type-erased; behavior
// must match) -- the pure math the real SoundCloud player volume is driven by.
const assert = require("node:assert");

// ---- mirrors ----
function clamp01(x) {
   if (typeof x !== "number" || Number.isNaN(x)) return 1;
   return x < 0 ? 0 : x > 1 ? 1 : x;
}
function duckVolumePercent(base, level) {
   const pct = 100 * clamp01(base) * clamp01(level);
   return Math.round(Math.max(0, Math.min(100, pct)));
}
function duckRampSchedule(fromPct, toPct, opts = {}) {
   const steps = Math.max(1, opts.steps ?? 4);
   const totalMs = Math.max(1, opts.totalMs ?? 150);
   const from = Math.round(clamp01(fromPct / 100) * 100);
   const to = Math.round(clamp01(toPct / 100) * 100);
   if (from === to) return [];
   const stops = [];
   for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      stops.push({ tMs: Math.round(totalMs * frac), pct: Math.round(from + (to - from) * frac) });
      }
   return stops;
}
// quantised bus
function makeBus() {
   const STEP = 0.05;
   const q = (x) => Math.round(clamp01(x) / STEP) * STEP;
   let level = 1;
   let reason = "idle";
   const subs = new Set();
   return {
      set(levelRaw, newReason = "countdown") {
         const qq = q(levelRaw);
         if (qq === level && newReason === reason) return;
         level = qq;
         reason = newReason;
         subs.forEach((fn) => fn(level, reason));
           },
      on(fn) {
         subs.add(fn);
         fn(level, reason);
         return () => subs.delete(fn);
            },
      snap() {return { level, reason };},
   };
}

// clamp01
assert.strictEqual(clamp01(0.5), 0.5);
assert.strictEqual(clamp01(-1), 0, "negative -> 0");
assert.strictEqual(clamp01(2), 1, ">1 -> 1");
assert.strictEqual(clamp01(NaN), 1, "NaN -> full volume (fail safe, never silent by accident)");

// duckVolumePercent -- the absolute player volume (0..100)
assert.strictEqual(duckVolumePercent(1, 1), 100, "full base, no duck -> 100");
assert.strictEqual(duckVolumePercent(1, 0.3), 30, "full base, 30% duck -> 30");
assert.strictEqual(duckVolumePercent(0.8, 1), 80, "80% base, no duck -> 80");
assert.strictEqual(duckVolumePercent(0.8, 0.3), 24, "80% base, 30% duck -> 24 (rounds)");
assert.strictEqual(duckVolumePercent(1, 0), 0, "muted (level 0) -> 0");
assert.strictEqual(duckVolumePercent(-1, 1), 0, "negative base clamps -> 0");
assert.strictEqual(duckVolumePercent(3, 3), 100, "out-of-range clamps to 100");
// NaN base/level must not produce a bogus volume
assert.strictEqual(duckVolumePercent(NaN, 1), 100, "NaN base -> full (clamp01 fail-safe)");

// duckRampSchedule -- smooth cross
assert.deepStrictEqual(duckRampSchedule(50, 50), [], "same-from/to empty");
assert.deepStrictEqual(duckRampSchedule(100, 30, { steps: 1, totalMs: 100 }), [{ tMs: 100, pct: 30 }],
  "one step lands at target in totalMs");
const ramp = duckRampSchedule(100, 30, { steps: 4, totalMs: 160 });
assert.strictEqual(ramp.length, 4, "4 stops for 4 steps");
assert.strictEqual(ramp[0].pct, Math.round(100 + (30 - 100) * 0.25), "first step is 1/4 toward target");
assert.strictEqual(ramp.at(-1).pct, 30, "final stop reaches target");
assert.ok(ramp.every((s) => s.tMs > 0), "stops are positive delays");
// empty schedule never applies a setVolume (no churn when level hasn't moved)
let calls = 0;
duckRampSchedule(50, 50, { steps: 4 }).forEach(() => { calls++; });
assert.strictEqual(calls, 0, "no-op schedule does nothing");

// the bus quantises per-frame noise and notifies only on a step change
const bus = makeBus();
let seen = 0;
let lastSnap = null;
const unsub = bus.on((lvl) => { seen++; lastSnap = lvl; });
// primed with current
assert.strictEqual(lastSnap, 1, "late subscriber primed to current level");
// within a quantise step AND same reason: no notify
bus.set(0.98, "idle");
assert.strictEqual(bus.snap().level, 1, "0.98 quantises to 1.0 and reason unchanged -> no move");
// cross a step down: one notify
bus.set(0.9, "countdown");
assert.strictEqual(seen, 2, "one new notify after crossing a step");
assert.ok(Math.abs(bus.snap().level - 0.9) < 1e-9, "level settled near 0.9");
// repeated identical writes don't re-notify
const before = seen;
for (let i = 0; i < 50; i++) bus.set(0.9);
assert.strictEqual(seen, before, "identical writes are no-ops (bus throttles the rAF spam)");
// mute -> 0 notifies
bus.set(0, "mute");
assert.ok(seen > before, "mute (0) notifies a subscriber");
assert.strictEqual(duckVolumePercent(1, bus.snap().level), 0, "muted bus level -> 0 volume");
unsub();
// after unsub, set no longer reaches it
const before2 = seen;
bus.set(0.5);
assert.strictEqual(seen, before2, "unsubscribed listener stops getting events");

console.log("PASS: T-42/51 cue-duck route (duckVolumePercent / duckRampSchedule / quantised bus)");
