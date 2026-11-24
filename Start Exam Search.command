#!/bin/bash
set -eu

cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if [[ ! -x backend/.venv/bin/python || ! -f frontend/node_modules/next/dist/bin/next ]] ||
   ! command -v node >/dev/null; then
  echo "Install the backend and frontend dependencies using the README, then run this launcher again." >&2
  exit 1
fi

for port in 3000 8000; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null; then
    echo "Port $port is already in use. Stop the existing service before starting Exam Search." >&2
    exit 1
  fi
done

(
  cd backend
  exec .venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
) &
backend_pid=$!

(
  cd frontend
  exec node node_modules/next/dist/bin/next dev --port 3000
) &
frontend_pid=$!

cleanup() {
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" "$frontend_pid" 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

echo "Exam Search is starting at http://localhost:3000. Press Ctrl+C to stop it."

while kill -0 "$backend_pid" "$frontend_pid" 2>/dev/null; do
  sleep 1
done

echo "An Exam Search service stopped. Check the output above for details." >&2
exit 1
