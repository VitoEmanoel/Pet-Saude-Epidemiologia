import { SyncJobStatus } from "@prisma/client";
import { syncableSources } from "../../config/sources";
import { prisma } from "../../database/prisma";
import { SyncAlreadyRunningError, UnsupportedCollectorError, syncSource } from "./sync.service";

type SyncScheduler = {
  stop: () => void;
};

const DEFAULT_INTERVAL_DAYS = 30;
const DEFAULT_CHECK_INTERVAL_MINUTES = 1440;
const DEFAULT_STARTUP_DELAY_SECONDS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_SECOND = 1000;

let schedulerRunning = false;

export function startSyncScheduler(): SyncScheduler | null {
  if (!isEnabled()) {
    console.log("Agendador de sincronização automática desativado.");
    return null;
  }

  const intervalDays = parsePositiveNumber(
    process.env.SYNC_SCHEDULE_INTERVAL_DAYS,
    DEFAULT_INTERVAL_DAYS
  );
  const checkIntervalMinutes = parsePositiveNumber(
    process.env.SYNC_SCHEDULE_CHECK_INTERVAL_MINUTES,
    DEFAULT_CHECK_INTERVAL_MINUTES
  );
  const startupDelaySeconds = parsePositiveNumber(
    process.env.SYNC_SCHEDULE_STARTUP_DELAY_SECONDS,
    DEFAULT_STARTUP_DELAY_SECONDS
  );

  const checkIntervalMs = checkIntervalMinutes * MS_PER_MINUTE;
  const startupDelayMs = startupDelaySeconds * MS_PER_SECOND;

  console.log(
    `Agendador de sincronização ativo: intervalo=${intervalDays} dias, checagem=${checkIntervalMinutes} min.`
  );

  const startupTimer = setTimeout(() => {
    void runScheduledSync(intervalDays);
  }, startupDelayMs);
  const intervalTimer = setInterval(() => {
    void runScheduledSync(intervalDays);
  }, checkIntervalMs);

  return {
    stop: () => {
      clearTimeout(startupTimer);
      clearInterval(intervalTimer);
    }
  };
}

async function runScheduledSync(intervalDays: number) {
  if (schedulerRunning) {
    console.log("Agendador de sincronização: checagem ignorada porque outra execução está ativa.");
    return;
  }

  schedulerRunning = true;

  try {
    for (const source of syncableSources) {
      const shouldSync = await shouldSyncSource(source.slug, intervalDays);

      if (!shouldSync) {
        continue;
      }

      try {
        console.log(`Agendador de sincronização: atualizando ${source.slug}.`);
        await syncSource(source.slug, "scheduler");
      } catch (error) {
        if (error instanceof SyncAlreadyRunningError) {
          console.log(`Agendador de sincronização: ${source.slug} já está em execução.`);
          continue;
        }

        if (error instanceof UnsupportedCollectorError) {
          console.log(`Agendador de sincronização: ${source.slug} sem coletor implementado.`);
          continue;
        }

        console.error(`Agendador de sincronização: falha ao atualizar ${source.slug}.`, error);
      }
    }
  } catch (error) {
    console.error("Agendador de sincronização: falha na checagem automática.", error);
  } finally {
    schedulerRunning = false;
  }
}

async function shouldSyncSource(sourceSlug: string, intervalDays: number): Promise<boolean> {
  const dataSource = await prisma.dataSource.findUnique({
    where: {
      slug: sourceSlug
    },
    select: {
      id: true
    }
  });

  if (!dataSource) {
    return true;
  }

  const lastSuccessfulSync = await prisma.syncJob.findFirst({
    where: {
      sourceId: dataSource.id,
      status: SyncJobStatus.SUCCESS,
      finishedAt: {
        not: null
      }
    },
    orderBy: {
      finishedAt: "desc"
    },
    select: {
      finishedAt: true
    }
  });

  if (!lastSuccessfulSync?.finishedAt) {
    return true;
  }

  const ageMs = Date.now() - lastSuccessfulSync.finishedAt.getTime();
  return ageMs >= intervalDays * MS_PER_DAY;
}

function isEnabled(): boolean {
  return process.env.SYNC_SCHEDULE_ENABLED !== "false";
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
