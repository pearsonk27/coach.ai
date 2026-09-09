#!/usr/bin/env bash
# I5 — env alignment.
# Invariant (AGENTS.md): .env.example must ⊇ every env var the code reads, and every
# documented var should be referenced somewhere. On T-00 no code reads env yet, so
# "used ⊆ documented" holds trivially. This hook guards that a real var is never added
# to a package without being documented in .env.example. Portable (no GNU sed -E, no
# pipefail over no-match greps which is what trips on a green/empty tree).
set -u
cd "$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -s ".env.example" ]; then
   echo "I5 FAIL: .env.example missing or empty"
   exit 1
fi

# Documented keys = NON-COMMENT lines "KEY=...".
documented="$(grep -E '^[A-Z_][A-Z0-9_]*=' .env.example | awk -F= '{print $1}' | sort -u)"

# Used vars: process.env.X / process.env["X"] / os.environ[...] / os.getenv("X")
# over source, lowercased tokens filtered to UPPER keys. Empty at T-00 (no code yet).
used="$(
   grep -rhoE 'process\.env[.[]"A-Za-z_][A-Za-z0-9_]*|os\.(environ|getenv)[[(]"A-Za-z_][A-Za-z0-9_]*/' \
       apps packages 2>/dev/null | grep -oE '[A-Z_][A-Z0-9_]*' | sort -u
)" || used=""

echo "I5 check:env (documented keys vs code-read env vars):"
if [ -n "$documented" ]; then
   printf '%s\n' "$documented" | sed 's/^/  documented: /'
else
   echo "  documented: (none yet)"
fi
if [ -n "$used" ]; then
   printf '%s\n' "$used" | sed 's/^/  used:       /'
else
   echo "  used:        (none — no code reads env at T-00)"
fi

fail=0
if [ -n "$used" ]; then
   miss="$(comm -23 <(printf '%s\n' "$used") <(printf '%s\n' "$documented") | grep -v '^$' || true)"
   if [ -n "$miss" ]; then
      echo "I5 FAIL: code reads these env vars but they are NOT in .env.example:"
      printf '%s\n' "$miss" | sed 's/^/  MISSING: /'
      fail=1
   fi
fi

if [ "$fail" -eq 0 ]; then
   echo "I5 PASS: .env.example aligns with code-read env vars."
   exit 0
fi
echo "I5 RESULT: fail"
exit 1
