#!/bin/bash
# Oshudh eval runner: starts the app, scores test images, shuts down.
# Usage: npm run eval   (from app/)
set -u
PORT=${EVAL_PORT:-3211}
APP_DIR="$(cd "$(dirname "$0")/../app" && pwd)"
EVAL_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$APP_DIR"
npx next start -p "$PORT" > /tmp/oshudh-eval.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT

for _ in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/" > /dev/null 2>&1; then break; fi
  sleep 1
done

EVAL_PORT="$PORT" node "$EVAL_DIR/score.mjs"
