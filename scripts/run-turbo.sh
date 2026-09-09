#!/usr/bin/env bash
# run-turbo.sh <task> — run a turbo task, or SKIP cleanly when turbo isn't installed.
# T-00 keeps `just typecheck` (etc.) runnable on a not-yet-installed tree: before STOP-D
# sign-off + `just install`, the turbo binary is absent, so the gate SKIPs instead of crashing.
set -euo pipefail
task="$1"
if [ -x "node_modules/.bin/turbo" ]; then
   pnpm run --silent "$task"
else
   echo "SKIP: turbo not installed ('just install' after STOP-D sign-off) - pipeline gate '${task}' not executed"
   exit 0
fi
