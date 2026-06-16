#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/docker-utils.sh"

COMPOSE_CMD=(docker compose --env-file .env)

set +e
down_output="$("${COMPOSE_CMD[@]}" down --remove-orphans 2>&1)"
down_status=$?
set -e

if [ -n "$down_output" ]; then
  printf '%s\n' "$down_output"
fi

if [ "$down_status" -eq 0 ]; then
  exit 0
fi

if docker_error_is_daemon_stuck "$down_output"; then
  print_docker_stuck_help "parar os containers do projeto" "npm run stop"
  echo
  echo "Alternativa guiada: npm run docker:recover"
  exit "$down_status"
fi

echo "Nao foi possivel parar os containers do projeto."
echo "Corrija o erro do Docker exibido acima e rode novamente: npm run stop"
exit "$down_status"
