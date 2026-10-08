import "../config/env";
import { allowedSources, syncableSources } from "../config/sources";
import { prisma } from "../database/prisma";
import { SyncAlreadyRunningError, syncSource } from "../modules/sync/sync.service";

async function main() {
  const requestedSource = process.argv[2] ?? "all";
  const sources =
    requestedSource === "all"
      ? syncableSources
      : allowedSources.filter((source) => source.slug === requestedSource && source.syncEnabled);

  if (sources.length === 0) {
    throw new Error(`Fonte não permitida ou inexistente: ${requestedSource}.`);
  }

  for (const source of sources) {
    console.log(`Sincronizando ${source.slug}...`);
    let result;

    try {
      result = await syncSource(source.slug, "cli");
    } catch (error) {
      // O3: outro processo (ex.: o agendador da API) já está sincronizando esta fonte.
      if (error instanceof SyncAlreadyRunningError) {
        console.log(`${source.slug}: já está sincronizando em outro processo; pulada.`);
        continue;
      }
      throw error;
    }

    console.log(
      `${source.slug}: ${result.syncJob.status} | registros=${result.syncJob.recordsImported} | brutos=${result.rawImportsCreated}`
    );

    if (result.syncJob.errorMessage) {
      console.log(`${source.slug}: ${result.syncJob.errorMessage}`);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
