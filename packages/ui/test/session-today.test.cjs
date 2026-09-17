// T-51 smoke: today's-session slot resolution. Pure, no deps (mirrors the TS in plain JS).
const assert = require("node:assert");

// Mirror session-today.ts.
function isoDayOfWeek(dateISO) {
   const d = Date.parse(dateISO.length === 10 ? dateISO + "T00:00:00Z" : dateISO);
   if (Number.isNaN(d)) throw new Error("bad date");
   const day = new Date(d).getUTCDay(); // 0=Sun..6=Sat
   return (day + 6) % 7;                // -> Mon=0..Sun=6
}
function slotIndexForDay(dayOfWeek, count) {
   if (count <= 0) return -1;
   return ((dayOfWeek % count) + count) % count;
}

const slots = [
   { slot: 1, kind: "active",  label: "upper",        templateSlug: "hiit-upper-30",      params: {} },
   { slot: 2, kind: "active",  label: "lower",        templateSlug: "hiit-lower-30",      params: {} },
   { slot: 3, kind: "active",  label: "full body",    templateSlug: "hiit-full-body-30",  params: {} },
   { slot: 4, kind: "stretch", label: "stretch-reset", templateSlug: "stretch-reset-15",  params: {} },
];

// Known ISO dates: 2024-01-01 is a Monday.
assert.strictEqual(isoDayOfWeek("2024-01-01"), 0, "2024-01-01 is Monday (dow=0)");
assert.strictEqual(isoDayOfWeek("2024-01-07"), 6, "2024-01-07 is Sunday (dow=6)");

// 4-slot flat 3+1 rotation: Mon->upper, Tue->lower, Wed->full, Thu->stretch, Fri->upper (wrap)
assert.strictEqual(slotIndexForDay(0, 4), 0, "Monday -> slot 0 (upper)");
assert.strictEqual(slotIndexForDay(1, 4), 1, "Tuesday -> slot 1 (lower)");
assert.strictEqual(slotIndexForDay(2, 4), 2, "Wednesday -> slot 2 (full body)");
assert.strictEqual(slotIndexForDay(3, 4), 3, "Thursday -> slot 3 (stretch)");
assert.strictEqual(slotIndexForDay(4, 4), 0, "Friday -> slot 0 (wrap)");
assert.strictEqual(slotIndexForDay(9, 4), 1, "dow wraps mod count");
assert.strictEqual(slotIndexForDay(4, 0), -1, "empty plan => unresolvable (rest by default)");

// The "rest" outcome when unresolvable or the slot is a rest/stress day.
function isRest(slots, dayOfWeek) {
   const idx = slotIndexForDay(dayOfWeek, slots.length);
   const s = idx >= 0 && idx < slots.length ? slots[idx] : null;
   return s ? (s.kind === "rest" || s.templateSlug === null) : true;
}
assert.strictEqual(isRest(slots, 3), false, "Thursday stretch is not a rest day");
assert.strictEqual(isRest([], 0), true, "empty plan defaults to rest");

// DETERMINISM / same week repeated (cycle_weeks=1): Monday this week == Monday next week.
assert.strictEqual(
     slotIndexForDay(isoDayOfWeek("2024-01-01"), 4),
     slotIndexForDay(isoDayOfWeek("2024-01-08"), 4),
     "every week identical (cycle_weeks=1)"
);

console.log("PASS: T-51 session-today resolution (" + slots.length + "-slot flat 3+1, rotation + wrap + rest)");
