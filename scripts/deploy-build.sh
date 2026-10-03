#!/usr/bin/env bash
# 6.8: constrói as imagens de produção NO SEU COMPUTADOR (a VPS não precisa compilar nada)
# e gera deploy/out/painel-imagens-<versao>.tar.gz para o scripts/deploy-vps.sh enviar.
# Uso: ENV_PRODUCAO=deploy/.env.producao ./scripts/deploy-build.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_PRODUCAO="${ENV_PRODUCAO:-deploy/.env.producao}"
[ -f "$ENV_PRODUCAO" ] || { echo "Falta $ENV_PRODUCAO (modelo: deploy/.env.producao.example)." >&2; exit 1; }

API_URL="$(grep -E '^NEXT_PUBLIC_API_URL=' "$ENV_PRODUCAO" | cut -d= -f2-)"
BASE_PATH="$(grep -E '^NEXT_PUBLIC_BASE_PATH=' "$ENV_PRODUCAO" | cut -d= -f2- || true)"
case "$API_URL" in
  https://*) ;;
  *) echo "NEXT_PUBLIC_API_URL em $ENV_PRODUCAO deve ser o endereço https público (está: '$API_URL')." >&2; exit 1 ;;
esac

if [ -n "$(git status --porcelain)" ]; then
  echo "Aviso: há alterações não commitadas; elas entram na imagem." >&2
fi

VERSION="$(git rev-parse --short HEAD)"
OUT="deploy/out/painel-imagens-$VERSION.tar.gz"
mkdir -p deploy/out

echo "==> Construindo backend e frontend (NEXT_PUBLIC_API_URL=$API_URL, prefixo '${BASE_PATH:-/}')"
docker build --target backend -t "painel-backend:$VERSION" -t painel-backend:latest .
docker build --target frontend-runner --build-arg "NEXT_PUBLIC_API_URL=$API_URL" \
  --build-arg "NEXT_PUBLIC_BASE_PATH=$BASE_PATH" \
  -t "painel-frontend:$VERSION" -t painel-frontend:latest .

docker pull -q postgres:16-alpine >/dev/null
docker pull -q caddy:2-alpine >/dev/null

echo "==> Gerando $OUT"
docker save "painel-backend:$VERSION" painel-backend:latest "painel-frontend:$VERSION" painel-frontend:latest \
  postgres:16-alpine caddy:2-alpine | gzip -1 > "$OUT"

echo "Pronto: $OUT ($(du -h "$OUT" | cut -f1)). Envie com: DEPLOY_HOST=aluno@10.10.10.212 ./scripts/deploy-vps.sh $OUT"
