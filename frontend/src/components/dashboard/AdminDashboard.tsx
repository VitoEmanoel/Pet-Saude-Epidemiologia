"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  KeyRound,
  Play,
  RefreshCw,
  Shield,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getAdminSyncHistory,
  getSourceSummary,
  getSources,
  runAdminSyncAll,
  runAdminSyncSource
} from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import type {
  AdminSyncHistoryResponse,
  DataSource,
  SourceSummaryResponse,
  SourcesResponse
} from "@/types/api";
import { MetricCard } from "../ui/MetricCard";
import { StatusPill } from "../ui/StatusPill";

type SourceWithSummary = {
  source: DataSource;
  summary: SourceSummaryResponse["summary"] | null;
};

type LoadState =
  | { status: "loading" }
  | {
      status: "loaded";
      sources: SourcesResponse;
      sourceSummaries: SourceWithSummary[];
      history: AdminSyncHistoryResponse | null;
    }
  | { status: "error"; message: string };

const TOKEN_STORAGE_KEY = "painel_admin_token";

export function AdminDashboard() {
  const [token, setToken] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [actionState, setActionState] = useState<{
    busyAction: string | null;
    message: string | null;
    error: string | null;
  }>({
    busyAction: null,
    message: null,
    error: null
  });

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    setToken(storedToken);
    setDraftToken(storedToken);
  }, []);

  useEffect(() => {
    void loadData(token);
  }, [token]);

  const latestJobsBySource = useMemo(() => {
    const jobs = state.status === "loaded" ? state.history?.syncJobs ?? [] : [];
    const map = new Map<string, AdminSyncHistoryResponse["syncJobs"][number]>();

    for (const job of jobs) {
      if (job.source?.slug && !map.has(job.source.slug)) {
        map.set(job.source.slug, job);
      }
    }

    return map;
  }, [state]);

  async function loadData(currentToken: string) {
    setState({ status: "loading" });

    try {
      const sources = await getSources();
      const [sourceSummaries, history] = await Promise.all([
        Promise.all(
          sources.sources.map(async (source) => ({
            source,
            summary: (await getSourceSummary(source.slug)).summary
          }))
        ),
        currentToken ? getAdminSyncHistory(currentToken) : Promise.resolve(null)
      ]);

      setState({
        status: "loaded",
        sources,
        sourceSummaries,
        history
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Falha ao carregar painel administrativo."
      });
    }
  }

  function saveToken() {
    const trimmed = draftToken.trim();
    window.localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
    setToken(trimmed);
    setActionState({
      busyAction: null,
      message: trimmed ? "Token administrativo salvo." : "Token removido.",
      error: null
    });
  }

  function clearToken() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setDraftToken("");
    setToken("");
    setActionState({
      busyAction: null,
      message: "Token administrativo removido.",
      error: null
    });
  }

  async function syncSource(slug: string) {
    if (!token) {
      setActionState({
        busyAction: null,
        message: null,
        error: "Informe o ADMIN_TOKEN antes de sincronizar."
      });
      return;
    }

    setActionState({ busyAction: slug, message: null, error: null });

    try {
      const result = await runAdminSyncSource(slug, token);
      await loadData(token);
      setActionState({
        busyAction: null,
        message: `${result.source.name}: ${result.syncJob?.status ?? "concluido"}.`,
        error: null
      });
    } catch (error) {
      setActionState({
        busyAction: null,
        message: null,
        error: error instanceof Error ? error.message : "Falha ao sincronizar fonte."
      });
    }
  }

  async function syncAll() {
    if (!token) {
      setActionState({
        busyAction: null,
        message: null,
        error: "Informe o ADMIN_TOKEN antes de sincronizar."
      });
      return;
    }

    setActionState({ busyAction: "all", message: null, error: null });

    try {
      const result = await runAdminSyncAll(token);
      await loadData(token);
      setActionState({
        busyAction: null,
        message: `${result.results.length} fontes processadas.`,
        error: null
      });
    } catch (error) {
      setActionState({
        busyAction: null,
        message: null,
        error: error instanceof Error ? error.message : "Falha ao sincronizar fontes."
      });
    }
  }

  if (state.status === "loading") {
    return <LoadingBlocks />;
  }

  if (state.status === "error") {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        API indisponivel: {state.message}
      </div>
    );
  }

  const totalRecords = state.sourceSummaries.reduce(
    (total, item) => total + (item.summary?.totalRecords ?? 0),
    0
  );
  const successfulJobs = state.history?.syncJobs.filter((job) => job.status === "SUCCESS").length ?? 0;
  const failedJobs = state.history?.syncJobs.filter((job) => job.status === "FAILED").length ?? 0;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Fontes" value={state.sources.total} detail="Ativas" icon={Database} />
        <MetricCard
          label="Registros"
          value={formatNumber(totalRecords)}
          detail="Normalizados"
          icon={Database}
          tone="blue"
        />
        <MetricCard
          label="Sucessos"
          value={successfulJobs}
          detail="Ultimos jobs"
          icon={CheckCircle2}
          tone="green"
        />
        <MetricCard
          label="Falhas"
          value={failedJobs}
          detail="Ultimos jobs"
          icon={AlertCircle}
          tone="amber"
        />
      </section>

      <section className="rounded border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Shield size={17} className="text-slate-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-950">Acesso administrativo</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void loadData(token)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => void syncAll()}
              disabled={actionState.busyAction !== null}
              className="inline-flex h-9 items-center justify-center gap-2 rounded bg-institutional-600 px-3 text-sm font-medium text-white hover:bg-institutional-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={16} aria-hidden="true" />
              Todas
            </button>
          </div>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">
              ADMIN_TOKEN
            </span>
            <input
              type="password"
              value={draftToken}
              onChange={(event) => setDraftToken(event.target.value)}
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            />
          </label>
          <button
            type="button"
            onClick={saveToken}
            className="inline-flex h-10 items-center justify-center gap-2 self-end rounded bg-health-700 px-3 text-sm font-medium text-white hover:bg-health-800"
          >
            <KeyRound size={16} aria-hidden="true" />
            Salvar
          </button>
          <button
            type="button"
            onClick={clearToken}
            className="inline-flex h-10 items-center justify-center gap-2 self-end rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Trash2 size={16} aria-hidden="true" />
            Remover
          </button>
        </div>
        {actionState.message ? (
          <div className="border-t border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {actionState.message}
          </div>
        ) : null}
        {actionState.error ? (
          <div className="border-t border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {actionState.error}
          </div>
        ) : null}
      </section>

      <section className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-950">Fontes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Fonte</th>
                <th className="px-4 py-3 font-semibold">Status municipal</th>
                <th className="px-4 py-3 font-semibold">Registros</th>
                <th className="px-4 py-3 font-semibold">Ultima sincronizacao</th>
                <th className="px-4 py-3 font-semibold">Ultimo job</th>
                <th className="px-4 py-3 font-semibold">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.sourceSummaries.map(({ source, summary }) => {
                const latestJob = latestJobsBySource.get(source.slug);
                const busy = actionState.busyAction === source.slug || actionState.busyAction === "all";

                return (
                  <tr key={source.slug}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950">{source.name}</div>
                      <div className="text-xs text-slate-500">{source.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={source.municipalityFilterStatus} />
                    </td>
                    <td className="px-4 py-3 text-slate-900">
                      {formatNumber(summary?.totalRecords ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateTime(summary?.lastUpdate ?? null)}
                    </td>
                    <td className="px-4 py-3">
                      <JobStatus status={latestJob?.status ?? summary?.lastSyncStatus ?? null} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void syncSource(source.slug)}
                        disabled={busy}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Play size={16} aria-hidden="true" />
                        Fonte
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-950">Historico de sincronizacoes</h2>
        </div>
        {!token ? (
          <div className="p-4 text-sm text-slate-600">
            Informe o ADMIN_TOKEN para carregar o historico administrativo.
          </div>
        ) : state.history ? (
          <HistoryTable history={state.history} />
        ) : (
          <div className="p-4 text-sm text-slate-600">Historico indisponivel.</div>
        )}
      </section>
    </div>
  );
}

function JobStatus({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-sm text-slate-400">Sem status</span>;
  }

  const success = status === "SUCCESS";
  const failed = status === "FAILED" || status === "UNAVAILABLE";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded border px-2 py-1 text-xs font-medium ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : failed
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {success ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}
      {status}
    </span>
  );
}

function HistoryTable({ history }: { history: AdminSyncHistoryResponse }) {
  if (history.syncJobs.length === 0) {
    return <div className="p-4 text-sm text-slate-600">Nenhuma sincronizacao registrada.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Fonte</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Registros</th>
            <th className="px-4 py-3 font-semibold">Inicio</th>
            <th className="px-4 py-3 font-semibold">Fim</th>
            <th className="px-4 py-3 font-semibold">Origem</th>
            <th className="px-4 py-3 font-semibold">Erro</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {history.syncJobs.map((job) => (
            <tr key={job.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-950">{job.source?.name ?? "-"}</div>
                <div className="text-xs text-slate-500">{job.source?.slug ?? "-"}</div>
              </td>
              <td className="px-4 py-3">
                <JobStatus status={job.status} />
              </td>
              <td className="px-4 py-3 text-slate-900">{formatNumber(job.recordsImported)}</td>
              <td className="px-4 py-3 text-slate-700">{formatDateTime(job.startedAt)}</td>
              <td className="px-4 py-3 text-slate-700">{formatDateTime(job.finishedAt)}</td>
              <td className="px-4 py-3 text-slate-700">{job.requestedBy ?? "-"}</td>
              <td className="max-w-md px-4 py-3 text-slate-700">{job.errorMessage ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingBlocks() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded border border-slate-200 bg-white" />
      <div className="h-96 animate-pulse rounded border border-slate-200 bg-white" />
    </div>
  );
}
