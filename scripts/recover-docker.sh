#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

echo "Reiniciando o daemon Docker para destravar containers presos..."
sudo systemctl restart docker

echo "Aguardando Docker voltar..."
docker_ready=false
for _ in $(seq 1 30); do
  if docker info >/dev/null 2>&1; then
    docker_ready=true
    break
  fi

  sleep 1
done

run_recovery() {
  if [ "$RESET_DB" = true ]; then
    RECOVER_DOCKER_RUNNING=true bash "$ROOT_DIR/scripts/db-reset.sh" --force
    return
  fi

  RECOVER_DOCKER_RUNNING=true bash "$ROOT_DIR/scripts/stop.sh"
}

run_recovery_with_sudo() {
  if [ "$RESET_DB" = true ]; then
    sudo env RECOVER_DOCKER_RUNNING=true bash "$ROOT_DIR/scripts/db-reset.sh" --force
    return
  fi

  sudo env RECOVER_DOCKER_RUNNING=true bash "$ROOT_DIR/scripts/stop.sh"
}

if [ "$docker_ready" = true ]; then
  if ! run_recovery; then
    echo "Recuperacao sem sudo falhou. Tentando recuperacao com sudo..."
    run_recovery_with_sudo
  fi
else
  echo "O usuario atual ainda nao acessa o Docker sem sudo nesta sessao."
  echo "Tentando recuperacao com sudo apenas para destravar o host..."
  run_recovery_with_sudo
fi

cat <<EOF

Recuperacao concluida.

Uso normal depois da recuperacao:
npm run doctor
npm run start
EOF
