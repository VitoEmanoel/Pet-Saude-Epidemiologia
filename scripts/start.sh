#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-.env}"

cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker nao encontrado. Instale Docker antes de continuar."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose nao esta funcionando. Verifique a instalacao do Docker."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  echo "Arquivo $ENV_FILE criado a partir de .env.example."
  echo "Revise as URLs, senhas e portas antes de continuar."
fi

if [ "$ENV_FILE" != ".env" ]; then
  cp "$ENV_FILE" .env
fi

set -a
# shellcheck disable=SC1090
source .env
set +a

COMPOSE_CMD=(docker compose --env-file .env)
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-3333}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
APP_BIND_HOST="${APP_BIND_HOST:-0.0.0.0}"
SERVICE_BIND_HOST="${SERVICE_BIND_HOST:-127.0.0.1}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:${FRONTEND_PORT}}"
BACKEND_URL="${BACKEND_URL:-http://localhost:${BACKEND_PORT}}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-pet_saude}"

require_var() {
  local var_name="$1"
  if [ -z "${!var_name:-}" ]; then
    echo "Variavel obrigatoria ausente em .env: ${var_name}"
    exit 1
  fi
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

port_in_use() {
  local host="$1"
  local port="$2"

  if ! command -v ss >/dev/null 2>&1; then
    return 1
  fi

  if [ "$host" = "0.0.0.0" ]; then
    ss -ltn | awk '{print $4}' | grep -Eq "(^|:)$port$"
    return
  fi

  ss -ltn | awk '{print $4}' | grep -Fxq "${host}:${port}"
}

check_port() {
  local service_name="$1"
  local service_id="$2"
  local host="$3"
  local port="$4"

  if ! port_in_use "$host" "$port"; then
    return
  fi

  if service_owns_port "$service_id" "$port"; then
    return
  fi

  echo "A porta ${port} ja esta em uso para ${service_name} em ${host}."
  echo "Ajuste a porta correspondente no .env antes de continuar."
  exit 1
}

verify_docker_access() {
  docker info >/dev/null 2>&1 || {
    echo "Seu usuario nao consegue acessar o daemon Docker."
    echo "Corrija o grupo docker e nao misture docker com sudo docker nesta maquina."
    exit 1
  }
}

verify_postgres_access() {
  local attempts="${POSTGRES_WAIT_ATTEMPTS:-60}"
  local delay="${POSTGRES_WAIT_DELAY_SECONDS:-2}"
  local attempt
  local last_error=""

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if last_error="$("${COMPOSE_CMD[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select 1;" 2>&1 >/dev/null)"; then
      return
    fi

    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$delay"
    fi
  done

  echo "O PostgreSQL subiu, mas nao aceita o usuario/banco configurados em .env."
  echo "Ultimo erro do PostgreSQL: ${last_error:-sem detalhes retornados pelo psql}"
  echo "Isso pode indicar volume antigo inicializado com outras credenciais ou .env incorreto."
  echo "Se este ambiente puder ser recriado, rode: npm run db:reset -- --force"
  exit 1
}

recover_docker_state() {
  echo "Docker recusou parar ou recriar containers do projeto."
  echo "Tentando recuperacao automatica sem apagar volumes..."
  bash "$ROOT_DIR/scripts/recover-docker.sh"
}

start_core_services() {
  if "${COMPOSE_CMD[@]}" up -d postgres; then
    return
  fi

  recover_docker_state
  "${COMPOSE_CMD[@]}" up -d postgres
}

start_app_services() {
  if "${COMPOSE_CMD[@]}" up -d --no-build --remove-orphans backend frontend; then
    return
  fi

  recover_docker_state

  echo "Reativando banco de dados apos recuperacao..."
  "${COMPOSE_CMD[@]}" up -d postgres

  echo "Validando conexao com PostgreSQL apos recuperacao..."
  verify_postgres_access

  echo "Subindo backend e frontend apos recuperacao..."
  "${COMPOSE_CMD[@]}" up -d --no-build --remove-orphans backend frontend
}

verify_docker_access

require_var FRONTEND_URL
require_var BACKEND_URL
require_var NEXT_PUBLIC_API_URL
require_var CORS_ORIGIN
require_var ADMIN_USERNAME
require_var ADMIN_PASSWORD
require_var ADMIN_SESSION_SECRET

if grep -Eq "troque-esta-senha|troque-este-segredo-de-sessao" .env; then
  echo "Atualize ADMIN_PASSWORD e ADMIN_SESSION_SECRET no .env antes de iniciar o sistema."
  exit 1
fi

DEPLOYMENT_TARGET="servidor"
if [[ "$FRONTEND_URL" =~ localhost|127\.0\.0\.1 ]] && [[ "$BACKEND_URL" =~ localhost|127\.0\.0\.1 ]]; then
  DEPLOYMENT_TARGET="localhost"
fi

if [ "$DEPLOYMENT_TARGET" = "servidor" ] && [[ "$NEXT_PUBLIC_API_URL" =~ localhost|127\.0\.0\.1 ]]; then
  echo "NEXT_PUBLIC_API_URL nao pode apontar para localhost quando o sistema sera exposto em servidor."
  exit 1
fi

check_port "frontend" "$(compose_service_id frontend)" "$APP_BIND_HOST" "$FRONTEND_PORT"
check_port "backend" "$(compose_service_id backend)" "$APP_BIND_HOST" "$BACKEND_PORT"
check_port "postgres" "$(compose_service_id postgres)" "$SERVICE_BIND_HOST" "$POSTGRES_PORT"

if [ "$APP_BIND_HOST" = "127.0.0.1" ] && [ "$DEPLOYMENT_TARGET" = "servidor" ]; then
  echo "APP_BIND_HOST esta em 127.0.0.1, mas as URLs configuradas indicam uso em servidor."
  echo "Defina APP_BIND_HOST=0.0.0.0 no .env para aceitar acesso externo."
  exit 1
fi

if [[ "$FRONTEND_URL" == https://* ]] && [ "${ADMIN_COOKIE_SECURE:-false}" != "true" ]; then
  echo "FRONTEND_URL usa HTTPS, mas ADMIN_COOKIE_SECURE nao e true."
  echo "Defina ADMIN_COOKIE_SECURE=true no .env: sem isso o cookie do admin tambem trafega sem criptografia."
  exit 1
fi

if [[ "$FRONTEND_URL" == http://* ]] && [ "${ADMIN_COOKIE_SECURE:-false}" = "true" ] && [ "$DEPLOYMENT_TARGET" = "servidor" ]; then
  echo "Aviso: ADMIN_COOKIE_SECURE=true com FRONTEND_URL em HTTP. O navegador nao guarda o cookie e o login do admin nao funciona."
fi

if grep -Eq "SEU_IP|SEU_IP_OU_DOMINIO" .env; then
  echo "Substitua os placeholders de IP no .env antes de iniciar o sistema."
  exit 1
fi

echo "Subindo banco de dados..."
start_core_services

echo "Validando conexao com PostgreSQL..."
verify_postgres_access

echo "Buildando backend e frontend..."
"${COMPOSE_CMD[@]}" build backend frontend

echo "Aplicando migrations..."
"${COMPOSE_CMD[@]}" run --rm backend node node_modules/prisma/build/index.js migrate deploy --schema backend/prisma/schema.prisma

echo "Executando seed inicial..."
"${COMPOSE_CMD[@]}" run --rm backend node backend/dist/prisma/seed.js

echo "Subindo backend e frontend..."
start_app_services

if [[ "${RUN_INITIAL_SYNC:-false}" == "true" ]]; then
  echo "Executando sincronizacao inicial de dados..."
  "${COMPOSE_CMD[@]}" exec -T backend node backend/dist/scripts/sync-data.js
fi

cat <<EOF

Sistema iniciado com sucesso.

Perfil detectado: ${DEPLOYMENT_TARGET}

Frontend:
${FRONTEND_URL}

Backend:
${BACKEND_URL}

Comandos uteis:
./scripts/logs.sh
./scripts/stop.sh
./scripts/restart.sh
./scripts/sync-data.sh
EOF
