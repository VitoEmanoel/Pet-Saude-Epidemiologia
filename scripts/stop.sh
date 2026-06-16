#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_CMD=(docker compose --env-file .env)

if "${COMPOSE_CMD[@]}" down --remove-orphans; then
  exit 0
fi

echo "Falha ao parar via docker compose down. Tentando remocao forcada dos containers do projeto..."

service_ids=()
for service in frontend backend postgres redis; do
  service_id="$("${COMPOSE_CMD[@]}" ps -q "$service" 2>/dev/null || true)"
  if [ -n "$service_id" ]; then
    service_ids+=("$service_id")
  fi
done

if [ "${#service_ids[@]}" -gt 0 ] && docker rm -f "${service_ids[@]}"; then
  "${COMPOSE_CMD[@]}" down --remove-orphans >/dev/null 2>&1 || true
  exit 0
fi

if [ "${EUID:-$(id -u)}" -eq 0 ] && [ "${#service_ids[@]}" -gt 0 ]; then
  echo "Remocao forcada falhou. Tentando finalizar os processos dos containers no host..."

  killed_any=0
  for service_id in "${service_ids[@]}"; do
    pid="$(docker inspect -f '{{.State.Pid}}' "$service_id" 2>/dev/null || true)"
    if [ -n "$pid" ] && [ "$pid" != "0" ]; then
      kill -9 "$pid" 2>/dev/null || true
      killed_any=1
    fi
  done

if [ "$killed_any" -eq 1 ] && docker rm -f "${service_ids[@]}"; then
    "${COMPOSE_CMD[@]}" down --remove-orphans >/dev/null 2>&1 || true
    exit 0
  fi
fi

if [ "${RECOVER_DOCKER_RUNNING:-false}" != "true" ]; then
  echo "Parada normal falhou. Tentando recuperacao automatica do Docker..."
  bash "$ROOT_DIR/scripts/recover-docker.sh"
  exit 0
fi

echo "Nao foi possivel parar os containers do projeto."
echo "Se o Docker do host estiver travado, reinicie o daemon e rode novamente:"
echo "sudo systemctl restart docker"
echo "npm run stop"
exit 1
