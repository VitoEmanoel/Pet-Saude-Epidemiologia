#!/usr/bin/env bash
# Instala/atualiza o painel NA VPS a partir das imagens enviadas pelo scripts/deploy-vps.sh.
# Roda dentro da pasta de implantação (ex.: /opt/painel), que precisa ter o .env de produção.
# Uso: ./install.sh painel-imagens-<versao>.tar.gz
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
IMAGES="${1:?Informe o arquivo de imagens (painel-imagens-<versao>.tar.gz)}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)

fail() {
  echo "ERRO: $*" >&2
  exit 1
}

[ -f .env ] || fail "falta o .env nesta pasta (modelo: .env.producao.example)."

set -a
# shellcheck disable=SC1091
source .env
set +a

# As mesmas travas do scripts/start.sh (S15/S9): não sobe com segredo fraco.
[ "${#ADMIN_PASSWORD}" -ge 12 ] || fail "ADMIN_PASSWORD precisa de 12+ caracteres."
[ "${#ADMIN_SESSION_SECRET}" -ge 32 ] || fail "ADMIN_SESSION_SECRET precisa de 32+ caracteres."
[ "${#POSTGRES_PASSWORD}" -ge 12 ] && [ "$POSTGRES_PASSWORD" != "postgres" ] || fail "POSTGRES_PASSWORD fraca (12+ caracteres, diferente de postgres)."
if [[ "${FRONTEND_URL:-}" == https://* ]] && [ "${ADMIN_COOKIE_SECURE:-}" != "true" ]; then
  fail "FRONTEND_URL em HTTPS exige ADMIN_COOKIE_SECURE=true."
fi
[ "${TRUST_PROXY:-}" != "true" ] || fail "TRUST_PROXY=true deixaria qualquer visitante forjar o IP."

echo "==> Carregando imagens ($IMAGES)"
gunzip -c "$IMAGES" | docker load

mkdir -p backups

echo "==> Banco"
"${COMPOSE[@]}" up -d --wait postgres

echo "==> Migrations e cadastro das fontes"
"${COMPOSE[@]}" run --rm --no-deps backend node node_modules/prisma/build/index.js migrate deploy --schema backend/prisma/schema.prisma
"${COMPOSE[@]}" run --rm --no-deps backend node backend/dist/prisma/seed.js

echo "==> Subindo o sistema"
"${COMPOSE[@]}" up -d --remove-orphans

echo "==> Conferindo"
for _ in $(seq 1 30); do
  # wget do próprio Caddy: a VPS pode não ter curl.
  if "${COMPOSE[@]}" exec -T caddy wget -qO- http://127.0.0.1/health >/dev/null 2>&1; then
    echo "OK: o sistema respondeu pelo Caddy (porta ${PUBLIC_PORT:-80} da VPS)."
    "${COMPOSE[@]}" ps
    exit 0
  fi
  sleep 2
done

"${COMPOSE[@]}" ps
fail "o sistema não respondeu em 60 s. Veja: docker compose -f docker-compose.prod.yml --env-file .env logs backend"
