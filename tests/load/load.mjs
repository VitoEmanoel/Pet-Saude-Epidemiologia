// Teste de desempenho e carga (não é pass/fail: imprime métricas para comparar com a linha de base).
// Variáveis: QA_CONNS (padrão 50), QA_DURATION em segundos (padrão 10).
import autocannon from "autocannon";
import { API, WEB, assertSystemUp } from "../support/env.mjs";

await assertSystemUp();

const connections = Number(process.env.QA_CONNS ?? 50);
const duration = Number(process.env.QA_DURATION ?? 10);
const run = (options) => new Promise((resolve, reject) => autocannon(options, (error, result) => (error ? reject(error) : resolve(result))));

const scenarios = [
  ["health (referência)", `${API}/health`],
  ["catálogo /api/sources", `${API}/api/sources`],
  ["resumo de fonte", `${API}/api/sources/tuberculose_sinan/summary`],
  ["gráfico anual", `${API}/api/charts/yearly-evolution?source=tuberculose_sinan`],
  ["registros paginados", `${API}/api/records?source=tuberculose_sinan&page=1&pageSize=12`],
  ["visão geral", `${API}/api/dashboard/overview`],
  ["registros pageSize=500", `${API}/api/records?pageSize=500`],
  ["página inicial (Next.js)", `${WEB}/`]
];

const table = [];
for (const [name, url] of scenarios) {
  const r = await run({ url, connections, duration });
  table.push({
    cenário: name,
    "req/s": Math.round(r.requests.average),
    "p50 ms": r.latency.p50,
    "p99 ms": r.latency.p99,
    erros: r.errors + r.timeouts + r.non2xx
  });
}
console.table(table);

// Visitas reais: a página de uma doença dispara 7 chamadas em paralelo
const visit = [
  "/api/sources/dengue_sinan/summary", "/api/sources/dengue_sinan/filters",
  "/api/charts/yearly-evolution?source=dengue_sinan", "/api/charts/by-sex?source=dengue_sinan",
  "/api/charts/by-age-group?source=dengue_sinan", "/api/charts/by-race-color?source=dengue_sinan",
  "/api/records?source=dengue_sinan&page=1&pageSize=12"
];
for (const users of [10, 100, 300]) {
  const start = Date.now();
  let failures = 0;
  const times = [];
  await Promise.all(Array.from({ length: users }, async () => {
    const begin = Date.now();
    const statuses = await Promise.all(visit.map((path) => fetch(API + path).then((r) => r.status).catch(() => 0)));
    failures += statuses.filter((status) => status !== 200).length;
    times.push(Date.now() - begin);
  }));
  times.sort((a, b) => a - b);
  console.log(`${users} visitas simultâneas: total ${Date.now() - start} ms, p50 ${times[Math.floor(users * 0.5)]} ms, p95 ${times[Math.floor(users * 0.95)]} ms, falhas ${failures}`);
}
