#!/usr/bin/env bash
# Start/stop/restart/status/logs for the Vite dev server as a detached
# daemon. Useful when driving dev from tools (Claude Code, CI) that kill
# backgrounded commands between turns — nohup + disown makes the server
# outlive its launching shell.
#
# Usage: scripts/dev-daemon.sh {start|stop|restart|status|logs}
#
# State files (gitignored):
#   .dev.pid  — pid of the dev process
#   .dev.log  — stdout+stderr of the dev server

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/.dev.pid"
LOG_FILE="$ROOT/.dev.log"

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

start() {
  if is_running; then
    echo "dev already running (pid $(cat "$PID_FILE")). Logs: $LOG_FILE"
    return 0
  fi
  cd "$ROOT"
  # nohup + </dev/null + & detaches from the parent shell; child survives
  # when the launching bash call exits.
  nohup npm run dev:fg </dev/null >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  disown || true
  echo "dev started (pid $(cat "$PID_FILE")). Logs: $LOG_FILE"
}

stop() {
  if ! is_running; then
    echo "dev not running"
    rm -f "$PID_FILE"
    return 0
  fi
  PID="$(cat "$PID_FILE")"
  # Kill children first (vite workers, etc.), then the root pid.
  pkill -P "$PID" 2>/dev/null || true
  kill "$PID" 2>/dev/null || true
  # Give it a second to drain.
  for _ in 1 2 3 4 5; do
    if ! kill -0 "$PID" 2>/dev/null; then break; fi
    sleep 0.2
  done
  kill -9 "$PID" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "dev stopped (pid $PID)"
}

status() {
  if is_running; then
    PID="$(cat "$PID_FILE")"
    echo "dev running (pid $PID). Logs: $LOG_FILE"
  else
    echo "dev not running"
  fi
}

logs() {
  if [ ! -f "$LOG_FILE" ]; then
    echo "no log file yet at $LOG_FILE"
    exit 1
  fi
  exec tail -f "$LOG_FILE"
}

case "${1:-}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; sleep 0.5; start ;;
  status)  status ;;
  logs)    logs ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}" >&2
    exit 1
    ;;
esac
