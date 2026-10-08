import { hostname } from "node:os";
import {
  Prisma,
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
    super(`Coletor ainda não implementado para a fonte ${sourceSlug}.`);
    this.name = "UnsupportedCollectorError";
  }
}

export class SourceNotAllowedError extends Error {
  constructor(sourceSlug: string) {
    super(`Fonte não permitida: ${sourceSlug}.`);
    this.name = "SourceNotAllowedError";
  }
}

export class SyncAlreadyRunningError extends Error {
  constructor(sourceSlug: string) {
    super(`Sincronização já em andamento para a fonte ${sourceSlug}.`);
    this.name = "SyncAlreadyRunningError";
  }
}

// Trava de sincronização (O3). Antes era só em memória: o agendador (dentro da API) e uma
// sincronização pela linha de comando (outro processo) rodaram a mesma fonte juntos em
// produção (03/10/2026) e apagaram os registros um do outro. Agora a trava fica no banco
// (tabela sync_locks), visível para todos os processos. Se o processo morrer no meio, a
// trava vence depois de SYNC_LOCK_TTL_MS e a próxima sincronização a assume.
export const SYNC_LOCK_TTL_MS = 30 * 60 * 1000;
const LOCK_OWNER = `${hostname()}:${process.pid}`.slice(0, 100);

/** Pega a trava da fonte; false se outra sincronização (de qualquer processo) já a tem. */
export async function acquireSyncLock(client: PrismaClient, sourceId: number, owner = LOCK_OWNER) {
  await client.syncLock.deleteMany({
    where: { sourceId, acquiredAt: { lt: new Date(Date.now() - SYNC_LOCK_TTL_MS) } }
  });

  try {
    await client.syncLock.create({ data: { sourceId, owner } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false;
    }
    throw error;
  }
}

export async function releaseSyncLock(client: PrismaClient, sourceId: number, owner = LOCK_OWNER) {
  await client.syncLock.deleteMany({ where: { sourceId, owner } });
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

  if (!(await acquireSyncLock(client, dataSource.id))) {
    throw new SyncAlreadyRunningError(sourceSlug);
  }

  try {
    return await syncSourceLocked(sourceSlug, requestedBy, client, configuredSource, dataSource);
  } finally {
    await releaseSyncLock(client, dataSource.id);
  }
}

async function syncSourceLocked(
  sourceSlug: string,
  requestedBy: string,
  client: PrismaClient,
  configuredSource: NonNullable<ReturnType<typeof getSourceBySlug>>,
  dataSource: DataSource
): Promise<SyncSourceResult> {

  if (configuredSource.municipalityFilterStatus === "unavailable") {
    const unavailableJob = await client.syncJob.create({
      data: {
        sourceId: dataSource.id,
        status: SyncJobStatus.UNAVAILABLE,
        startedAt: new Date(),
        finishedAt: new Date(),
        errorMessage: "Fonte sem filtro municipal disponível para Parnaíba."
      }
    });

    await client.dataAvailability.upsert({
      where: {
        sourceId: dataSource.id
      },
      update: {
        status: SourceAvailabilityStatus.MUNICIPAL_FILTER_UNAVAILABLE,
        message: "Fonte sem filtro municipal disponível para Parnaíba.",
        checkedAt: new Date()
      },
      create: {
        sourceId: dataSource.id,
        status: SourceAvailabilityStatus.MUNICIPAL_FILTER_UNAVAILABLE,
        message: "Fonte sem filtro municipal disponível para Parnaíba.",
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
    // Anos novos descobertos no TABNET e avisos da descoberta (D5) ficam na mensagem da fonte.
    const discoveryNote = [
      collectorResult.newPeriodFiles.length > 0
        ? `Anos além da lista configurada, incluídos automaticamente: ${collectorResult.newPeriodFiles.join(", ")}.`
        : null,
      ...collectorResult.discoveryWarnings.map((warning) => `Aviso: ${warning}`)
    ]
      .filter(Boolean)
      .join(" ");

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
        message: [
          collectorResult.recordsImported > 0
            ? "Fonte validada e sincronizada para Parnaíba."
            : "Fonte permite filtro municipal, mas não retornou registros para Parnaíba.",
          discoveryNote
        ]
          .filter(Boolean)
          .join(" "),
        checkedAt: new Date()
      },
      create: {
        sourceId: dataSource.id,
        status:
          collectorResult.recordsImported > 0
            ? SourceAvailabilityStatus.AVAILABLE
            : SourceAvailabilityStatus.NO_RECORDS_FOR_CITY,
        message: [
          collectorResult.recordsImported > 0
            ? "Fonte validada e sincronizada para Parnaíba."
            : "Fonte permite filtro municipal, mas não retornou registros para Parnaíba.",
          discoveryNote
        ]
          .filter(Boolean)
          .join(" "),
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
          : configuredSource.municipalityFilterStatus === "available"
      // "active" fica como o administrador deixou (7.5).
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
