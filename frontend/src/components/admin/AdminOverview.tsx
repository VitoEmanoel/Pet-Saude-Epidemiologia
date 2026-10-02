"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Database, History } from "lucide-react";
import { getAdminSourceHealth, getAdminSyncHistory, getSourceSummary, getSources } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { MetricCard } from "../ui/MetricCard";
import { AdminSourceDashboard } from "./AdminSourceDashboard";
import { SourceHealthAlert } from "./SourceHealthAlert";
import { ErrorBox, LoadingBlocks } from "./admin-ui";
import { useAdminLoader } from "./useAdminLoader";

async function loadOverview() {
  const sources = await getSources();
  const [summaries, history, health] = await Promise.all([
    Promise.all(sources.sources.map(async (source) => (await getSourceSummary(source.slug)).summary)),
    getAdminSyncHistory(),
    getAdminSourceHealth()
  ]);

  return { sources, summaries, history, health };
}

/** Tela inicial do admin: números gerais e o dashboard da fonte com download. */
export function AdminOverview() {
  const { state } = useAdminLoader(loadOverview);

  if (state.status === "loading") {
    return <LoadingBlocks />;
  }

  if (state.status === "error") {
    return <ErrorBox message={`API indisponível: ${state.message}`} />;
  }

  const { sources, summaries, history, health } = state.data;
  const totalRecords = summaries.reduce((total, summary) => total + summary.totalRecords, 0);
  const successes = history.syncJobs.filter((job) => job.status === "SUCCESS").length;
  const failures = history.syncJobs.filter((job) => job.status === "FAILED").length;
  const lastJob = history.syncJobs[0];

  return (
    <div className="space-y-5">
      <SourceHealthAlert sources={health.sources} />
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Link href="/admin/fontes" className="block rounded focus:outline-none focus:ring-2 focus:ring-institutional-600">
          <MetricCard label="Fontes" value={sources.total} detail="Ver e sincronizar" icon={Database} />
        </Link>
        <MetricCard label="Registros" value={formatNumber(totalRecords)} detail="No banco" icon={Database} tone="blue" />
        <Link href="/admin/sincronizacoes" className="block rounded focus:outline-none focus:ring-2 focus:ring-institutional-600">
          <MetricCard
            label="Sincronizações"
            value={`${successes} ok`}
            detail={lastJob ? `Última: ${formatDateTime(lastJob.startedAt)}` : "Nenhuma ainda"}
            icon={successes > 0 ? CheckCircle2 : History}
            tone="green"
          />
        </Link>
        <Link href="/admin/sincronizacoes" className="block rounded focus:outline-none focus:ring-2 focus:ring-institutional-600">
          <MetricCard
            label="Falhas"
            value={failures}
            detail={`Nas últimas ${history.syncJobs.length} sincronizações`}
            icon={AlertCircle}
            tone="amber"
          />
        </Link>
      </section>

      <AdminSourceDashboard sources={sources.sources} />
    </div>
  );
}
