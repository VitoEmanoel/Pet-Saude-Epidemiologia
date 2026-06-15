import {
  SourceAvailabilityStatus,
  SyncJobStatus,
  type DataSource,
  type PrismaClient
} from "@prisma/client";
import { ALLOWED_CITY } from "../../config/city";
import { getSourceBySlug } from "../../config/sources";
import { prisma } from "../../database/prisma";
import { collectSinanTabnetSource, hasSinanCollector } from "../datasus/sinan-tabnet.collector";

export class UnsupportedCollectorError extends Error {
  constructor(sourceSlug: string) {
    super(`Coletor ainda nao implementado para a fonte ${sourceSlug}.`);
    this.name = "UnsupportedCollectorError";
  }
}

export class SourceNotAllowedError extends Error {
  constructor(sourceSlug: string) {
    super(`Fonte nao permitida: ${sourceSlug}.`);
    this.name = "SourceNotAllowedError";
  }
}

export type SyncSourceResult = {
  city: typeof ALLOWED_CITY;
  source: {
    slug: string;
    name: string;
    system: string;
  };
  syncJob: {
    id: number;
    status: SyncJobStatus;
    startedAt: Date | null;
    finishedAt: Date | null;
    recordsImported: number;
    errorMessage: string | null;
  };
  rawImportsCreated: number;
};

export async function syncSource(
  sourceSlug: string,
  requestedBy = "admin",
  client: PrismaClient = prisma
): Promise<SyncSourceResult> {
  const configuredSource = getSourceBySlug(sourceSlug);

  if (!configuredSource) {
    throw new SourceNotAllowedError(sourceSlug);
  }

  const dataSource = await upsertDataSource(client, configuredSource);

  if (configuredSource.municipalityFilterStatus === "unavailable") {
    const unavailableJob = await client.syncJob.create({
      data: {
        sourceId: dataSource.id,
        status: SyncJobStatus.UNAVAILABLE,
        startedAt: new Date(),
        finishedAt: new Date(),
        errorMessage: "Fonte sem filtro municipal disponivel para Parnaiba."
      }
    });

    await client.dataAvailability.upsert({
      where: {
        sourceId: dataSource.id
      },
      update: {
        status: SourceAvailabilityStatus.MUNICIPAL_FILTER_UNAVAILABLE,
        message: "Fonte sem filtro municipal disponivel para Parnaiba.",
        checkedAt: new Date()
      },
      create: {
        sourceId: dataSource.id,
        status: SourceAvailabilityStatus.MUNICIPAL_FILTER_UNAVAILABLE,
        message: "Fonte sem filtro municipal disponivel para Parnaiba.",
        checkedAt: new Date()
      }
    });

    return buildResult(dataSource, unavailableJob, 0);
  }

  if (!hasSinanCollector(sourceSlug)) {
    throw new UnsupportedCollectorError(sourceSlug);
  }

  if (configuredSource.municipalityFilterStatus !== "available") {
    throw new UnsupportedCollectorError(sourceSlug);
  }

  const syncJob = await client.syncJob.create({
    data: {
      sourceId: dataSource.id,
      status: SyncJobStatus.RUNNING,
      startedAt: new Date(),
      requestedBy
    }
  });

  try {
    const collectorResult = await collectSinanTabnetSource(
      sourceSlug,
      client,
      dataSource.id,
      syncJob.id
    );
    const status =
      collectorResult.recordsImported > 0 ? SyncJobStatus.SUCCESS : SyncJobStatus.UNAVAILABLE;

    const finishedJob = await client.syncJob.update({
      where: {
        id: syncJob.id
      },
      data: {
        status,
        finishedAt: new Date(),
        recordsImported: collectorResult.recordsImported,
        errorMessage:
          collectorResult.recordsImported > 0
            ? null
            : "Coleta concluida, mas nenhum registro municipal foi retornado."
      }
    });

    await client.dataAvailability.upsert({
      where: {
        sourceId: dataSource.id
      },
      update: {
        status:
          collectorResult.recordsImported > 0
            ? SourceAvailabilityStatus.AVAILABLE
            : SourceAvailabilityStatus.NO_RECORDS_FOR_CITY,
        message:
          collectorResult.recordsImported > 0
            ? "Fonte validada e sincronizada para Parnaiba."
            : "Fonte permite filtro municipal, mas nao retornou registros para Parnaiba.",
        checkedAt: new Date()
      },
      create: {
        sourceId: dataSource.id,
        status:
          collectorResult.recordsImported > 0
            ? SourceAvailabilityStatus.AVAILABLE
            : SourceAvailabilityStatus.NO_RECORDS_FOR_CITY,
        message:
          collectorResult.recordsImported > 0
            ? "Fonte validada e sincronizada para Parnaiba."
            : "Fonte permite filtro municipal, mas nao retornou registros para Parnaiba.",
        checkedAt: new Date()
      }
    });

    return buildResult(dataSource, finishedJob, collectorResult.rawImportsCreated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido na coleta.";

    const failedJob = await client.syncJob.update({
      where: {
        id: syncJob.id
      },
      data: {
        status: SyncJobStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message
      }
    });

    await client.dataAvailability.upsert({
      where: {
        sourceId: dataSource.id
      },
      update: {
        status: SourceAvailabilityStatus.ERROR,
        message,
        checkedAt: new Date()
      },
      create: {
        sourceId: dataSource.id,
        status: SourceAvailabilityStatus.ERROR,
        message,
        checkedAt: new Date()
      }
    });

    return buildResult(dataSource, failedJob, 0);
  }
}

async function upsertDataSource(
  client: PrismaClient,
  configuredSource: NonNullable<ReturnType<typeof getSourceBySlug>>
): Promise<DataSource> {
  return client.dataSource.upsert({
    where: {
      slug: configuredSource.slug
    },
    update: {
      name: configuredSource.name,
      system: configuredSource.system,
      category: configuredSource.category,
      sourceUrl: configuredSource.sourceUrl,
      municipalityFilterAvailable:
        configuredSource.municipalityFilterStatus === "unknown"
          ? null
          : configuredSource.municipalityFilterStatus === "available",
      active: configuredSource.active
    },
    create: {
      name: configuredSource.name,
      slug: configuredSource.slug,
      system: configuredSource.system,
      category: configuredSource.category,
      sourceUrl: configuredSource.sourceUrl,
      municipalityFilterAvailable:
        configuredSource.municipalityFilterStatus === "unknown"
          ? null
          : configuredSource.municipalityFilterStatus === "available",
      active: configuredSource.active
    }
  });
}

function buildResult(
  dataSource: DataSource,
  syncJob: {
    id: number;
    status: SyncJobStatus;
    startedAt: Date | null;
    finishedAt: Date | null;
    recordsImported: number;
    errorMessage: string | null;
  },
  rawImportsCreated: number
): SyncSourceResult {
  return {
    city: ALLOWED_CITY,
    source: {
      slug: dataSource.slug,
      name: dataSource.name,
      system: dataSource.system
    },
    syncJob,
    rawImportsCreated
  };
}
