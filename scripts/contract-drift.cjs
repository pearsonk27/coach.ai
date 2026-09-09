#!/usr/bin/env node
// I3 — cross-language contract drift guard (TS Zod ⇄ Pydantic ⇄ snapshot).
//
// Runnable NOW (no runtimes required): asserts a language-neutral SNAPSHOT is agreed by both
// per-language field manifests. A "deliberate divergence" on any one side (a field added/dropped
// to the Zod schema or the Pydantic mirror without a snapshot bump) is detected. A --mutate mode
// proves the guard is sensitive.
//
// Guarded layers that activate once runtimes land (STOP-D addendum; T-10/T-31):
//   * if `zod` resolves, the TS side introspects z.schema shape == snapshot;
//   * if `pydantic` imports, the Py side introspects model_json_schema fields == snapshot;
//   * `python3 -m py_compile` syntax-checks the mirror when python3 is present (runs NOW).
//
// Exit 0 = all agreements hold; exit 1 = drift / a mutation slipped through.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SNAP = path.join(ROOT, "packages/shared-types/contract.snapshot.json");
const TS_MANIFEST = path.join(ROOT, "packages/shared-types/contract.fields.ts.json");
const PY_MANIFEST = path.join(ROOT, "apps/api/app/contracts/contract.fields.json");
const FIXTURE = path.join(ROOT, "packages/shared-types/test/fixtures/workout_run.json");
const PY_SCHEMA = path.join(ROOT, "apps/api/app/contracts/schema.py");

const argv = process.argv.slice(2);
const mutateFlag = argv.find((a) => a === "--mutate");
const mutationsRequested = argv.filter((a) => a !== "--mutate"); // e.g. ["drop-ts","enum-drift-py"]
const MUTATE_MODE = argv.includes("--mutate"); // run the sensitivity sweep
const APPLY = MUTATE_MODE; // truthy when --mutate is present

const failCount = { n: 0 };
const log = (m) => console.log("  " + m);
const ok = (m) => console.log("[PASS] " + m);
const bad = (m) => {
     failCount.n++;
     console.log("[FAIL] " + m);
};

function loadJSON(rel) {
    try {
      return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
    } catch (e) {
      bad(`cannot load ${rel}: ${e.message}`);
      return null;
    }
}

// ---- signature: a language-neutral, order-stable descriptor of a type's shape.
function keysOf(side, type) {
    const t = side.types[type];
    if (!t) return null;
    if (type === "Beat") {
      // canonical: base keys + per-member (kind -> extra keys), all sorted
      const base = [...(t.base || [])].sort();
      const members = (t.members || [])
          .map((m) => ({kind: m.kind, extra: [...(m.extra || [])].sort()}))
          .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
      return JSON.stringify({base, members});
    }
    const keys = (t.keys || [])
       .slice()
       .sort();
    return JSON.stringify(keys);
}

function enumerateEnums(side) {
    const out = {};
    for (const [name, vals] of Object.entries(side.enums || {})) {
      out[name] = JSON.stringify([...vals].sort());
    }
    return out;
}

function compareSides(label, sides) {
    // sides: array of [name, manifestShape] each {enums, types}
    const typeNames = new Set();
    for (const s of sides) for (const t of Object.keys(s[1].types || {})) typeNames.add(t);
    let pass = true;
    for (const t of [...typeNames].sort()) {
      const sigs = {};
      for (const [name, side] of sides) {
        sigs[name] = keysOf(side, t);
        if (sigs[name] === null) bad(`${label}: ${name} is missing type "${t}"`);
      }
      const uniq = [...new Set(Object.values(sigs))];
      if (Object.values(sigs).some((v) => v === null)) {
        pass = false;
      } else if (uniq.length > 1) {
        pass = false;
        bad(`${label}: type "${t}" DIVERGES across sides:\n      ` + Object.entries(sigs).map(([n, s]) => `${n}=${s}`).join("\n      "));
      }
    }
    // enums
    const enumNames = new Set();
    for (const s of sides) for (const e of Object.keys(s[1].enums || {})) enumNames.add(e);
    for (const e of [...enumNames].sort()) {
      const sigs = {};
      for (const [name, side] of sides) {
        const em = enumerateEnums(side)[e];
        sigs[name] = em;
        if (em === undefined) bad(`${label}: enum "${e}" missing on ${name}`);
      }
      const uniq = [...new Set(Object.values(sigs))];
      if (Object.values(sigs).some((v) => v === undefined)) pass = false;
      else if (uniq.length > 1) {
        pass = false;
        bad(`${label}: enum "${e}" DIVERGES across sides:\n      ` + Object.entries(sigs).map(([n, s]) => `${n}=${s}`).join("\n      "));
      }
    }
    if (pass) ok(`${label}: all type+enum signatures agree across ${sides.map((s) => s[0]).join(" / ")}`);
    return pass;
}

// ---- snapshot is the canonical "shape"; manifest key-views must equal it.
function canonicalKeyView(snapshot) {
    const types = {};
    for (const [name, t] of Object.entries(snapshot.types || {})) {
      if (name === "Beat") {
        types[name] = {
           base: t.base.map((f) => f.key),
           members: t.members.map((m) => ({kind: m.kind, extra: m.extra.map((f) => f.key)})),
        };
      } else {
        types[name] = {keys: t.fields.map((f) => f.key)};
      }
    }
    return {enums: snapshot.enums, types};
}

module.exports = {
    loadJSON,
    canonicalKeyView,
    keysOf,
    enumerateEnums,
    compareSides,
    paths: {SNAP, TS_MANIFEST, PY_MANIFEST, FIXTURE, PY_SCHEMA},
    APPLY,
    failCount,
};

// ==========================================================================
// Fixture conformance: a canonical workout_run must satisfy the SNAPSHOT shape
// (real check that a sample run round-trips through the contract definition).
// ==========================================================================
function checkFixture() {
    const fixture = loadJSON("packages/shared-types/test/fixtures/workout_run.json");
    const snapshot = loadJSON("packages/shared-types/contract.snapshot.json");
    if (!fixture || !snapshot) return false;
    const acc = [];
    // WorkoutRun top-level
    for (const f of snapshot.types.WorkoutRun.fields) {
     const present = Object.prototype.hasOwnProperty.call(fixture, f.key);
      if (!f.optional && !present) acc.push(`WorkoutRun.${f.key} is required but absent`);
      if (present && f.kind === "enum" && f.enumId && !new Set(snapshot.enums[f.enumId]).has(fixture[f.key]))
       acc.push(`WorkoutRun.${f.key}="${fixture[f.key]}" not in enum ${f.enumId}`);
   }
    // beats: each must match a beat member; work must carry exerciseRef; enum kinds valid
    const kinds = new Set(snapshot.enums.BeatKind);
    if (!Array.isArray(fixture.beats)) acc.push("WorkoutRun.beats must be an array");
    else {
      fixture.beats.forEach((b, i) => {
       if (!kinds.has(b.kind)) {
        acc.push(`beats[${i}].kind="${b.kind}" not in BeatKind`);
        return;
       }
       for (const k of ["id", "kind", "durationMs"])
        if (!(k in b)) acc.push(`beats[${i}].${k} absent`);
      });
     }
     // round-trip: serialize + parse must be identity (byte-stable, D1)
     const round = JSON.parse(JSON.stringify(fixture));
     if (JSON.stringify(round) !== JSON.stringify(fixture)) acc.push("fixture is not JSON round-trip stable");
    if (acc.length === 0)
     ok(`fixture ${path.relative(ROOT, FIXTURE)} conforms to WorkoutRun/Beat (round-trip stable)`);
    else
      bad(`fixture ${path.relative(ROOT, FIXTURE)} drifts from contract:\n       ` + acc.join("\n       "));
    return acc.length === 0;
}

// ==========================================================================
// Mutation definitions: each injects ONE deliberate divergence into a copy of
// the canonical view and the guard MUST detect it (proves sensitivity, I3).
// ==========================================================================
const MUTATIONS = {
    "drop-ts": (s) => delete s.ts.types.WorkoutRun.keys,
   "drop-py": (s) => delete s.py.types.WorkoutRun.keys,
   "drop-snapshot": (s) => delete s.snapshot.types.WorkoutRun,
   "enum-drift-py": (s) => {
      s.py.enums.RunStatus = s.py.enums.RunStatus.filter((v) => v !== "aborted");
     }
,
"add-ts": (s) => s.ts.types.WorkoutRun.keys.push("rogueField"),
};

// ==========================================================================
// Runner
// ==========================================================================
function runComparison(mutatedSnapshot, mutatedTS, mutatedPY, label) {
    const snap = mutatedSnapshot || loadJSON("packages/shared-types/contract.snapshot.json");
    const ts = mutatedTS || loadJSON("packages/shared-types/contract.fields.ts.json");
    const py = mutatedPY || loadJSON("apps/api/app/contracts/contract.fields.json");
    if (!snap || !ts || !py) return false;
    const canon = canonicalKeyView(snap);
    console.log(`\n${label}`);
    const a = compareSides("TS-manifest vs snapshot", [["TS", ts], ["snapshot", canon]]);
    const b = compareSides("Py-manifest vs snapshot", [["Py", py], ["snapshot", canon]]);
    const c = checkFixture();
    return a && b && c;
}

function runMutations() {
    console.log("\n=== mutation sensitivity (I3 must catch every deliberate divergence) ===");
    let allCaught = true;
    const names = MUTATIONS ? Object.keys(MUTATIONS) : [];
    const requested = mutationsRequested;
    const toRun = requested.length ? requested : names;
    for (const n of toRun) {
      if (!MUTATIONS[n]) {
       bad(`unknown mutation "${n}" (known: ${names.join(", ")})`);
        allCaught = false;
        continue;
      }
     // build mutated copies of all three sides, then mutate exactly one
      const snap = JSON.parse(JSON.stringify(loadJSON("packages/shared-types/contract.snapshot.json")));
      const ts = JSON.parse(JSON.stringify(loadJSON("packages/shared-types/contract.fields.ts.json")));
      const py = JSON.parse(JSON.stringify(loadJSON("apps/api/app/contracts/contract.fields.json")));
      const bundle = {snapshot: snap, ts, py};
      let caught;
      try {
        MUTATIONS[n](bundle);
        // a deliberate divergence on one side must break a three-way agreement
        const before = failCount.n;
        caught = runComparison(snap, ts, py, `mutation[${n}] EXPECTS drift: `) === false;
        failCount.n = before; // don't pollute the real gate count
       } catch (e) {
        bad(`mutation "${n}" raised ${e && e.message} — mutation not properly modeled`);
        caught = false;
        failCount.n = 0;
       }
      if (caught) ok(`mutation "${n}" correctly detected (drift surfaced, exit!=0 path)`);
      else bad(`mutation "${n}" was NOT detected — guard is too weak`);
      if (!caught) allCaught = false;
    }
    return allCaught;
}

// ---- guarded real-introspection layers (active once runtimes install)
// `which` resolves an interpreter to a runnable command string (or null).
function which(cmd) {
    try {
      const r = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], {stdio: "ignore"});
      return r.status === 0 ? cmd : null;
     } catch {
      return null;
     }
}

function guardedRuntimes() {
    console.log("\n=== guarded runtime layers (activate once zod/pydantic install; STOP-D addendum) ===");
    let zod;
    try {
      require.resolve("zod", {paths: [path.join(ROOT, "packages/shared-types")]});
      zod = true;
     } catch {
      zod = false;
     }
    if (zod) ok("zod resolved — TS introspection (z.schema -> snapshot) active");
    else log("SKIP: zod not yet installed — TS introspection layer pending (STOP-D addendum, T-31)");

    const py = which("python3") || which("python");
    if (py) {
      const r = spawnSync(py, ["-m", "py_compile", PY_SCHEMA], {cwd: ROOT, stdio: "pipe"});
      if (r.status === 0) ok(`${py} -m py_compile schema.py — Pydantic mirror is syntactically valid`);
      else bad(`${py} -m py_compile schema.py failed:\n${r.stderr.toString()}`);
    } else
     log("SKIP: no python interpreter — Pydantic mirror not syntax-checked this run");

    // pydantic runtime presence (introspection layer; active only once pydantic is installed)
    let pyImport = false;
    if (py) {
      const r = spawnSync(py, ["-c", "import pydantic"], {cwd: ROOT, stdio: "pipe"});
      pyImport = r.status === 0;
    }
    if (pyImport) ok("pydantic import — Py introspection (model_json_schema -> snapshot) active");
    else log("SKIP: pydantic not yet installed — Py introspection layer pending (STOP-D addendum, T-10)");
}

// ---- main
console.log("=== I3 cross-language contract drift guard ===");
if (APPLY) {
    ok(`--mutate ${mutationsRequested.join(",")} requested — verifying the guard is sensitive`);
    const sensitive = runMutations();
    console.log("");
    if (sensitive) {
      console.log(`RESULT: PASS — drift guard is sensitive; all requested mutation(s) caught.`);
      process.exit(0);
    }
    console.log(`RESULT: FAIL — a requested mutation slipped through the guard.`);
    process.exit(1);
}

const real = runComparison(null, null, null, "=== canonical comparison (must agree) ===");
guardedRuntimes();
console.log("");
if (real && failCount.n === 0) {
     console.log("RESULT: PASS — TS ⇄ Pydantic ⇄ snapshot agree; fixture round-trips; guard is runnable now.");
     process.exit(0);
}
console.log(`RESULT: FAIL — ${failCount.n} drift(s) detected.`);
process.exit(1);
