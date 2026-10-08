import "../src/config/env";
import { PrismaClient, SourceAvailabilityStatus } from "@prisma/client";
import { allowedSources } from "../src/config/sources";

const prisma = new PrismaClient();

const availabilityStatusBySourceStatus = {
  unknown: SourceAvailabilityStatus.UNKNOWN,
  available: SourceAvailabilityStatus.AVAILABLE,
  unavailable: SourceAvailabilityStatus.MUNICIPAL_FILTER_UNAVAILABLE
} as const;

async function main() {
  const allowedSlugs = allowedSources.map((source) => source.slug);

  await prisma.dataSource.updateMany({
    where: {
      slug: {
        notIn: allowedSlugs
      }
    },
    data: {
      active: false
    }
  });

  for (const source of allowedSources) {
    const dataSource = await prisma.dataSource.upsert({
      where: {
        slug: source.slug
      },
      update: {
        name: source.name,
        system: source.system,
        category: source.category,
        sourceUrl: source.sourceUrl,
        municipalityFilterAvailable:
          source.municipalityFilterStatus === "unknown"
            ? null
            : source.municipalityFilterStatus === "available"
        // "active" não é regravado: quem tira ou devolve uma fonte ao site é o administrador (7.5).
      },
      create: {
        name: source.name,
        slug: source.slug,
        system: source.system,
        category: source.category,
        sourceUrl: source.sourceUrl,
        municipalityFilterAvailable:
          source.municipalityFilterStatus === "unknown"
            ? null
            : source.municipalityFilterStatus === "available",
        active: source.active
      }
    });

    await prisma.dataAvailability.upsert({
      where: {
        sourceId: dataSource.id
      },
      update: {
        status: availabilityStatusBySourceStatus[source.municipalityFilterStatus],
        message:
          source.municipalityFilterStatus === "unknown"
            ? "Disponibilidade municipal pendente de validacao tecnica."
            : null
      },
      create: {
        sourceId: dataSource.id,
        status: availabilityStatusBySourceStatus[source.municipalityFilterStatus],
        message:
          source.municipalityFilterStatus === "unknown"
            ? "Disponibilidade municipal pendente de validacao tecnica."
            : null
      }
    });
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
