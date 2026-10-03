#!/usr/bin/env bash
# 6.8: envia as imagens e os arquivos de implantação para a VPS e roda o deploy/install.sh lá.
# Não envia o .env: ele fica só na VPS (crie uma vez em DEPLOY_DIR/.env).
# Uso: DEPLOY_HOST=aluno@10.10.10.212 ./scripts/deploy-vps.sh deploy/out/painel-imagens-<versao>.tar.gz
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${DEPLOY_HOST:?Defina DEPLOY_HOST, ex.: aluno@10.10.10.212}"
DIR="${DEPLOY_DIR:-/opt/painel}"
IMAGES="${1:?Informe o arquivo gerado pelo scripts/deploy-build.sh}"
[ -f "$IMAGES" ] || { echo "Arquivo não encontrado: $IMAGES" >&2; exit 1; }

echo "==> Enviando para $HOST:$DIR"
ssh "$HOST" "mkdir -p '$DIR'"
# -O: protocolo antigo do scp; a VPS do laboratório não tem o SFTP ligado.
scp -O deploy/docker-compose.prod.yml deploy/Caddyfile deploy/Caddyfile.subcaminho deploy/backup.sh deploy/install.sh \
  deploy/.env.producao.example "$IMAGES" "$HOST:$DIR/"

if ! ssh "$HOST" "test -f '$DIR/.env'"; then
  echo "A VPS ainda não tem $DIR/.env. Crie a partir do modelo enviado e rode de novo:" >&2
  echo "  ssh $HOST 'cp $DIR/.env.producao.example $DIR/.env && nano $DIR/.env'" >&2
  exit 1
fi

echo "==> Instalando"
ssh "$HOST" "cd '$DIR' && chmod +x install.sh && ./install.sh '$(basename "$IMAGES")'"

# Imagens antigas ficam na VPS para voltar versão; o arquivo enviado não é mais necessário.
ssh "$HOST" "rm -f '$DIR/$(basename "$IMAGES")'"
