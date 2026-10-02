#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

backend_id="$(docker compose --env-file .env ps -q backend 2>/dev/null || true)"

if [ -z "$backend_id" ] || ! docker inspect -f '{{.State.Running}}' "$backend_id" 2>/dev/null | grep -qx "true"; then
  echo "Backend nao esta rodando."
  echo "Rode primeiro: npm run start"
  exit 1
fi

docker compose --env-file .env exec -T backend node backend/dist/scripts/sync-data.js "$@"
