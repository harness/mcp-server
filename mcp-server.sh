#!/usr/bin/env bash
# Wrapper script for genai-service to spawn mcp-server via stdio
# Requires Node 22+ (@hono/node-server needs GlobalRequest)
DIR="$(cd "$(dirname "$0")" && pwd)"

# Use NVM Node 22 if available, otherwise fall back to system node
NODE_22="$HOME/.nvm/versions/node/v22.22.1/bin/node"
if [ -x "$NODE_22" ]; then
  exec "$NODE_22" "$DIR/build/index.js" stdio "$@"
else
  exec node "$DIR/build/index.js" stdio "$@"
fi
