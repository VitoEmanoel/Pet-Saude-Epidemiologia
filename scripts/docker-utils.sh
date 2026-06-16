#!/usr/bin/env bash

docker_error_is_daemon_stuck() {
  local output="$1"

  grep -Eiq "cannot stop container|could not kill container|Error while Stopping" <<<"$output"
}

docker_is_snap_install() {
  local docker_root_dir

  docker_root_dir="$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || true)"
  if [[ "$docker_root_dir" == /var/snap/docker/* ]]; then
    return 0
  fi

  if command -v snap >/dev/null 2>&1 && snap list docker >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

docker_restart_command_text() {
  if docker_is_snap_install; then
    echo "sudo snap restart docker"
    return
  fi

  echo "sudo systemctl restart docker"
}

print_docker_stuck_help() {
  local action="$1"
  local retry_command="$2"
  local restart_command

  restart_command="$(docker_restart_command_text)"

  cat <<EOF

Docker recusou ${action} com erro de permissao no daemon/runtime.
Isso normalmente indica Docker travado no host, nao uma falha da aplicacao.
Nao adianta repetir docker rm -f: ele usa o mesmo daemon que ja recusou matar o container.

Recuperacao recomendada:
${restart_command}
${retry_command}

Se continuar falhando depois de reiniciar o Docker, reinicie o computador.
EOF
}
