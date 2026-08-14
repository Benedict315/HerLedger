#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Starting HerLedger development environment…"

# Ensure .env.local exists for the web app
if [ ! -f "$ROOT/apps/web/.env.local" ]; then
  echo "WARNING: apps/web/.env.local not found. Copy .env.example and fill in values."
fi

# Start the indexer in the background
echo "Starting indexer…"
pnpm --filter indexer dev &
INDEXER_PID=$!

# Start the web app
echo "Starting web app…"
pnpm --filter web dev &
WEB_PID=$!

cleanup() {
  echo "Shutting down…"
  kill "$INDEXER_PID" "$WEB_PID" 2>/dev/null || true
}

trap cleanup EXIT

wait
