// Teste de resiliência da coleta: simula falhas do TABNET e confere que os dados antigos são mantidos.
// Roda fora do Docker usando o backend/.env (DATABASE_URL em 127.0.0.1:5433):
//   npm run test:resilience
// O passo final de recuperação consulta o TABNET de verdade (precisa de internet).
import "../../backend/src/config/env";
import { prisma } from "../../backend/src/database/prisma";
import { syncSource } from "../../backend/src/modules/sync/sync.service";

const SOURCE = "zika_sinan";

async function main() {
  const count = () => prisma.epidemiologicalRecord.count({ where: { source: { slug: SOURCE } } });
  const before = await count();
  const realFetch = globalThis.fetch;
  let failures = 0;

  const cases: Array<[string, typeof fetch]> = [
    ["TABNET fora do ar (erro de rede)", (async () => { throw new TypeError("fetch failed"); }) as typeof fetch],
    ["TABNET retorna HTTP 503", (async () => new Response("indisponivel", { status: 503 })) as typeof fetch],
    ["TABNET muda o layout (sem <PRE>)", (async () => new Response("<html>Manutencao</html>", { status: 200 })) as typeof fetch],
    ["Falha só na 3ª consulta (coleta parcial)", (() => {
      let calls = 0;
      return ((...args: Parameters<typeof fetch>) =>
        ++calls === 3 ? Promise.reject(new TypeError("fetch failed")) : realFetch(...args)) as typeof fetch;
    })()]
  ];

  for (const [name, fakeFetch] of cases) {
    globalThis.fetch = fakeFetch;
    const result = await syncSource(SOURCE, "teste_resiliencia");
    const kept = await count();
    const ok = result.syncJob.status === "FAILED" && kept === before;
    failures += ok ? 0 : 1;
    console.log(`${ok ? "✔" : "✖"} ${name}: job=${result.syncJob.status} erro="${result.syncJob.errorMessage}" registros=${kept}/${before}`);
  }

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
