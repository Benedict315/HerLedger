#!/usr/bin/env bash
# Run all HerLedger contract unit tests.
# Requires: Rust >= 1.84.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$WORKSPACE_DIR"

echo "==> Running HerLedger contract tests..."
cargo test --workspace

echo ""
echo "==> All tests passed."
