// Teste de longa duração (soak): carga constante e realista + amostragem de memória/latência a cada 30 s.
// Variáveis: QA_SOAK_MIN (padrão 110), QA_RATE em req/s (padrão 40).
// Saída: tests/output/soak.csv e tests/output/soak-summary.json
import autocannon from "autocannon";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { API, OUTPUT, PUBLIC_SOURCES, WEB, assertSystemUp } from "../support/env.mjs";

await assertSystemUp();
mkdirSync(OUTPUT, { recursive: true });

const minutes = Number(process.env.QA_SOAK_MIN ?? 110);
const rate = Number(process.env.QA_RATE ?? 40);
const CSV = `${OUTPUT}soak.csv`;

// Mistura de requisições que imita visitas reais (inclui caminhos de erro intencionais)
const requests = [];
for (const slug of PUBLIC_SOURCES) {
  for (const path of [`/api/sources/${slug}/summary`, `/api/sources/${slug}/filters`,
    `/api/charts/yearly-evolution?source=${slug}`, `/api/charts/by-sex?source=${slug}`,
    `/api/charts/by-age-group?source=${slug}`, `/api/charts/by-race-color?source=${slug}`,
    `/api/records?source=${slug}&page=1&pageSize=12`, `/api/records?source=${slug}&page=3&pageSize=12&year=2012`]) {
    requests.push({ path });
  }
}
requests.push({ path: "/api/dashboard/overview" }, { path: "/api/sources" }, { path: "/api/records?city=Teresina" },
  { path: "/api/nao-existe" }, { path: "/api/admin/auth/me" });

const toMb = (value) => {
  const number = parseFloat(value);
  const unit = value.replace(/[\d.]/g, "");
  return unit.startsWith("G") ? number * 1024 : unit.startsWith("k") ? number / 1024 : number;
};

writeFileSync(CSV, "minuto,backend_mb,frontend_mb,postgres_mb,pg_conexoes,overview_ms,home_ms,status\n");
const start = Date.now();

async function sample() {
  const stats = {};
  try {
    for (const line of execFileSync("docker", ["stats", "--no-stream", "--format", "{{.Name}}|{{.MemUsage}}"]).toString().trim().split("\n")) {
      const [name, memory] = line.split("|");
      for (const service of ["backend", "frontend", "postgres"]) {
        if (name.includes(`-${service}-`)) stats[service] = toMb(memory.split(" / ")[0]).toFixed(1);
      }
    }
  } catch {}

  let connections = "";
  try {
    connections = execFileSync("docker", ["compose", "--env-file", ".env", "exec", "-T", "postgres", "psql", "-U", "postgres", "-tAc",
      "select count(*) from pg_stat_activity where datname='pet_saude'"], { cwd: new URL("../../", import.meta.url) }).toString().trim();
  } catch {}

  const time = async (url) => {
    const begin = performance.now();
    try {
      const r = await fetch(url);
      await r.text();
      return [Math.round(performance.now() - begin), r.status];
    } catch {
      return [-1, 0];
    }
  };
  const [overview, overviewStatus] = await time(API + "/api/dashboard/overview");
  const [home, homeStatus] = await time(WEB + "/");
  appendFileSync(CSV, [((Date.now() - start) / 60000).toFixed(1), stats.backend, stats.frontend, stats.postgres,
    connections, overview, home, `${overviewStatus}/${homeStatus}`].join(",") + "\n");
}

// As amostras nunca se sobrepõem: "docker stats" é síncrono (~2 s) e, se uma amostra começasse
// enquanto outra mede uma requisição, inflaria artificialmente a latência medida.
let pending = sample();
await pending;
const timer = setInterval(() => {
  pending = pending.then(sample);
}, 30_000);

const run = (options) => new Promise((resolve, reject) => autocannon(options, (error, result) => (error ? reject(error) : resolve(result))));
const [backend, frontend] = await Promise.all([
  run({ url: API, requests, connections: 20, overallRate: rate, duration: minutes * 60 }),
  run({ url: WEB + "/", connections: 2, overallRate: 2, duration: minutes * 60 })
]);
clearInterval(timer);
await pending;
await sample();

const summary = {
  minutos: minutes,
  backend: { total: backend.requests.total, p50: backend.latency.p50, p99: backend.latency.p99, erros: backend.errors, timeouts: backend.timeouts, "2xx": backend["2xx"], "4xx": backend["4xx"], "5xx": backend["5xx"] },
  frontend: { total: frontend.requests.total, p50: frontend.latency.p50, p99: frontend.latency.p99, erros: frontend.errors, "5xx": frontend["5xx"] }
};
writeFileSync(`${OUTPUT}soak-summary.json`, JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log(`Amostras em ${CSV}`);
