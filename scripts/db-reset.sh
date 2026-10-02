#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/docker-utils.sh"

COMPOSE_CMD=(docker compose --env-file .env)

if [ "${1:-}" != "--force" ]; then
  echo "Uso: npm run db:reset -- --force"
  echo "Esse comando remove os volumes Docker do banco deste projeto."
  exit 1
fi

set +e
down_output="$("${COMPOSE_CMD[@]}" down -v --remove-orphans 2>&1)"
down_status=$?
set -e

if [ -n "$down_output" ]; then
  printf '%s\n' "$down_output"
fi

if [ "$down_status" -eq 0 ]; then
  cat <<EOF

Volumes do projeto removidos com sucesso.

Proximo passo:
npm run start
EOF
  exit 0
fi

if docker_error_is_daemon_stuck "$down_output"; then
  print_docker_stuck_help "remover os containers/volumes do projeto" "npm run db:reset -- --force"
  echo
  echo "Alternativa guiada: npm run docker:recover -- --reset-db"
  exit "$down_status"
fi

echo "Nao foi possivel remover os volumes do projeto."
echo "Corrija o erro do Docker exibido acima e rode novamente: npm run db:reset -- --force"
exit "$down_status"
