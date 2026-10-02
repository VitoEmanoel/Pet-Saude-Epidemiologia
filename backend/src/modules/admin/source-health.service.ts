import { prisma } from "../../database/prisma";
import { syncableSources } from "../../config/sources";

// Situação de cada fonte para o admin (O5): falhas seguidas, último sucesso e avisos.
export const FAILURES_FOR_ERROR = 3;

export type SourceHealthLevel = "ok" | "warning" | "error";

export type SourceHealth = {
  slug: string;
  name: string;
  level: SourceHealthLevel;
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  lastAttemptAt: Date | null;
  lastError: string | null;
  availabilityMessage: string | null;
  problems: string[];
};

function staleAfterDays() {
  const interval = Number(process.env.SYNC_SCHEDULE_INTERVAL_DAYS ?? 30);
  // Folga de uma semana além do intervalo do agendador.
  return (Number.isFinite(interval) && interval > 0 ? interval : 30) + 7;
}

export async function getSourcesHealth(now = new Date()): Promise<SourceHealth[]> {
  const sources = await prisma.dataSource.findMany({
    where: { slug: { in: syncableSources.map((source) => source.slug) } },
    select: {
      slug: true,
      name: true,
      availability: { select: { message: true } },
      syncJobs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { status: true, createdAt: true, finishedAt: true, errorMessage: true }
      }
    }
  });
  const staleLimit = staleAfterDays();

  return syncableSources.map((configured) => {
    const source = sources.find((item) => item.slug === configured.slug);
    const jobs = (source?.syncJobs ?? []).filter((job) => job.status !== "RUNNING");
    const firstSuccess = jobs.findIndex((job) => job.status === "SUCCESS");
    const consecutiveFailures = firstSuccess === -1 ? jobs.length : firstSuccess;
    const lastSuccess = firstSuccess === -1 ? null : jobs[firstSuccess];
    const lastSuccessAt = lastSuccess ? lastSuccess.finishedAt ?? lastSuccess.createdAt : null;
    const availabilityMessage = source?.availability?.message ?? null;
    const problems: string[] = [];

    if (!lastSuccessAt) {
      problems.push("Nunca sincronizou com sucesso.");
    } else {
      const days = Math.floor((now.getTime() - lastSuccessAt.getTime()) / 86_400_000);
      if (days > staleLimit) {
        problems.push(`Sem atualização há ${days} dias.`);
      }
    }

    if (consecutiveFailures > 0) {
      problems.push(`${consecutiveFailures} falha(s) seguida(s) na sincronização.`);
    }

    if (availabilityMessage?.includes("Aviso:")) {
      problems.push(availabilityMessage.slice(availabilityMessage.indexOf("Aviso:")));
    }

    const level: SourceHealthLevel =
      !lastSuccessAt || consecutiveFailures >= FAILURES_FOR_ERROR ? "error" : problems.length > 0 ? "warning" : "ok";

    return {
      slug: configured.slug,
      name: configured.name,
      level,
      consecutiveFailures,
      lastSuccessAt,
      lastAttemptAt: jobs[0]?.createdAt ?? null,
      lastError: jobs.find((job) => job.status !== "SUCCESS")?.errorMessage ?? null,
      availabilityMessage,
      problems
    };
  });
}
