// Runs every apps/web/test/*.test.cjs. Pure, no DOM/React deps (same pattern as packages/ui).
const fs = require("node:fs");
const path = require("node:path");
const dir = __dirname;
const files = fs
  .readdirSync(dir)
   .filter((f) => f.endsWith(".test.cjs"))
   .sort();
if (files.length === 0) throw new Error("no web test files found in apps/web/test/");
for (const f of files) {
   console.log("--- " + f + " ---");
   require(path.join(dir, f));
    }
console.log(`OK: ran ${files.length} web test file(s)`);
