#!/usr/bin/env bash
# pg.sh — provision a throwaway PostgreSQL-18 instance via Docker for the coach.ai API.
#
# The API itself is DB-free (in-memory store, T-30): `just gates`/`pytest` stay green with NO
# Postgres. This script exists to UN-SKIP the DB-bound paths the design targets on PG-18
# (`uuidv7()` PKs, JSONB) — `test_migration_applies.py` (Alembic upgrade->base round-trip) and
# `test_pg_smoke.py` (seed_all idempotency + I2-over-persistence). Both skip cleanly when no
# DSN is set; hand either a DSN and they run for real. See HANDOFF.md blocker #1.
#
# Usage:
#   scripts/pg.sh up        # start (or re-attach to) the PG-18 container + create the db(s); prints DSN
#   scripts/pg.sh down      # stop + remove the container
#   scripts/pg.sh status    # print running state
#   scripts/pg.sh seed      # materialise the schema + seed into the main db (load_seed)
#   scripts/pg.sh tests     # run the API pytest suite with the DSN exported (un-skips PG paths)
#
# Everything is env-overridable (defaults match .github/workflows/ci.yml + .env.example):
#   PG_IMAGE PG_NAME PG_PORT PG_USER PG_PASS PG_DB PG_DB_TEST
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"

# --- config (override via env; defaults match CI + .env.example) -------------
PG_IMAGE="${PG_IMAGE:-postgres:18}"
PG_NAME="${PG_NAME:-coach-pg18}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-coach}"
PG_PASS="${PG_PASS:-coach}"
PG_DB="${PG_DB:-coach}"
PG_DB_TEST="${PG_DB_TEST:-coach_test}"

# psycopg v3 is the installed driver (no psycopg2), so pin the `+psycopg` dialect.
DSN="postgresql+psycopg://${PG_USER}:${PG_PASS}@localhost:${PG_PORT}/${PG_DB}"
DSN_TEST="postgresql+psycopg://${PG_USER}:${PG_PASS}@localhost:${PG_PORT}/${PG_DB_TEST}"

need_docker() {
   command -v docker >/dev/null 2>&1 || {
      echo "pg: docker not found on PATH" >&2
      exit 1
   }
}

# Ensure the named db exists (CREATE DATABASE has no IF-NOT-EXISTS). Idempotent via a probe.
ensure_db() {
   local db="$1"
   # -i stdin + PGPASSWORD so we don't prompt over the TCP/host connection.
   if docker exec -i "$PG_NAME" psql -h 127.0.0.1 -U "$PG_USER" -d postgres \
      -c "SELECT 1 FROM pg_database WHERE datname='${db}'" \
      | grep -q 1; then
      :
   else
      docker exec -i "$PG_NAME" psql -h 127.0.0.1 -U "$PG_USER" -d postgres \
         -c "CREATE DATABASE ${db}"
   fi
}

# Block until the server accepts connections (up to ~30s), then return.
wait_ready() {
   local i
   for i in $(seq 1 30); do
      if docker exec "$PG_NAME" pg_isready -h 127.0.0.1 -U "$PG_USER" -d "$PG_DB" \
         >/dev/null 2>&1; then
         return 0
      fi
      sleep 1
   done
   echo "pg: ${PG_NAME} not ready after 30s (see 'docker logs ${PG_NAME}')" >&2
   return 1
}

cmd_up() {
   need_docker
   local state
   state="$(docker ps -q --filter "name=^${PG_NAME}$" | head -n1 || true)"
   local stopped
   stopped="$(docker ps -aq --filter "name=^${PG_NAME}$" | head -n1 || true)"

   if [ -n "$state" ]; then
      echo "pg: ${PG_NAME} already running"
   elif [ -n "$stopped" ]; then
      echo "pg: re-starting stopped container ${PG_NAME}"
      docker start "$PG_NAME"
      wait_ready
   else
      echo "pg: starting ${PG_IMAGE} as ${PG_NAME}"
      docker run -d --name "$PG_NAME" \
         -p "${PG_PORT}:5432" \
         -e "POSTGRES_USER=${PG_USER}" \
         -e "POSTGRES_PASSWORD=${PG_PASS}" \
         -e "POSTGRES_DB=${PG_DB}" \
         "$PG_IMAGE" >/dev/null
      wait_ready
   fi

   # The main db comes from POSTGRES_DB; create the test db for the live migration round-trip.
   ensure_db "$PG_DB"
   ensure_db "$PG_DB_TEST"
   echo "pg: ready -> ${DSN}"
}

cmd_down() {
   need_docker
   docker rm -f "$PG_NAME" 2>/dev/null \
      && echo "pg: removed ${PG_NAME}" \
      || echo "pg: ${PG_NAME} not running"
}

cmd_status() {
   need_docker
   if docker ps -q --filter "name=^${PG_NAME}$" | grep -q .; then
      echo "pg: ${PG_NAME} running"
      docker ps --filter "name=^${PG_NAME}$" --format "  {{.Names}}\t{{.Status}}\t{{.Ports}}"
   else
      echo "pg: ${PG_NAME} not running"
   fi
}

cmd_seed() {
   [ -f "$API_DIR/.venv/bin/python" ] || {
      echo "pg: $API_DIR/.venv/bin/python missing (run 'just install' / 'uv sync' first)" >&2
      exit 1
   }
   (
      cd "$API_DIR"
      PGPASSWORD="$PG_PASS" DATABASE_URL="$DSN" ./.venv/bin/python -c \
         "import sys; sys.path.insert(0,'.'); from app.seed import load_seed; import json; print(json.dumps(load_seed('${DSN}'), indent=2))"
   )
}

cmd_tests() {
   [ -f "$API_DIR/.venv/bin/python" ] || {
      echo "pg: $API_DIR/.venv/bin/python missing (run 'just install' / 'uv sync' first)" >&2
      exit 1
   }
   (
      cd "$API_DIR"
      DATABASE_URL="$DSN_TEST" \
      TEST_DATABASE_URL="$DSN_TEST" \
      PG_TEST_DSN="$DSN_TEST" \
      ./.venv/bin/python -m pytest
   )
}

case "${1:-}" in
   up)    cmd_up ;;
   down)  cmd_down ;;
   status) cmd_status ;;
   seed)  cmd_seed ;;
   tests) cmd_tests ;;
   *)
      echo "usage: scripts/pg.sh {up|down|status|seed|tests}"
      exit 2
      ;;
esac
