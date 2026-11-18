#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f build/index.js ]]; then
  echo "build/index.js missing; run install (pnpm build) first" >&2
  exit 1
fi

PORT="${PORT:-3000}"
export HARNESS_SEARCH_PROVIDER="${HARNESS_SEARCH_PROVIDER:-none}"
export HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP="${HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP:-true}"
export HARNESS_MCP_ALLOWED_HOSTS="${HARNESS_MCP_ALLOWED_HOSTS:-localhost,127.0.0.1}"

# Placeholder credentials satisfy config validation; set HARNESS_API_KEY in env
# secrets for live Harness API calls from agents.
export HARNESS_API_KEY="${HARNESS_API_KEY:-pat.devaccount.devtoken.placeholder}"
export HARNESS_ACCOUNT_ID="${HARNESS_ACCOUNT_ID:-devaccount}"

exec node build/index.js http --port "$PORT"
