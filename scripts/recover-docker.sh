#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/docker-utils.sh"

RESET_DB=false

case "${1:-}" in
  "")
    ;;
  "--reset-db")
    RESET_DB=true
    ;;
  *)
    echo "Uso:"
    echo "npm run docker:recover"
    echo "npm run docker:recover -- --reset-db"
    exit 1
    ;;
esac

restart_docker_daemon() {
  if docker_is_snap_install; then
    echo "Docker via Snap detectado."
    echo "Este projeto recomenda Docker Engine oficial, nao Docker via Snap."
    echo
    echo "Migre o Docker da maquina antes de continuar:"
    echo "sudo snap remove --purge docker"
    echo "curl -fsSL https://get.docker.com | sudo sh"
    echo "sudo usermod -aG docker \"\$USER\""
    echo
    echo "Depois faca logout/login ou reinicie a maquina."
    exit 1
  fi

  echo "Reiniciando o daemon Docker com sudo systemctl restart docker..."
  sudo systemctl restart docker
}

restart_docker_daemon

echo "Aguardando Docker voltar..."
docker_ready=false
for _ in $(seq 1 30); do
  if docker info >/dev/null 2>&1; then
    docker_ready=true
    break
  fi

  sleep 1
done

if [ "$docker_ready" != true ]; then
  echo "Docker nao voltou a responder para o usuario atual."
  echo "Verifique o servico Docker e rode novamente: npm run docker:recover"
  exit 1
fi

if [ "$RESET_DB" = true ]; then
  if ! bash "$ROOT_DIR/scripts/db-reset.sh" --force; then
    echo
    echo "A recuperacao reiniciou o Docker, mas o reset ainda falhou."
    echo "Se o erro continuar sendo permission denied, reinicie o computador."
    exit 1
  fi
else
  if ! bash "$ROOT_DIR/scripts/stop.sh"; then
    echo
    echo "A recuperacao reiniciou o Docker, mas a parada ainda falhou."
    echo "Se o erro continuar sendo permission denied, reinicie o computador."
    exit 1
  fi
fi

cat <<EOF

Recuperacao concluida.

Uso normal depois da recuperacao:
npm run doctor
npm run start
EOF
