# justfile — coach.ai unified command interface.
#
# Mirrors standards/AGENTS.md §Gating / §Verification. The 5 pipeline gates + dev are
# named exactly as the doc lists them. `check:` forms from AGENTS.md are exposed as
# `check-*` because `just` recipe names cannot contain a colon (single-target lookup):
#   just check:env        ->  just check:env is not a valid `just` name; run `just check-env`
#   just check:contract   ->  just check-contract
#   just check:invariants ->  just check-invariants
#   just check:all        ->  just check-all
# (The hyphen mapping is noted in README + the T-00 handoff.)
#
# On a not-yet-installed tree (pre STOP-D sign-off) the turbo-backed gates SKIP cleanly
# so the skeleton stays runnable. After sign-off + `just install`, the SAME recipes run
# the real pipeline (see .github/workflows/ci.yml).

# --- unified pipeline (AGENTS.md §Gating) ------------------------------------
# Run in order: format -> lint -> typecheck -> test -> build.
gates:
   bash scripts/run-turbo.sh format
   bash scripts/run-turbo.sh lint
   bash scripts/run-turbo.sh typecheck
   bash scripts/run-turbo.sh test
   bash scripts/run-turbo.sh build

format:
   bash scripts/run-turbo.sh format

lint:
   bash scripts/run-turbo.sh lint

typecheck:
   bash scripts/run-turbo.sh typecheck

test:
   bash scripts/run-turbo.sh test

build:
   bash scripts/run-turbo.sh build

dev:
   bash scripts/run-turbo.sh dev

install:
   pnpm install

# --- invariant / contract / env hooks (AGENTS.md §Verification) -------------
# Real, runnable hooks. T-01/T-31 fill contract drift (I3); T-10/T-20 fill I1/I2 over
# seed. I4 (fixed-hiit phase-order) runs now over seed/**.
check-env:
   bash scripts/check-env.sh

check-contract:
   bash scripts/check-contract.sh

check-invariants:
   node scripts/check-invariants.cjs

check-all:
   just gates
   just check-env
   just check-contract
   just check-invariants

# --- codegen + seed (T-31 / T-11) -------------------------------------------
generate:
   cd apps/api && ./.venv/bin/python -c "import sys, json; sys.path.insert(0, '.'); from app.main import app; open('openapi.json', 'w').write(json.dumps(app.openapi(), indent=2))"
   node scripts/gen-api-client.cjs

seed-check:
   cd apps/api && ./.venv/bin/python -m app.seed
