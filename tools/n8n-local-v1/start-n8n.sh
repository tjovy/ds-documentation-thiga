#!/bin/zsh
set -euo pipefail
export N8N_PORT=5678
export N8N_HOST=127.0.0.1
export N8N_RUNNERS_ENABLED=true
NODE_BIN="/Users/atypic/.nvm/versions/node/v22.22.0/bin/node"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
if [ -f .env.local ]; then
  set -a
  source ./.env.local
  set +a
fi
exec "$NODE_BIN" node_modules/n8n/bin/n8n start
