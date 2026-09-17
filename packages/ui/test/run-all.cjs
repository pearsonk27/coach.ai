// Runs every *.test.cjs in this folder in-process. Each test file throws on failure via
// node:assert, so the first failing file aborts the suite (non-zero exit). Pure, no deps.
const fs = require("node:fs");
const path = require("node:path");

const dir = __dirname;
const files = fs
   .readdirSync(dir)
   .filter((f) => f.endsWith(".test.cjs") && f !== "run-all.cjs")
   .sort();

if (files.length === 0) throw new Error("no *.test.cjs files found in test/");

for (const f of files) {
   console.log("--- " + f + " ---");
   require(path.join(dir, f)); // executes on load; asserts throw on mismatch
   }

console.log(`OK: ran ${files.length} ui test file(s)`);
