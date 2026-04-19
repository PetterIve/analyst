#!/usr/bin/env bash
# Configure a worktree's port and .env.local.
#
# Usage: scripts/setup-worktree.sh <N>
#   N=0 is the main checkout; N≥1 is a .claude/worktrees/wtN checkout.
#
# All worktrees share the single Postgres container from docker-compose.yml
# (localhost:5434). Per-worktree isolation is by database NAME inside that
# instance, not by container — N=0 uses db `analyst`, N≥1 uses `analyst_wtN`.
#
# Derived values per worktree N:
#   VITE_PORT      = 3000 + N            (dev server)
#   DATABASE_URL   = postgres://…/analyst[_wtN]
#   VITE_WT_LABEL  = ""|WT<N>            (shown in page title + sidebar brand)

set -euo pipefail

N="${1:-}"
if ! [[ "$N" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <worktree-number>" >&2
  exit 1
fi

VITE_PORT=$((3000 + N))
if [[ "$N" == "0" ]]; then
  DB_NAME="analyst"
  WT_LABEL=""
else
  DB_NAME="analyst_wt${N}"
  WT_LABEL="WT${N}"
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_LOCAL="$REPO_ROOT/.env.local"

# --- .env.local (read by Vite / dotenv-cli) ----------------------------------
touch "$ENV_LOCAL"

update_var() {
  local key="$1"
  local val="$2"
  local tmp
  tmp="$(mktemp)"
  grep -vE "^${key}=" "$ENV_LOCAL" > "$tmp" || true
  if [[ -n "$val" ]]; then
    echo "${key}=${val}" >> "$tmp"
  fi
  mv "$tmp" "$ENV_LOCAL"
}

# For N>=1, inherit per-user secrets from the main worktree's .env.local so
# Clerk / Sentry / Anthropic / etc. don't have to be pasted by hand in every
# worktree. Per-worktree overrides (VITE_PORT, DATABASE_URL, …) below take
# precedence over anything pulled in here.
if [[ "$N" != "0" ]]; then
  MAIN_DIR="$(git -C "$REPO_ROOT" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2; exit}')"
  MAIN_ENV="${MAIN_DIR:-}/.env.local"
  if [[ -n "$MAIN_DIR" && -f "$MAIN_ENV" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
      key="${line%%=*}"
      # Don't copy keys that the worktree script owns below.
      case "$key" in
        VITE_PORT|VITE_WT_LABEL|DATABASE_URL) continue ;;
      esac
      if ! grep -qE "^${key}=" "$ENV_LOCAL" 2>/dev/null; then
        printf '%s\n' "$line" >> "$ENV_LOCAL"
      fi
    done < "$MAIN_ENV"
    echo "Inherited secrets from $MAIN_ENV"
  fi
fi

update_var VITE_PORT "$VITE_PORT"
update_var VITE_WT_LABEL "$WT_LABEL"
update_var DATABASE_URL "postgresql://analyst:analyst@localhost:5434/${DB_NAME}"

# --- create the per-worktree database if Postgres is reachable --------------
# The shared container is `analyst-postgres-1` (compose project `analyst`).
PG_CONTAINER="$(docker ps --filter 'label=com.docker.compose.project=analyst' --filter 'label=com.docker.compose.service=postgres' --format '{{.Names}}' 2>/dev/null | head -n1 || true)"
if [[ -n "$PG_CONTAINER" ]]; then
  # CREATE DATABASE isn't idempotent in Postgres; guard with a SELECT.
  EXISTS="$(docker exec "$PG_CONTAINER" psql -U analyst -d analyst -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null || true)"
  if [[ "$EXISTS" != "1" ]]; then
    docker exec "$PG_CONTAINER" psql -U analyst -d analyst -c \
      "CREATE DATABASE \"${DB_NAME}\" OWNER analyst" >/dev/null
    echo "Created database ${DB_NAME} in ${PG_CONTAINER}"
  else
    echo "Database ${DB_NAME} already exists in ${PG_CONTAINER}"
  fi
else
  echo "Note: shared Postgres container not running — start it with 'docker compose up -d' in the main worktree, then run:"
  echo "  docker exec <container> psql -U analyst -d analyst -c 'CREATE DATABASE \"${DB_NAME}\" OWNER analyst'"
fi

echo
echo "Configured worktree ${N}:"
echo "  VITE_PORT      = ${VITE_PORT}"
echo "  DATABASE_URL   = postgresql://analyst:analyst@localhost:5434/${DB_NAME}"
echo "  VITE_WT_LABEL  = ${WT_LABEL:-<none>}"
echo
echo "Next steps:"
echo "  npm run db:migrate    # apply Prisma schema to ${DB_NAME}"
echo "  npm run dev           # → http://localhost:${VITE_PORT}/"
