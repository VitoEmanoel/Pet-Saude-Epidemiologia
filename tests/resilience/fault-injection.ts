// Teste de resiliência da coleta: simula falhas do TABNET e confere que os dados antigos são mantidos.
// Roda fora do Docker usando o backend/.env (DATABASE_URL em 127.0.0.1:5433):
//   npm run test:resilience
// O passo final de recuperação consulta o TABNET de verdade (precisa de internet).
import "../../backend/src/config/env";

// Sem espera entre as novas tentativas do cliente TABNET (O5): o teste fica rápido.
process.env.TABNET_RETRY_DELAYS_MS = "0,0";
import { prisma } from "../../backend/src/database/prisma";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { SYNC_LOCK_TTL_MS, SyncAlreadyRunningError, syncSource } from "../../backend/src/modules/sync/sync.service";

const SOURCE = "zika_sinan";
const BACKEND_DIR = fileURLToPath(new URL("../../backend", import.meta.url));

/** Impressão digital dos dados da fonte: cada registro, o valor e a sincronização que o gravou. */
async function fingerprint() {
  const rows = await prisma.epidemiologicalRecord.findMany({
    where: { source: { slug: SOURCE } },
    select: { recordKey: true, value: true, syncJobId: true },
    orderBy: { recordKey: "asc" }
  });
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 12);
}

async function main() {
  const count = () => prisma.epidemiologicalRecord.count({ where: { source: { slug: SOURCE } } });
  // Parte de uma coleta completa e limpa (todos os registros de uma mesma sincronização).
  await syncSource(SOURCE, "teste_resiliencia");
  const before = await count();
  const beforeFingerprint = await fingerprint();
  const realFetch = globalThis.fetch;
  let failures = 0;

  const cases: Array<[string, typeof fetch]> = [
    ["TABNET fora do ar (erro de rede)", (async () => { throw new TypeError("fetch failed"); }) as typeof fetch],
    ["TABNET retorna HTTP 503", (async () => new Response("indisponivel", { status: 503 })) as typeof fetch],
    ["TABNET muda o layout (sem <PRE>)", (async () => new Response("<html>Manutencao</html>", { status: 200 })) as typeof fetch],
    ["Falha persistente a partir da 3ª consulta (coleta parcial)", (() => {
      let calls = 0;
      return ((...args: Parameters<typeof fetch>) =>
        ++calls >= 3 ? Promise.reject(new TypeError("fetch failed")) : realFetch(...args)) as typeof fetch;
    })()]
  ];

  for (const [name, fakeFetch] of cases) {
    globalThis.fetch = fakeFetch;
    const result = await syncSource(SOURCE, "teste_resiliencia");
    const kept = await count();
    // O4: nada pode ter mudado, nem a quantidade nem o conteúdo (antes, uma falha no meio deixava
    // parte dos registros regravada).
    const intact = (await fingerprint()) === beforeFingerprint;
    const ok = result.syncJob.status === "FAILED" && kept === before && intact;
    failures += ok ? 0 : 1;
    console.log(`${ok ? "✔" : "✖"} ${name}: job=${result.syncJob.status} erro="${result.syncJob.errorMessage}" registros=${kept}/${before} dados intactos=${intact}`);
  }

  // Falha temporária isolada: a nova tentativa automática (O5) recupera e a coleta termina bem.
  {
    let calls = 0;
    globalThis.fetch = ((...args: Parameters<typeof fetch>) =>
      ++calls === 3 ? Promise.reject(new TypeError("fetch failed")) : realFetch(...args)) as typeof fetch;
    const result = await syncSource(SOURCE, "teste_resiliencia");
    const kept = await count();
    const ok = result.syncJob.status === "SUCCESS" && kept === before;
    failures += ok ? 0 : 1;
    console.log(`${ok ? "✔" : "✖"} Falha temporária isolada é recuperada pela nova tentativa: job=${result.syncJob.status} registros=${kept}/${before}`);
  }

  // O3: duas sincronizações da mesma fonte ao mesmo tempo, em processos diferentes (o que
  // aconteceu em produção em 03/10/2026: agendador da API + linha de comando). A trava fica no
  // banco: só uma roda e os dados ficam completos, todos da mesma sincronização.
  {
    const inProcess = syncSource(SOURCE, "teste_resiliencia").then(
      (result) => result.syncJob.status,
      (error: unknown) => (error instanceof SyncAlreadyRunningError ? "recusada" : `erro: ${String(error)}`)
    );
    const cli = new Promise<string>((resolve) => {
      const child = spawn("npx", ["tsx", "src/scripts/sync-data.ts", SOURCE], { cwd: BACKEND_DIR, env: process.env });
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("close", () => resolve(output));
    });
    const [inProcessStatus, cliOutput] = await Promise.all([inProcess, cli]);
    const cliStatus = /pulada/.test(cliOutput) ? "recusada" : /SUCCESS/.test(cliOutput) ? "SUCCESS" : `?? ${cliOutput.slice(-200)}`;
    const statuses = [inProcessStatus, cliStatus].sort().join(" + ");
    const jobs = await prisma.epidemiologicalRecord.groupBy({ by: ["syncJobId"], where: { source: { slug: SOURCE } } });
    const kept = await count();
    const ok = statuses === "SUCCESS + recusada" && kept === before && jobs.length === 1;
    failures += ok ? 0 : 1;
    console.log(`${ok ? "✔" : "✖"} Duas sincronizações juntas (API e linha de comando): ${statuses}; registros=${kept}/${before}, de ${jobs.length} sincronização`);
  }

  // O3: trava esquecida por um processo que morreu no meio vence e é assumida.
  {
    const source = await prisma.dataSource.findUniqueOrThrow({ where: { slug: SOURCE } });
    await prisma.syncLock.create({ data: { sourceId: source.id, owner: "processo-que-morreu", acquiredAt: new Date() } });
    let refused = false;
    try {
      await syncSource(SOURCE, "teste_resiliencia");
    } catch (error) {
      refused = error instanceof SyncAlreadyRunningError;
    }
    await prisma.syncLock.update({
      where: { sourceId: source.id },
      data: { acquiredAt: new Date(Date.now() - SYNC_LOCK_TTL_MS - 60_000) }
    });
    const result = await syncSource(SOURCE, "teste_resiliencia");
    const lockLeft = await prisma.syncLock.count({ where: { sourceId: source.id } });
    const ok = refused && result.syncJob.status === "SUCCESS" && lockLeft === 0;
    failures += ok ? 0 : 1;
    console.log(`${ok ? "✔" : "✖"} Trava de processo morto: recusa enquanto vale=${refused}; vencida, é assumida=${result.syncJob.status}; trava liberada=${lockLeft === 0}`);
  }

  // Volta a falhar para conferir a disponibilidade depois de falhas.
  globalThis.fetch = (async () => new Response("indisponivel", { status: 503 })) as typeof fetch;
  await syncSource(SOURCE, "teste_resiliencia");

  globalThis.fetch = realFetch;
  const availability = await prisma.dataAvailability.findFirst({ where: { source: { slug: SOURCE } } });
  const availabilityOk = availability?.status === "ERROR";
  failures += availabilityOk ? 0 : 1;
  console.log(`${availabilityOk ? "✔" : "✖"} Disponibilidade após falhas: ${availability?.status}`);

  const recovered = await syncSource(SOURCE, "teste_resiliencia");
  const recoveredAvailability = await prisma.dataAvailability.findFirst({ where: { source: { slug: SOURCE } } });
  const recoveryOk = recovered.syncJob.status === "SUCCESS" && recoveredAvailability?.status === "AVAILABLE";
  failures += recoveryOk ? 0 : 1;
  console.log(`${recoveryOk ? "✔" : "✖"} Recuperação com o TABNET normal: ${recovered.syncJob.status}, disponibilidade ${recoveredAvailability?.status}`);

  await prisma.$disconnect();
  process.exitCode = failures === 0 ? 0 : 1;
}

void main();
