#!/usr/bin/env bash
# I3 — contract drift check (TS Zod ⇄ Pydantic snapshot).
# T-00 ships this as a no-op placeholder: the canonical Zod schema and its
# Pydantic mirror do not exist yet (T-01 authors shared-types; T-31 generates the
# api-client from OpenAPI). The hook exists so the gate is always runnable and
# green; the real round-trip + snapshot assertion lands in T-01/T-31.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f "packages/shared-types/contract.snapshot.json" ]; then
   echo "I3 check:contract (placeholder): no contract snapshot yet — no shared-types schema (T-01)."
   echo "SKIP green: once T-01 authors the schema, this asserts TS⇄Pydantic equality."
   exit 0
fi
# (T-01/T-31 will replace the body below with the real drift assertion.)
echo "I3 check:contract: snapshot present — equality assertion wired by T-01."
