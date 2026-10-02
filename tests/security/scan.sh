#!/usr/bin/env bash
# Varreduras com ferramentas de mercado contra o sistema rodando NESTA máquina.
# Usa as imagens Docker oficiais (não precisa instalar nada) e o sqlmap do repositório oficial.
# Nunca aponte para um servidor de terceiros nem para produção sem autorização.
#
# Uso: npm run test:security:scan            (tudo, ~25 min)
#      npm run test:security:scan -- trivy    (só uma: zap | sqlmap | nuclei | trivy | semgrep | nmap)
#
# Relatórios em tests/output/security/. O ZAP faz centenas de requisições no admin
# (com uma sessão válida); ao final o backend é reiniciado para zerar o bloqueio de login.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/tests/output/security"
API="${QA_API_URL:-http://localhost:3333}"
WEB="${QA_WEB_URL:-http://localhost:3000}"
ONLY="${1:-all}"
mkdir -p "$OUT"
chmod 777 "$OUT"

run() { [ "$ONLY" = "all" ] || [ "$ONLY" = "$1" ]; }

if run trivy; then
  echo "== Trivy: dependências, segredos e Dockerfile"
  docker run --rm -v "$ROOT":/src:ro -v "$OUT/trivy-cache":/root/.cache aquasec/trivy:latest fs --quiet \
    --scanners vuln,secret,misconfig --skip-dirs node_modules --skip-dirs frontend/node_modules \
    --skip-dirs backend/node_modules --skip-dirs tests/node_modules --skip-dirs frontend/.next \
    --skip-dirs tests/output --skip-files .env --skip-files backend/.env /src | tee "$OUT/trivy-fs.txt"
  echo "== Trivy: imagens Docker (sistema e Node.js da imagem)"
  for image in pet-saude-epidemiologia-backend pet-saude-epidemiologia-frontend postgres:16-alpine; do
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$OUT/trivy-cache":/root/.cache \
      aquasec/trivy:latest image --quiet --severity HIGH,CRITICAL "$image" | tee "$OUT/trivy-$(basename "${image%%:*}").txt"
  done
fi

if run semgrep; then
  echo "== Semgrep: análise estática do código"
  docker run --rm -v "$ROOT":/src:ro -w /src semgrep/semgrep:latest semgrep scan --metrics=off --quiet \
    --config p/javascript --config p/typescript --config p/nodejsscan --config p/expressjs \
    --config p/react --config p/secrets --config p/dockerfile \
    backend/src frontend/src Dockerfile docker-compose.yml scripts | tee "$OUT/semgrep.txt"
fi

if run nmap; then
  echo "== nmap: portas abertas nesta máquina"
  docker run --rm --network host instrumentisto/nmap -sV -p 1-65535 --open -T4 127.0.0.1 | tee "$OUT/nmap.txt"
fi

if run nuclei; then
  echo "== Nuclei: vulnerabilidades conhecidas e más configurações"
  docker run --rm --network host projectdiscovery/nuclei:latest -u "$WEB" -u "$API" -silent -nc -rl 100 \
    | tee "$OUT/nuclei.txt"
fi

if run sqlmap; then
  echo "== sqlmap: injeção SQL em todos os parâmetros públicos (nível 5, risco 3)"
  SQLMAP="$OUT/sqlmap-src"
  [ -d "$SQLMAP" ] || git clone -q --depth 1 https://github.com/sqlmapproject/sqlmap.git "$SQLMAP"
  for url in \
    "$API/api/records?source=tuberculose_sinan&sex=Masculino" \
    "$API/api/records?source=tuberculose_sinan&year=2020" \
    "$API/api/records?source=tuberculose_sinan&ageGroup=20-39&aggregation=age_group" \
    "$API/api/charts/yearly-evolution?source=tuberculose_sinan&raceColor=Parda" \
    "$API/api/sources/tuberculose_sinan/summary"; do
    python3 "$SQLMAP/sqlmap.py" -u "$url" --batch --skip-waf --level 5 --risk 3 --dbms=PostgreSQL \
      --technique=BEUSTQ --threads 8 --flush-session --output-dir="$OUT/sqlmap" --disable-coloring \
      | grep -E "is vulnerable|injectable|all tested parameters" | tee -a "$OUT/sqlmap.txt"
  done
fi

if run zap; then
  echo "== OWASP ZAP: varredura ativa da API (com sessão do admin) e do site"
  cp "$ROOT/tests/security/openapi.json" "$OUT/openapi.json"
  COOKIE="$(cd "$ROOT/tests" && node -e 'import("./support/env.mjs").then(async (m) => process.stdout.write((await m.adminLogin()).cookie))')"
  docker run --rm --network host -v "$OUT":/zap/wrk:rw ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
    -t /zap/wrk/openapi.json -f openapi -r zap-api.html -J zap-api.json -I \
    -z "-config replacer.full_list(0).description=auth -config replacer.full_list(0).enabled=true -config replacer.full_list(0).matchtype=REQ_HEADER -config replacer.full_list(0).matchstr=Cookie -config replacer.full_list(0).regex=false -config replacer.full_list(0).replacement=$COOKIE" \
    | tail -3
  docker run --rm --network host -v "$OUT":/zap/wrk:rw ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \
    -t "$WEB" -j -m 3 -r zap-web.html -J zap-web.json -I | tail -3
  docker compose --env-file "$ROOT/.env" -f "$ROOT/docker-compose.yml" restart backend >/dev/null
fi

echo "Relatórios em $OUT"
