"use client";

import { Database, ExternalLink, Globe, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import { getAdminSourceHealth, getAdminSyncHistory, getSourceSummary, getSources, runAdminSyncAll, runAdminSyncSource } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { AdminSyncHistoryResponse, DataSource, SourceHealth, SourceSummaryResponse } from "@/types/api";
import { StatusPill } from "../ui/StatusPill";
import { HealthBadge } from "./SourceHealthAlert";
import { useAdminSession } from "./AdminSession";
import {
  ActionButton,
  ErrorBox,
  IDLE_ACTION,
  JobStatus,
  LoadingBlocks,
  Panel,
  StatusMessages,
  confirmAdminAction,
  errorMessage,
  getSourceReferenceUrl,
  type ActionState
} from "./admin-ui";
import { useAdminLoader } from "./useAdminLoader";

type SourceRow = {
  source: DataSource;
  summary: SourceSummaryResponse["summary"];
  latestJob: AdminSyncHistoryResponse["syncJobs"][number] | undefined;
  health: SourceHealth | undefined;
};

async function loadSources(): Promise<SourceRow[]> {
  const [sources, history, health] = await Promise.all([getSources(), getAdminSyncHistory(), getAdminSourceHealth()]);
  const summaries = await Promise.all(sources.sources.map((source) => getSourceSummary(source.slug)));

  return sources.sources.map((source, index) => ({
    source,
    summary: summaries[index].summary,
    latestJob: history.syncJobs.find((job) => job.source?.slug === source.slug),
    health: health.sources.find((item) => item.slug === source.slug)
  }));
}

function syncLabel(source: DataSource) {
  return source.syncEnabled ? "Sincronizar" : source.active ? "Derivada" : "Prevista";
}

/** Tela de fontes: situação de cada uma e sincronização manual. */
export function AdminSources() {
  const { handleAuthError, can } = useAdminSession();
  const canSync = can("sincronizar");
  const { state, reload } = useAdminLoader(loadSources);
  const [actionState, setActionState] = useState<ActionState>(IDLE_ACTION);

  async function sync(target: DataSource | "all") {
    const question =
      target === "all"
        ? "Sincronizar todas as fontes agora? Pode levar alguns minutos."
        : `Sincronizar ${target.name} agora? Os dados dela serão atualizados com o TABNET.`;

    if (!confirmAdminAction(question)) {
      return;
    }

    setActionState({ ...IDLE_ACTION, busyAction: target === "all" ? "all" : target.slug });

    try {
      const message =
        target === "all"
          ? `${(await runAdminSyncAll()).results.length} fontes processadas.`
          : await runAdminSyncSource(target.slug).then(
              (result) => `${result.source.name}: ${result.syncJob?.status === "SUCCESS" ? "sincronizada com sucesso" : result.syncJob?.status ?? "concluída"}.`
            );
      await reload();
      setActionState({ ...IDLE_ACTION, message });
    } catch (error) {
      if (!handleAuthError(error)) {
        setActionState({ ...IDLE_ACTION, error: errorMessage(error, "Falha ao sincronizar.") });
      }
    }
  }

  if (state.status === "loading") {
    return <LoadingBlocks />;
  }

  if (state.status === "error") {
    return <ErrorBox message={`API indisponível: ${state.message}`} />;
  }

  const busy = actionState.busyAction !== null;

  return (
    <Panel
      title="Fontes de dados"
      icon={Database}
      actions={
        <>
          <ActionButton icon={RefreshCw} onClick={() => void reload()} disabled={busy}>
            Atualizar
          </ActionButton>
          {canSync ? (
            <ActionButton variant="primary" icon={Play} onClick={() => void sync("all")} disabled={busy}>
              {actionState.busyAction === "all" ? "Sincronizando..." : "Sincronizar todas"}
            </ActionButton>
          ) : null}
        </>
      }
    >
      <StatusMessages actionState={actionState} />

      <div className="divide-y divide-slate-100 md:hidden">
        {state.data.map(({ source, summary, latestJob, health }) => (
          <article key={source.slug} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <SourceName source={source} />
              <OfficialLink source={source} />
            </div>
            {health ? <HealthLine health={health} /> : null}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <dt className="mb-1 text-xs uppercase text-slate-500">Filtro municipal</dt>
                <dd>
                  <StatusPill status={source.municipalityFilterStatus} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Registros</dt>
                <dd className="mt-1 text-slate-900">{formatNumber(summary.totalRecords)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Última sincronização</dt>
                <dd className="mt-1">
                  <JobStatus status={latestJob?.status ?? summary.lastSyncStatus ?? null} />
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase text-slate-500">Atualizada em</dt>
                <dd className="mt-1 text-slate-700">{formatDateTime(summary.lastUpdate)}</dd>
              </div>
            </dl>
            {canSync ? (
            <button
              type="button"
              onClick={() => void sync(source)}
              disabled={busy || !source.syncEnabled}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-pet-orange-text px-3 text-sm font-medium text-pet-orange-text hover:bg-pet-orange-text hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={16} aria-hidden="true" />
              {actionState.busyAction === source.slug ? "Sincronizando..." : syncLabel(source)}
            </button>
            ) : (
              <span className="text-xs text-slate-500">Sem permissão para sincronizar</span>
            )}
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-pet-dark text-xs uppercase text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">Fonte</th>
              <th className="px-4 py-3 font-semibold">Situação</th>
              <th className="px-4 py-3 font-semibold">Filtro municipal</th>
              <th className="px-4 py-3 font-semibold">Registros</th>
              <th className="px-4 py-3 font-semibold">Atualizada em</th>
              <th className="px-4 py-3 font-semibold">Última sincronização</th>
              <th className="px-4 py-3 font-semibold">TABNET</th>
              <th className="px-4 py-3 font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.data.map(({ source, summary, latestJob, health }) => (
              <tr key={source.slug} className="align-top">
                <td className="px-4 py-3">
                  <SourceName source={source} />
                </td>
                <td className="max-w-xs px-4 py-3">
                  {health ? <HealthLine health={health} /> : <span className="text-xs text-slate-500">Derivada</span>}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={source.municipalityFilterStatus} />
                </td>
                <td className="px-4 py-3 text-slate-900">{formatNumber(summary.totalRecords)}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(summary.lastUpdate)}</td>
                <td className="px-4 py-3">
                  <JobStatus status={latestJob?.status ?? summary.lastSyncStatus ?? null} />
                </td>
                <td className="px-4 py-3">
                  <OfficialLink source={source} />
                </td>
                <td className="px-4 py-3">
                  {canSync ? (
                  <button
                    type="button"
                    onClick={() => void sync(source)}
                    disabled={busy || !source.syncEnabled}
                    className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded border border-pet-orange-text px-3 text-sm font-medium text-pet-orange-text hover:bg-pet-orange-text hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play size={16} aria-hidden="true" />
                    {actionState.busyAction === source.slug ? "Sincronizando..." : syncLabel(source)}
                  </button>
                  ) : (
                    <span className="text-xs text-slate-500">Sem permissão para sincronizar</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function HealthLine({ health }: { health: SourceHealth }) {
  return (
    <div className="space-y-1">
      <HealthBadge level={health.level} />
      {health.problems.length > 0 ? <p className="text-xs text-slate-600">{health.problems.join(" ")}</p> : null}
    </div>
  );
}

function SourceName({ source }: { source: DataSource }) {
  return (
    <div className="min-w-0">
      <div className="font-medium text-slate-950">{source.name}</div>
      <div className="break-all text-xs text-slate-500">{source.slug}</div>
      <div className="mt-1 text-xs font-medium uppercase text-slate-400">{source.active ? "Operacional" : "Em validação"}</div>
    </div>
  );
}

function OfficialLink({ source }: { source: DataSource }) {
  const url = getSourceReferenceUrl(source.sourceUrl);

  if (!url) {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100 text-slate-400"
        aria-label="Sem página oficial direta"
        title="Sem página oficial direta"
      >
        <Globe size={16} aria-hidden="true" />
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Abrir ${source.name} no TABNET`}
      title={`Abrir ${source.name} no TABNET`}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
    >
      <ExternalLink size={16} aria-hidden="true" />
    </a>
  );
}
