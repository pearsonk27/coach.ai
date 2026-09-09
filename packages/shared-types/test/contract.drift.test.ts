/**
 * T-01 — I3 cross-language contract drift TEST (TS side, T3).
 *
 * This is the *typed* half of the agreement the harness (scripts/contract-drift.cjs)
 * proves at runtime. It imports ONLY the language-neutral artifacts — the canonical
 * snapshot plus the two per-language field manifests — and asserts a three-way key/enum
 * agreement, then proves SENSITIVITY by mutating one side in-memory and asserting the
 * comparison breaks. Zero runtime deps (no zod, no vitest), so it type-checks under the
 * package tsconfig and runs the moment a TS runner (tsx/vitest) is installed in T-31.
 *
 * The live gate that CI runs today is `packages/shared-types/test` → the .cjs harness
 * (this file documents the identical assertions in TS for the typed tooling).
 */
import snapshot from "../contract.snapshot.json" with { type: "json" };
import tsManifest from "../contract.fields.ts.json" with { type: "json" };
import pyManifest from "../apps/api/app/contracts/contract.fields.json" with { type: "json" };

// NOTE: the `with { type: "json" }` import + a `tsconfig` `resolveJsonModule` are the
// T-31 addendum. When the TS runner lands this file executes; until then it compiles
// under TS and the .cjs harness carries the equivalent assertion (see CONTEXT.md).

function sig(side: any, type: string): string {
    const t = side.types[type];
    if (!t) return "<<missing>>";
    if (type === "Beat") {
        const base = [...(t.base || [])].sort();
        const members = (t.members || [])
             .map((m: any) => ({kind: m.kind, extra: [...(m.extra || [])].sort()}))
             .sort((a: any, b: any) => (a.kind < b.kind ? -1 : 1));
        return JSON.stringify({base, members});
          }
    return JSON.stringify([...(t.keys || [])].sort());
}

function enumSig(side: any, name: string): string {
    const e = side.enums?.[name];
    return e ? JSON.stringify([...e].sort()) : "<<missing>>";
}

// Canonical key view of the snapshot, so TS/Py manifests are compared on the SAME basis.
function canonicalKeyView(s: any) {
    const types: Record<string, any> = {};
    for (const [name, t] of Object.entries(s.types)) {
      if (name === "Beat") {
        types[name] = {
             base: t.base.map((f: any) => f.key),
             members: t.members.map((m: any) => ({kind: m.kind, extra: m.extra.map((f: any) => f.key)})),
            };
      } else
      types[name] = {keys: t.fields.map((f: any) => f.key)};
      }
    return {enums: s.enums, types};
}

// 3-way: every shared type's signature must agree across TS, Py, and the snapshot.
function threeWayAgree(): string[] {
     const canon = canonicalKeyView(snapshot as any);
     const types = new Set<string>([...Object.keys((snapshot as any).types)]);
     const drifts: string[] = [];
    for (const type of types) {
      const s = [sig(tsManifest, type), sig(pyManifest, type), sig(canon, type)];
       if (new Set(s).size > 1 || s.includes("<<missing>>"))
          drifts.push(`type "${type}": ${s.join("  vs  ")}`);
     }
     // enums agree three ways
    for (const e of Object.keys((snapshot as any).enums)) {
      const s = [enumSig(tsManifest, e), enumSig(pyManifest, e), enumSig(canon, e)];
       if (new Set(s).size > 1) drifts.push(`enum "${e}": ${s.join("  vs  ")}`);
     }
    return drifts;
}

// Sensitivity: a one-sided divergence MUST break agreement.
function sensitivityHolds(): string[] {
     const issues: string[] = [];
     const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
      // drop a TS field
     const badTs = clone(tsManifest);
     delete badTs.types.WorkoutRun.keys;
    const canon = canonicalKeyView(snapshot as any);
     if (sig(badTs, "WorkoutRun") === sig(canon, "WorkoutRun"))
       issues.push("dropping a TS field did NOT break agreement (guard too weak)");
      // drop an enum value on the Py side
     const badPy = clone(pyManifest);
     badPy.enums.RunStatus = badPy.enums.RunStatus.filter((v: string) => v !== "aborted");
     if (enumSig(badPy, "RunStatus") === enumSig(canon, "RunStatus"))
       issues.push("dropping a Py enum value did NOT break agreement (guard too weak)");
    return issues;
}

// Self-executing assertions when run directly; framework calls the exported functions.
const drifts = threeWayAgree();
const sens = sensitivityHolds();
if (drifts.length || sens.length) {
  // eslint-disable-next-line no-console
  console.error("[FAIL] T3 contract drift test:\n  " + [...drifts, ...sens].join("\n  "));
  throw new Error("T3 contract drift assertions failed");
}
// eslint-disable-next-line no-console
console.log("[PASS] T3 contract drift: 3-way agreement holds; sensitivity proven.");

export {threeWayAgree, sensitivityHolds, sig, enumSig};
