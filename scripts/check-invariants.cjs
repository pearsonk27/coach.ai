#!/usr/bin/env node
// Invariant checks over the seed catalog (AGENTS.md I1/I2/I4).
//
// T-00 ships I4 (fixed-hiit phase-order) as a real, runnable check + JSON
// well-formedness. I1 (beats built by buildTimeline) and I2 (rebuilt total ==
// stored total) require the pure `buildTimeline` engine from T-20, so they are
// TODO here — the placeholders pass until T-20 fills them in.
//
// I4 / I7: `fixed-hiit` structure is a TAG, not a DB limit. The 5-phase order
// invariant applies ONLY to templates whose `structure === "fixed-hiit"`.
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
   console.error("I4 FAIL: " + m);
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

// 2. I4 — fixed-hiit templates carry exactly the 5 phases, in order.
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
}

if (process.exitCode === 1) {
   process.exit(1);
}
console.log(
   "Invariants: I4 pass over seed/** · I1/I2 TODO (await T-20 buildTimeline) · well-formed seed JSON."
);
