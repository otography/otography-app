#!/usr/bin/env bash
set -euo pipefail

# Idempotent environment setup for worker sessions

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ ! -f "bun.lock" ]; then
  bun install
fi

echo "Environment setup complete."
