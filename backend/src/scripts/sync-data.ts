import "../config/env";
import { allowedSources } from "../config/sources";
import { prisma } from "../database/prisma";
import { syncSource } from "../modules/sync/sync.service";

async function main() {
  const requestedSource = process.argv[2] ?? "all";
  const sources =
    requestedSource === "all"
      ? allowedSources
      : allowedSources.filter((source) => source.slug === requestedSource);

  if (sources.length === 0) {
    throw new Error(`Fonte nao permitida ou inexistente: ${requestedSource}.`);
  }

  for (const source of sources) {
    console.log(`Sincronizando ${source.slug}...`);
    const result = await syncSource(source.slug, "cli");
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
