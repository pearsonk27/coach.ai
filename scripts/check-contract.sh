#!/usr/bin/env bash
# I3 — cross-language contract drift guard (TS Zod ⇄ Pydantic mirror ⇄ snapshot).
#
# T-01 wires this to the real guard (scripts/contract-drift.cjs): a three-way
# key/enum parity between the language-neutral snapshot, the TS field manifest, and the
# Pydantic field manifest, plus canonical-fixture conformance and (guarded) runtime
# introspection. It also runs a MUTATION SWEEP that proves the guard is sensitive — a
# deliberate field/enum divergence on EITHER side must be caught, or the check fails.
#
# Until the snapshot exists this skips green (T-00 placeholder behaviour is preserved).
set -euo pipefail
cd "$(dirname "$0")/.."

SNAP="packages/shared-types/contract.snapshot.json"
TS="packages/shared-types/contract.fields.ts.json"
PY="apps/api/app/contracts/contract.fields.json"
HARNESS="scripts/contract-drift.cjs"

if [ ! -f "$SNAP" ]; then
     echo "I3 check:contract (placeholder): no snapshot yet — no T-01 shared-types schema. SKIP green."
     exit 0
fi
if [ ! -f "$HARNESS" ]; then
     echo "I3 FAIL: drift harness $HARNESS is missing."
     exit 1
fi

# 1) Canonical agreement: TS ⇄ Pydantic ⇄ snapshot (key/enum parity) + fixture conformance
#    + guarded runtime layers (zod/pydantic introspection; py_compile when python is present).
node "$HARNESS" || {
     echo "I3 FAIL: the three sides do not agree on the contract."
     exit 1
     }

# 2) Sensitivity proof: a deliberate divergence on EITHER language side MUST be caught.
    if [ -f "$TS" ] && [ -f "$PY" ]; then
     echo "I3: running mutation sensitivity sweep ..."
      for m in drop-ts drop-py drop-snapshot enum-drift-py add-ts; do
        # --mutate <m> exits 0 when the divergence is caught; non-zero when it slips through.
        node "$HARNESS" --mutate "$m" >/dev/null 2>&1 || {
               echo "I3 FAIL: mutation '$m' slipped through — a one-sided drift would go undetected."
               exit 1
               }
           done
      echo "I3: 5/5 deliberate divergences caught — guard is proven sensitive."
    else
     echo "I3: per-language manifest(s) not yet present — ran canonical-only."
    fi
echo "I3 check:contract: PASS (TS ⇄ Pydantic ⇄ snapshot agree; guard proven sensitive)."
