#!/usr/bin/env bash
# Configure a worktree's Vite port, label, and DATABASE_URL.
#
# All worktrees share the one Postgres container from the main checkout
# (`docker compose up -d` is a one-time-per-machine step). Isolation is
# by database name: worktree N uses db `analyst_wtN` (N=0 uses plain
# `analyst`). The database itself is created by `prisma migrate dev` on
# first run; this script just writes the config.
#
# Usage: scripts/setup-worktree.sh <N>
#   N=0 is the main checkout; N≥1 is a .claude/worktrees/wtN checkout.
#
# Derived values per worktree N:
#   VITE_PORT      = 3000 + N
#   DB_NAME        = analyst[_wtN]
#   VITE_WT_LABEL  = ""|WT<N>   (shown in page title + sidebar brand)

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

echo
echo "Configured worktree ${N}:"
echo "  DB_NAME       = ${DB_NAME}"
echo "  VITE_PORT     = ${VITE_PORT}"
echo "  VITE_WT_LABEL = ${WT_LABEL:-<none>}"
echo
echo "Next steps (assumes main's postgres is already running):"
echo "  npm run db:migrate  # creates ${DB_NAME} and applies migrations"
echo "  npm run db:seed     # optional; seeds tickers/factors"
echo "  npm run dev         # → http://localhost:${VITE_PORT}/"
