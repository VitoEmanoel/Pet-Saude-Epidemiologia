#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-.env}"

cd "$ROOT_DIR"

status=0

ok() {
  echo "[ok] $1"
}

warn() {
  echo "[warn] $1"
  status=1
}

fail() {
  echo "[fail] $1"
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Comando ausente: $cmd"
}

require_cmd docker
require_cmd ss

docker compose version >/dev/null 2>&1 || fail "Docker Compose nao esta funcionando."
docker info >/dev/null 2>&1 || fail "Seu usuario nao consegue acessar o daemon Docker. Corrija o grupo docker e nao misture docker com sudo docker nesta maquina."

[ -f "$ENV_FILE" ] || fail "Arquivo $ENV_FILE nao encontrado. Crie-o a partir de .env.example."

if [ "$ENV_FILE" != ".env" ]; then
  cp "$ENV_FILE" .env
fi

set -a
# shellcheck disable=SC1090
source .env
set +a

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-3333}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
REDIS_PORT="${REDIS_PORT:-6379}"
APP_BIND_HOST="${APP_BIND_HOST:-0.0.0.0}"
SERVICE_BIND_HOST="${SERVICE_BIND_HOST:-127.0.0.1}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-pet_saude}"
COMPOSE_CMD=(docker compose --env-file .env)

require_var() {
  local var_name="$1"
  if [ -z "${!var_name:-}" ]; then
    fail "Variavel obrigatoria ausente em .env: ${var_name}"
  fi
}

port_in_use() {
  local host="$1"
  local port="$2"

  if [ "$host" = "0.0.0.0" ]; then
    ss -ltn | awk '{print $4}' | grep -Eq "(^|:)$port$"
    return
  fi

  ss -ltn | awk '{print $4}' | grep -Fxq "${host}:${port}"
}

compose_service_id() {
  local service="$1"
  "${COMPOSE_CMD[@]}" ps -q "$service" 2>/dev/null
}

compose_service_running() {
  local service="$1"
  local id

  id="$(compose_service_id "$service")"
  [ -n "$id" ] || return 1

  docker inspect -f '{{.State.Running}}' "$id" 2>/dev/null | grep -qx "true"
}

service_owns_port() {
  local service_id="$1"
  local port="$2"

  [ -n "$service_id" ] || return 1

  docker port "$service_id" 2>/dev/null | awk '{print $3}' | grep -Eq "(:|\\])${port}$"
}

check_port() {
  local service_name="$1"
  local service_id="$2"
  local host="$3"
  local port="$4"

  if ! port_in_use "$host" "$port"; then
    ok "Porta ${host}:${port} livre para ${service_name}."
    return
  fi

  if service_owns_port "$service_id" "$port"; then
    ok "Porta ${host}:${port} ja pertence ao container atual de ${service_name}."
    return
  fi

  warn "Porta ${host}:${port} ocupada por outro processo ou container para ${service_name}."
}

require_var FRONTEND_URL
require_var BACKEND_URL
require_var NEXT_PUBLIC_API_URL
require_var CORS_ORIGIN
require_var ADMIN_PASSWORD
require_var ADMIN_SESSION_SECRET

if grep -Eq "troque-esta-senha|troque-este-segredo-de-sessao" .env; then
  warn "ADMIN_PASSWORD ou ADMIN_SESSION_SECRET ainda estao com placeholder."
fi

if grep -Eq "SEU_IP|SEU_IP_OU_DOMINIO" .env; then
  warn "Ainda existem placeholders de IP ou dominio no .env."
fi

ok "Docker e Docker Compose acessiveis pelo usuario atual."

check_port "frontend" "$(compose_service_id frontend)" "$APP_BIND_HOST" "$FRONTEND_PORT"
check_port "backend" "$(compose_service_id backend)" "$APP_BIND_HOST" "$BACKEND_PORT"
check_port "postgres" "$(compose_service_id postgres)" "$SERVICE_BIND_HOST" "$POSTGRES_PORT"
check_port "redis" "$(compose_service_id redis)" "$SERVICE_BIND_HOST" "$REDIS_PORT"

if compose_service_running postgres; then
  if "${COMPOSE_CMD[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select 1;" >/dev/null 2>&1; then
    ok "PostgreSQL responde com o usuario e banco configurados."
  else
    warn "PostgreSQL esta rodando, mas nao aceita o usuario/banco do .env. Rode npm run db:reset -- --force se este ambiente puder ser recriado."
  fi
fi

if compose_service_running redis; then
  if "${COMPOSE_CMD[@]}" exec -T redis redis-cli ping | grep -qx "PONG"; then
    ok "Redis responde normalmente."
  else
    warn "Redis em execucao, mas nao respondeu a redis-cli ping."
  fi
fi

if [ "$status" -eq 0 ]; then
  echo
  echo "Diagnostico concluido sem alertas."
  exit 0
fi

echo
echo "Diagnostico concluido com alertas."
exit 1
