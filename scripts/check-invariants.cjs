#!/usr/bin/env node
// Invariant checks over the seed catalog (AGENTS.md I1/I2/I4).
//
// T-00 shipped I4 (fixed-hiit phase-order) + JSON well-formedness. T-20 adds I1/I2 via the pure
// `buildTimeline` engine (Node half: ./build-timeline.cjs; Python half: apps/api/app/engine).
//   I1 — `workout_run.beats` is BUILT by buildTimeline, never hand-authored: we assert the engine
//        yields a non-empty beat array for every seed workout.
//   I2 — `buildTimeline(...).totalSeconds == workout_template.total_seconds` for un-scaled templates.
//   I4/I7 — `fixed-hiit` structure is a TAG, not a DB limit: the 5-phase order invariant applies
//        ONLY to templates whose `structure === "fixed-hiit"`.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FIXED_HIIT_PHASES = [
   "warmup",
   "main_circuit",
   "accessory_circuit",
   "abs_cardio",
   "static_stretch",
];

const fail = (m) => {
   console.error("FAIL: " + m);
   process.exitCode = 1;
};

function readJson(file) {
   try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
   } catch (e) {
      fail(`invalid JSON in ${path.relative(ROOT, file)}: ${e.message}`);
      return null;
   }
}

// 1. Well-formedness (anti-drift floor: catalog cross-checks live in T-11).
const seedDir = path.join(ROOT, "seed");
const jsonFiles = [
   "catalog.json",
   "workouts/hiit-upper-30.json",
   "workouts/hiit-lower-30.json",
   "workouts/hiit-full-body-30.json",
   "workouts/stretch-reset-15.json",
   "plans/fullbody-periodized.json",
];
for (const rel of jsonFiles) {
   const f = path.join(seedDir, rel);
   if (!fs.existsSync(f)) {
      fail(`missing seed file ${rel}`);
      continue;
   }
   readJson(f);
}

// 2. The pure engine + a slug-indexed catalog (fills default cues, never changes geometry).
const { buildTimeline, totalSecondsOf } = require("./build-timeline.cjs");
const catalogRaw = readJson(path.join(seedDir, "catalog.json"));
const catalogBySlug = {};
for (const ex of (catalogRaw && catalogRaw.exercises) || []) catalogBySlug[ex.slug] = ex;

// 3. Per-template checks.
const checked = fs
   .readdirSync(path.join(seedDir, "workouts"))
   .filter((n) => n.endsWith(".json"))
   .map((n) => readJson(path.join(seedDir, "workouts", n)))
   .filter(Boolean);

for (const t of checked) {
   const phases = (t.phases || []).map((p) => p.phase_type);
   if (t.structure === "fixed-hiit") {
      const ok =
         phases.length === FIXED_HIIT_PHASES.length &&
         phases.every((p, i) => p === FIXED_HIIT_PHASES[i]);
      if (ok) {
         console.log(`I4 OK: ${t.slug} (${FIXED_HIIT_PHASES.join(" → ")})`);
       } else {
         fail(`${t.slug} is fixed-hiit but phases are [${phases.join(", ")}]`);
       }
    } else {
      console.log(`I4 SKIP: ${t.slug} is ${t.structure} (tag-exempt, I7)`);
    }

   // ---- T-20: I1 (beats are built, non-empty) + I2 (rebuilt total == stored) ----
    const beats = buildTimeline(t, undefined, catalogBySlug);
    const rebuilt = totalSecondsOf(t);
    const stored = t.total_seconds;
    if (beats.length > 0 && rebuilt === stored) {
       console.log(`I1/I2 OK: ${t.slug} rebuilt=${rebuilt}s == stored=${stored}s (beats=${beats.length})`);
    } else {
       if (beats.length === 0) fail(`${t.slug}: I1 buildTimeline produced zero beats`);
       fail(`${t.slug}: I2 rebuilt total ${rebuilt}s != stored ${stored}s`);
    }

   // ---- I5: each exercise appears at most once per workout (single-pass flow). ----
   //      A repeated exercise inside one template is a design smell (e.g. glute-bridge in
   //      warmup AND main AND accessory). The seed flows are single-pass; this guards against
   //      re-introducing a duplicate. Counts slugs across every phase's items.
   const seen = new Map();
   for (const ph of t.phases || []) {
      for (const it of ph.items || []) {
         const slug = it.exercise;
         seen.set(slug, (seen.get(slug) || 0) + 1);
      }
   }
   const dups = [...seen.entries()].filter(([, n]) => n > 1);
   if (dups.length === 0) {
      console.log(`I5 OK: ${t.slug} ${seen.size} distinct exercises, no repeats`);
   } else {
      fail(`${t.slug}: I5 repeated exercise(s): ${dups.map(([s, n]) => `${s}×${n}`).join(", ")}`);
   }
 }

if (process.exitCode === 1) {
   process.exit(1);
}
console.log(
   "Invariants: I1/I2 pass over seed/** (buildTimeline rebuilt == stored total) · " +
      "I4 fixed-hiit phase-order · well-formed seed JSON.",
);
