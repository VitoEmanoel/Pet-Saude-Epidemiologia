#!/bin/sh
# Backup diário do banco (6.4), rodando no container "backup" do docker-compose.prod.yml.
# Grava /backups/pet_saude_AAAA-MM-DD_HHMM.dump (formato do pg_restore) e apaga os mais
# velhos que BACKUP_KEEP_DAYS. Restauração: docs/16-implantacao.md.
set -eu

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"

until pg_isready -q; do
  sleep 5
done

while true; do
  file="/backups/pet_saude_$(date +%F_%H%M).dump"

  # Grava num arquivo temporário: um backup pela metade nunca fica com o nome final.
  if pg_dump -Fc -f "$file.tmp"; then
    mv "$file.tmp" "$file"
    echo "$(date '+%F %T') backup ok: $file ($(du -h "$file" | cut -f1))"
  else
    rm -f "$file.tmp"
    echo "$(date '+%F %T') FALHA no backup" >&2
  fi

  find /backups -name 'pet_saude_*.dump' -mtime "+$KEEP_DAYS" -delete
  sleep "$INTERVAL"
done
