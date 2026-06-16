#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ "$#" -gt 0 ]; then
  docker compose --env-file .env logs -f "$@"
else
  docker compose --env-file .env logs -f
fi
