"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Filter,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  Shield
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  downloadAdminRecordsCsv,
  getAdminAuditLogs,
  getAdminSession,
  getAdminSyncHistory,
  getSourceFilters,
  getSourceSummary,
  getSources,
  loginAdmin,
  logoutAdmin,
  runAdminSyncAll,
  runAdminSyncSource
} from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import type {
  AdminAuditLogsResponse,
  AdminSyncHistoryResponse,
  DataSource,
  RecordFilters,
  SourceFiltersResponse,
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
      auditLogs: AdminAuditLogsResponse | null;
    }
  | { status: "error"; message: string };

type ExportFiltersState =
  | { status: "loading" }
  | { status: "loaded"; filters: SourceFiltersResponse; sourceSlug: string }
  | { status: "error"; message: string };

type AuthState = { status: "checking" } | { status: "authenticated" } | { status: "unauthenticated" };

export function AdminDashboard() {
  const [authState, setAuthState] = useState<AuthState>({ status: "checking" });
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [exportSourceSlug, setExportSourceSlug] = useState("");
  const [exportFiltersState, setExportFiltersState] = useState<ExportFiltersState>({
    status: "loading"
  });
  const [exportFilters, setExportFilters] = useState<RecordFilters>({
    source: "",
    year: undefined,
    sex: undefined,
    ageGroup: undefined,
    raceColor: undefined,
    condition: undefined
  });
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
    let active = true;

    getAdminSession()
      .then(() => {
        if (active) {
          setAuthState({ status: "authenticated" });
          void loadData(true);
        }
      })
      .catch(() => {
        if (active) {
          setAuthState({ status: "unauthenticated" });
          void loadData(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state.status !== "loaded") {
      return;
    }

    if (!exportSourceSlug && state.sources.sources.length > 0) {
      setExportSourceSlug(state.sources.sources[0].slug);
    }
  }, [exportSourceSlug, state]);

  useEffect(() => {
    if (!exportSourceSlug) {
      return;
    }

    let active = true;
    setExportFiltersState({ status: "loading" });

    getSourceFilters(exportSourceSlug)
      .then((filters) => {
        if (active) {
          setExportFiltersState({
            status: "loaded",
            filters,
            sourceSlug: exportSourceSlug
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setExportFiltersState({
            status: "error",
            message: error instanceof Error ? error.message : "Falha ao carregar filtros de exportacao."
          });
        }
      });

    return () => {
      active = false;
    };
  }, [exportSourceSlug]);

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

  async function loadData(includeAdminHistory: boolean) {
    setState({ status: "loading" });

    try {
      const sources = await getSources();
      const [sourceSummaries, history, auditLogs] = await Promise.all([
        Promise.all(
          sources.sources.map(async (source) => ({
            source,
            summary: (await getSourceSummary(source.slug)).summary
          }))
        ),
        includeAdminHistory ? getAdminSyncHistory() : Promise.resolve(null),
        includeAdminHistory ? getAdminAuditLogs() : Promise.resolve(null)
      ]);

      setState({
        status: "loaded",
        sources,
        sourceSummaries,
        history,
        auditLogs
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Falha ao carregar painel administrativo."
      });
    }
  }

  async function login() {
    const trimmedPassword = password.trim();

    if (!trimmedPassword) {
      setActionState({
        busyAction: null,
        message: null,
        error: "Informe a senha administrativa."
      });
      return;
    }

    setActionState({ busyAction: "login", message: null, error: null });

    try {
      await loginAdmin(trimmedPassword);
      setPassword("");
      setAuthState({ status: "authenticated" });
      await loadData(true);
      setActionState({
        busyAction: null,
        message: "Sessao administrativa iniciada.",
        error: null
      });
    } catch (error) {
      setAuthState({ status: "unauthenticated" });
      setActionState({
        busyAction: null,
        message: null,
        error: error instanceof Error ? error.message : "Falha ao autenticar."
      });
    }
  }

  async function logout() {
    setActionState({ busyAction: "logout", message: null, error: null });

    try {
      await logoutAdmin();
      setAuthState({ status: "unauthenticated" });
      await loadData(false);
      setActionState({
        busyAction: null,
        message: "Sessao administrativa encerrada.",
        error: null
      });
    } catch (error) {
      setActionState({
        busyAction: null,
        message: null,
        error: error instanceof Error ? error.message : "Falha ao sair."
      });
    }
  }

  async function syncSource(slug: string) {
    if (authState.status !== "authenticated") {
      setActionState({
        busyAction: null,
        message: null,
        error: "Entre na sessao administrativa antes de sincronizar."
      });
      return;
    }

    setActionState({ busyAction: slug, message: null, error: null });

    try {
      const result = await runAdminSyncSource(slug);
      await loadData(true);
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
    if (authState.status !== "authenticated") {
      setActionState({
        busyAction: null,
        message: null,
        error: "Entre na sessao administrativa antes de sincronizar."
      });
      return;
    }

    setActionState({ busyAction: "all", message: null, error: null });

    try {
      const result = await runAdminSyncAll();
      await loadData(true);
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

  function updateExportFilter(
    key: keyof Omit<RecordFilters, "source" | "page" | "pageSize">,
    value: string | number | undefined
  ) {
    setExportFilters((current) => ({
      ...current,
      [key]: value === "" ? undefined : value
    }));
  }

  async function exportCsv() {
    if (authState.status !== "authenticated") {
      setActionState({
        busyAction: null,
        message: null,
        error: "Entre na sessao administrativa antes de exportar."
      });
      return;
    }

    if (!exportSourceSlug) {
      setActionState({
        busyAction: null,
        message: null,
        error: "Selecione uma fonte para exportar."
      });
      return;
    }

    setActionState({ busyAction: "export", message: null, error: null });

    try {
      const { blob, filename } = await downloadAdminRecordsCsv(
        {
          source: exportSourceSlug,
          year: exportFilters.year,
          sex: exportFilters.sex,
          ageGroup: exportFilters.ageGroup,
          raceColor: exportFilters.raceColor,
          condition: exportFilters.condition
        }
      );

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      setActionState({
        busyAction: null,
        message: "CSV exportado com sucesso.",
        error: null
      });
    } catch (error) {
      setActionState({
        busyAction: null,
        message: null,
        error: error instanceof Error ? error.message : "Falha ao exportar CSV."
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
  const authenticated = authState.status === "authenticated";

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
              onClick={() => void loadData(authenticated)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => void syncAll()}
              disabled={actionState.busyAction !== null || !authenticated}
              className="inline-flex h-9 items-center justify-center gap-2 rounded bg-institutional-600 px-3 text-sm font-medium text-white hover:bg-institutional-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={16} aria-hidden="true" />
              Todas
            </button>
          </div>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Senha administrativa
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={authenticated}
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            />
          </label>
          {authenticated ? (
            <button
              type="button"
              onClick={() => void logout()}
              disabled={actionState.busyAction !== null}
              className="inline-flex h-10 items-center justify-center gap-2 self-end rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void login()}
              disabled={actionState.busyAction !== null || authState.status === "checking"}
              className="inline-flex h-10 items-center justify-center gap-2 self-end rounded bg-health-700 px-3 text-sm font-medium text-white hover:bg-health-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogIn size={16} aria-hidden="true" />
              Entrar
            </button>
          )}
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
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter size={17} className="text-slate-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-950">Exportacao CSV</h2>
          </div>
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={actionState.busyAction !== null || exportFiltersState.status !== "loaded" || !authenticated}
            className="inline-flex h-9 items-center justify-center gap-2 rounded bg-institutional-600 px-3 text-sm font-medium text-white hover:bg-institutional-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} aria-hidden="true" />
            Baixar CSV
          </button>
        </div>

        <div className="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Fonte</span>
            <select
              value={exportSourceSlug}
              onChange={(event) => setExportSourceSlug(event.target.value)}
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            >
              {state.status === "loaded"
                ? state.sources.sources.map((source) => (
                    <option key={source.slug} value={source.slug}>
                      {source.name}
                    </option>
                  ))
                : null}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Ano</span>
            <select
              value={exportFilters.year ?? ""}
              onChange={(event) =>
                updateExportFilter("year", event.target.value ? Number(event.target.value) : undefined)
              }
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            >
              <option value="">Todos</option>
              {exportFiltersState.status === "loaded"
                ? exportFiltersState.filters.filters.years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))
                : null}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Sexo</span>
            <select
              value={exportFilters.sex ?? ""}
              onChange={(event) => updateExportFilter("sex", event.target.value)}
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            >
              <option value="">Todos</option>
              {exportFiltersState.status === "loaded"
                ? exportFiltersState.filters.filters.sex.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))
                : null}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Faixa etaria</span>
            <select
              value={exportFilters.ageGroup ?? ""}
              onChange={(event) => updateExportFilter("ageGroup", event.target.value)}
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            >
              <option value="">Todos</option>
              {exportFiltersState.status === "loaded"
                ? exportFiltersState.filters.filters.ageGroups.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))
                : null}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Raca/cor</span>
            <select
              value={exportFilters.raceColor ?? ""}
              onChange={(event) => updateExportFilter("raceColor", event.target.value)}
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            >
              <option value="">Todos</option>
              {exportFiltersState.status === "loaded"
                ? exportFiltersState.filters.filters.raceColors.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))
                : null}
            </select>
          </label>
        </div>

        {exportFiltersState.status === "error" ? (
          <div className="border-t border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {exportFiltersState.message}
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
                        disabled={busy || !authenticated}
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
        {!authenticated ? (
          <div className="p-4 text-sm text-slate-600">
            Entre na sessao administrativa para carregar o historico.
          </div>
        ) : state.history ? (
          <HistoryTable history={state.history} />
        ) : (
          <div className="p-4 text-sm text-slate-600">Historico indisponivel.</div>
        )}
      </section>

      <section className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-950">Auditoria administrativa</h2>
        </div>
        {!authenticated ? (
          <div className="p-4 text-sm text-slate-600">
            Entre na sessao administrativa para carregar a auditoria.
          </div>
        ) : state.auditLogs ? (
          <AuditTable auditLogs={state.auditLogs} />
        ) : (
          <div className="p-4 text-sm text-slate-600">Auditoria indisponivel.</div>
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

function AuditTable({ auditLogs }: { auditLogs: AdminAuditLogsResponse }) {
  if (auditLogs.auditLogs.length === 0) {
    return <div className="p-4 text-sm text-slate-600">Nenhum evento administrativo registrado.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Data</th>
            <th className="px-4 py-3 font-semibold">Acao</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Origem</th>
            <th className="px-4 py-3 font-semibold">Detalhes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {auditLogs.auditLogs.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3 text-slate-700">{formatDateTime(log.createdAt)}</td>
              <td className="px-4 py-3 text-slate-950">{formatAuditAction(log.action)}</td>
              <td className="px-4 py-3">
                <JobStatus status={log.status} />
              </td>
              <td className="px-4 py-3 text-slate-700">{log.ipAddress ?? "-"}</td>
              <td className="max-w-lg px-4 py-3 text-slate-700">
                {formatAuditMetadata(log.metadata)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAuditAction(action: string) {
  const labels: Record<string, string> = {
    admin_login: "Login",
    admin_logout: "Logout",
    admin_export_csv: "Exportacao CSV",
    admin_sync_source: "Sincronizacao de fonte",
    admin_sync_all: "Sincronizacao geral"
  };

  return labels[action] ?? action;
}

function formatAuditMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return "-";
  }

  if (typeof metadata.source === "string") {
    return metadata.source;
  }

  if (typeof metadata.recordsExported === "number") {
    return `${formatNumber(metadata.recordsExported)} registros`;
  }

  if (typeof metadata.totalSources === "number") {
    return `${formatNumber(metadata.totalSources)} fontes`;
  }

  if (typeof metadata.message === "string") {
    return metadata.message;
  }

  return "-";
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
