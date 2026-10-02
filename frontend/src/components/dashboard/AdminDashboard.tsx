"use client";

import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  ExternalLink,
  Filter,
  Globe,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  Shield,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  downloadAdminDashboardHtml,
  downloadAdminRecordsCsv,
  getAdminAuditLogs,
  getAdminSession,
  getAdminSyncHistory,
  getChartByAgeGroup,
  getChartByRaceColor,
  getChartBySex,
  getSourceFilters,
  getSourceSummary,
  getSources,
  getYearlyEvolution,
  loginAdmin,
  logoutAdmin,
  runAdminSyncAll,
  runAdminSyncSource
} from "@/lib/api";
import { AGGREGATION_LABELS, formatDateTime, formatNumber, formatYearRange } from "@/lib/format";
import { ApiRequestError } from "@/lib/api";
import type {
  AdminAuditLogsResponse,
  AdminSyncHistoryResponse,
  CategoryPoint,
  ChartPoint,
  DataSource,
  RecordFilters,
  SourceFiltersResponse,
  SourceSummaryResponse,
  SourcesResponse
} from "@/types/api";
import { ChartPanel } from "./ChartPanel";
import { MetricCard } from "../ui/MetricCard";
import { StatusPill } from "../ui/StatusPill";

const ADMIN_TABLE_PAGE_SIZE = 12;

type SourceWithSummary = {
  source: DataSource;
  summary: SourceSummaryResponse["summary"] | null;
};

type LoadState =
  | { status: "idle" }
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

type DashboardFilterValues = {
  year: string;
  sex: string;
  ageGroup: string;
  raceColor: string;
};

type AdminSourceDashboardState =
  | { status: "loading" }
  | {
      status: "loaded";
      summary: SourceSummaryResponse;
      filters: SourceFiltersResponse;
    }
  | { status: "error"; message: string };

type AdminChartsState =
  | { status: "loading" }
  | {
      status: "loaded";
      yearly: ChartPoint[];
      bySex: CategoryPoint[];
      byAgeGroup: CategoryPoint[];
      byRaceColor: CategoryPoint[];
    }
  | { status: "error"; message: string };

type AuthState = { status: "checking" } | { status: "authenticated" } | { status: "unauthenticated" };
type ExportFormat = "records_csv" | "dashboard_html";

function isAdminAuthError(error: unknown) {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}

function isAdminRateLimitError(error: unknown) {
  return error instanceof ApiRequestError && error.status === 429;
}

function confirmAdminAction(message: string) {
  if (typeof window === "undefined") {
    return true;
  }

  return window.confirm(message);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function getSourceReferenceUrl(sourceUrl: string | null) {
  if (!sourceUrl) {
    return null;
  }

  if (sourceUrl.startsWith("http://tabnet.datasus.gov.br")) {
    return sourceUrl.replace("http://tabnet.datasus.gov.br", "https://tabnet.datasus.gov.br");
  }

  return sourceUrl;
}

export function AdminDashboard() {
  const [authState, setAuthState] = useState<AuthState>({ status: "checking" });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [exportFormat, setExportFormat] = useState<ExportFormat>("records_csv");
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
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (authState.status !== "authenticated") {
      return;
    }

    if (state.status !== "loaded") {
      return;
    }

    if (!exportSourceSlug && state.sources.sources.length > 0) {
      setExportSourceSlug(state.sources.sources[0].slug);
    }
  }, [authState.status, exportSourceSlug, state]);

  useEffect(() => {
    if (authState.status !== "authenticated" || !exportSourceSlug) {
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
  }, [authState.status, exportSourceSlug]);

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
      if (includeAdminHistory && isAdminAuthError(error)) {
        setAuthState({ status: "unauthenticated" });
        setState({ status: "idle" });
        setUsername("");
        setPassword("");
        return;
      }

      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Falha ao carregar painel administrativo."
      });
    }
  }

  async function login() {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setActionState({
        busyAction: null,
        message: null,
        error: "Informe usuario e senha administrativos."
      });
      return;
    }

    setActionState({ busyAction: "login", message: null, error: null });

    try {
      await loginAdmin({
        username: trimmedUsername,
        password: trimmedPassword
      });
      setUsername("");
      setPassword("");
      setAuthState({ status: "authenticated" });
      await loadData(true);
      setActionState({
        busyAction: null,
        message: "Sessao administrativa iniciada.",
        error: null
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        setAuthState({ status: "unauthenticated" });
      }
      setActionState({
        busyAction: null,
        message: null,
        error: isAdminRateLimitError(error)
          ? "Muitas tentativas. Aguarde e tente novamente."
          : error instanceof Error
            ? error.message
            : "Falha ao autenticar."
      });
    }
  }

  async function logout() {
    setActionState({ busyAction: "logout", message: null, error: null });

    try {
      await logoutAdmin();
      setAuthState({ status: "unauthenticated" });
      setState({ status: "idle" });
      setExportSourceSlug("");
      setExportFiltersState({ status: "loading" });
      setUsername("");
      setPassword("");
      setActionState({
        busyAction: null,
        message: "Sessao administrativa encerrada.",
        error: null
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        setAuthState({ status: "unauthenticated" });
        setState({ status: "idle" });
        setUsername("");
        setPassword("");
      }
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

    const sourceName =
      state.status === "loaded"
        ? state.sources.sources.find((source) => source.slug === slug)?.name ?? slug
        : slug;

    if (
      !confirmAdminAction(
        `Sincronizar ${sourceName} agora? Isso pode substituir o estado mais recente da fonte.`
      )
    ) {
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
      if (isAdminAuthError(error)) {
        setAuthState({ status: "unauthenticated" });
        setPassword("");
        void loadData(false);
      }

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

    if (
      !confirmAdminAction(
        "Sincronizar todas as fontes agora? Isso pode consumir mais tempo e recursos."
      )
    ) {
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
      if (isAdminAuthError(error)) {
        setAuthState({ status: "unauthenticated" });
        setPassword("");
        void loadData(false);
      }

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

  async function exportSelectedFile() {
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
      const filters = {
        source: exportSourceSlug,
        year: exportFilters.year,
        sex: exportFilters.sex,
        ageGroup: exportFilters.ageGroup,
        raceColor: exportFilters.raceColor,
        condition: exportFilters.condition,
        aggregation: exportFormat === "records_csv" ? exportFilters.aggregation : undefined
      };
      const { blob, filename } =
        exportFormat === "dashboard_html"
          ? await downloadAdminDashboardHtml(filters)
          : await downloadAdminRecordsCsv(filters);

      downloadBlob(blob, filename);

      setActionState({
        busyAction: null,
        message:
          exportFormat === "dashboard_html"
            ? "Dashboard exportado com sucesso."
            : "CSV exportado com sucesso.",
        error: null
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        setAuthState({ status: "unauthenticated" });
        setPassword("");
        void loadData(false);
      }

      setActionState({
        busyAction: null,
        message: null,
        error: error instanceof Error ? error.message : "Falha ao exportar arquivo."
      });
    }
  }

  if (authState.status === "checking" || (authState.status === "authenticated" && state.status === "loading")) {
    return <LoadingBlocks />;
  }

  if (authState.status !== "authenticated") {
    return (
      <section className="mx-auto max-w-md rounded border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded bg-health-700 text-white">
              <Shield size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Login administrativo</h2>
              <p className="text-sm text-slate-500">
                O painel interno so e liberado com credenciais validas.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Usuario</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            />
          </label>
          <button
            type="button"
            onClick={() => void login()}
            disabled={actionState.busyAction !== null}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-pet-mid px-4 text-sm font-medium text-white hover:bg-pet-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogIn size={16} aria-hidden="true" />
            Entrar no painel
          </button>
        </div>
        <StatusMessages actionState={actionState} />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded border border-pet-red bg-pet-red/5 p-4 text-sm text-pet-red">
        API indisponivel: {state.message}
      </div>
    );
  }

  if (state.status !== "loaded") {
    return <LoadingBlocks />;
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
        <MetricCard label="Fontes" value={state.sources.total} detail="No catálogo" icon={Database} />
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
              onClick={() => void loadData(true)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => void syncAll()}
              disabled={actionState.busyAction !== null}
              className="inline-flex h-9 items-center justify-center gap-2 rounded bg-pet-orange px-3 text-sm font-medium text-white hover:bg-pet-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={16} aria-hidden="true" />
              Ativas
            </button>
          </div>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Usuario administrativo
            </span>
            <input
              type="text"
              value="Autenticado"
              disabled
              className="h-10 w-full rounded border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Senha administrativa
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled
              className="h-10 w-full rounded border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
            />
          </label>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={actionState.busyAction !== null}
            className="inline-flex h-10 items-center justify-center gap-2 self-end rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut size={16} aria-hidden="true" />
            Sair
          </button>
        </div>
        <StatusMessages actionState={actionState} />
      </section>

      <AdminSourceDashboard sources={state.sources.sources} />

      <section className="rounded border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter size={17} className="text-slate-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-950">Exportacao</h2>
          </div>
          <button
            type="button"
            onClick={() => void exportSelectedFile()}
            disabled={actionState.busyAction !== null || exportFiltersState.status !== "loaded"}
            className="inline-flex h-9 items-center justify-center gap-2 rounded bg-institutional-600 px-3 text-sm font-medium text-white hover:bg-institutional-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} aria-hidden="true" />
            {exportFormat === "dashboard_html" ? "Baixar dashboard" : "Baixar CSV"}
          </button>
        </div>

        <div className="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-7">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Tipo</span>
            <select
              value={exportFormat}
              onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            >
              <option value="records_csv">Tabela CSV</option>
              <option value="dashboard_html">Dashboard HTML</option>
            </select>
          </label>

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

          {exportFormat === "records_csv" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Visão</span>
              <select
                value={exportFilters.aggregation ?? ""}
                onChange={(event) => updateExportFilter("aggregation", event.target.value)}
                className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
              >
                <option value="">Automática (pelo filtro)</option>
                {(["yearly", "sex", "age_group", "race_color", "all"] as const).map((view) => (
                  <option key={view} value={view}>
                    {AGGREGATION_LABELS[view]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {exportFiltersState.status === "error" ? (
          <div className="border-t border-pet-red/30 bg-pet-red/5 px-4 py-3 text-sm text-pet-red">
            {exportFiltersState.message}
          </div>
        ) : null}
      </section>

      <section className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-950">Fontes</h2>
        </div>
        <div className="divide-y divide-slate-100 md:hidden">
          {state.sourceSummaries.map(({ source, summary }) => {
            const latestJob = latestJobsBySource.get(source.slug);
            const busy = actionState.busyAction === source.slug || actionState.busyAction === "all";
            const sourceIsActive = source.active;
            const sourceCanSync = source.syncEnabled;
            const referenceUrl = getSourceReferenceUrl(source.sourceUrl);

            return (
              <article key={source.slug} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {referenceUrl ? (
                      <a
                        href={referenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 font-medium text-slate-950 transition hover:text-sky-700 hover:underline"
                      >
                        {source.name}
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    ) : (
                      <div className="font-medium text-slate-950">{source.name}</div>
                    )}
                    <div className="mt-1 break-all text-xs text-slate-500">{source.slug}</div>
                    <div className="mt-1 text-xs font-medium uppercase text-slate-400">
                      {sourceIsActive ? "Operacional" : "Em validacao"}
                    </div>
                  </div>
                  {referenceUrl ? (
                    <a
                      href={referenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir fonte oficial de ${source.name}`}
                      title={`Abrir fonte oficial de ${source.name}`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-sky-200 bg-sky-50 text-sky-700 transition hover:bg-sky-100 hover:text-sky-800"
                    >
                      <Globe size={16} aria-hidden="true" />
                    </a>
                  ) : (
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100 text-slate-400"
                      aria-label="Sem fonte oficial direta"
                      title="Sem fonte oficial direta"
                    >
                      <Globe size={16} aria-hidden="true" />
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2">
                    <dt className="mb-1 text-xs uppercase text-slate-500">Status municipal</dt>
                    <dd>
                      <StatusPill status={source.municipalityFilterStatus} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Registros</dt>
                    <dd className="mt-1 text-slate-900">{formatNumber(summary?.totalRecords ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Ultimo job</dt>
                    <dd className="mt-1">
                      <JobStatus status={latestJob?.status ?? summary?.lastSyncStatus ?? null} />
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs uppercase text-slate-500">Ultima sincronizacao</dt>
                    <dd className="mt-1 text-slate-700">{formatDateTime(summary?.lastUpdate ?? null)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => void syncSource(source.slug)}
                  disabled={busy || !authenticated || !sourceCanSync}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-pet-orange px-3 text-sm font-medium text-pet-orange hover:bg-pet-orange hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play size={16} aria-hidden="true" />
                  {sourceCanSync ? "Sincronizar fonte" : sourceIsActive ? "Fonte derivada" : "Fonte prevista"}
                </button>
              </article>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-pet-dark text-xs uppercase text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Fonte</th>
                <th className="px-4 py-3 font-semibold">Status municipal</th>
                <th className="px-4 py-3 font-semibold">Registros</th>
                <th className="px-4 py-3 font-semibold">Ultima sincronizacao</th>
                <th className="px-4 py-3 font-semibold">Ultimo job</th>
                <th className="px-4 py-3 font-semibold">Origem</th>
                <th className="px-4 py-3 font-semibold">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.sourceSummaries.map(({ source, summary }) => {
                const latestJob = latestJobsBySource.get(source.slug);
                const busy = actionState.busyAction === source.slug || actionState.busyAction === "all";
                const sourceIsActive = source.active;
                const sourceCanSync = source.syncEnabled;
                const referenceUrl = getSourceReferenceUrl(source.sourceUrl);

                return (
                  <tr key={source.slug}>
                    <td className="px-4 py-3">
                      {referenceUrl ? (
                        <a
                          href={referenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 font-medium text-slate-950 transition hover:text-sky-700 hover:underline"
                        >
                          {source.name}
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      ) : (
                        <div className="font-medium text-slate-950">{source.name}</div>
                      )}
                      <div className="text-xs text-slate-500">{source.slug}</div>
                      <div className="mt-1 text-xs font-medium uppercase text-slate-400">
                        {sourceIsActive ? "Operacional" : "Em validacao"}
                      </div>
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
                      {referenceUrl ? (
                        <a
                          href={referenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir fonte oficial de ${source.name}`}
                          title={`Abrir fonte oficial de ${source.name}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded border border-sky-200 bg-sky-50 text-sky-700 transition hover:bg-sky-100 hover:text-sky-800"
                        >
                          <Globe size={16} aria-hidden="true" />
                        </a>
                      ) : (
                        <span
                          className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 bg-slate-100 text-slate-400"
                          aria-label="Sem fonte oficial direta"
                          title="Sem fonte oficial direta"
                        >
                          <Globe size={16} aria-hidden="true" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void syncSource(source.slug)}
                        disabled={busy || !authenticated || !sourceCanSync}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded border border-pet-orange px-3 text-sm font-medium text-pet-orange hover:bg-pet-orange hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Play size={16} aria-hidden="true" />
                        {sourceCanSync ? "Fonte" : sourceIsActive ? "Derivada" : "Prevista"}
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

function AdminSourceDashboard({ sources }: { sources: DataSource[] }) {
  const [sourceSlug, setSourceSlug] = useState(sources[0]?.slug ?? "");
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilterValues>({
    year: "",
    sex: "",
    ageGroup: "",
    raceColor: ""
  });
  const [sourceState, setSourceState] = useState<AdminSourceDashboardState>({ status: "loading" });
  const [chartsState, setChartsState] = useState<AdminChartsState>({ status: "loading" });

  useEffect(() => {
    if (sources.length === 0) {
      return;
    }

    if (!sourceSlug || !sources.some((source) => source.slug === sourceSlug)) {
      setSourceSlug(sources[0].slug);
    }
  }, [sourceSlug, sources]);

  const activeFilters = useMemo<RecordFilters>(
    () => ({
      year: dashboardFilters.year ? Number(dashboardFilters.year) : undefined,
      sex: dashboardFilters.sex || undefined,
      ageGroup: dashboardFilters.ageGroup || undefined,
      raceColor: dashboardFilters.raceColor || undefined
    }),
    [dashboardFilters]
  );

  useEffect(() => {
    if (!sourceSlug) {
      return;
    }

    let active = true;
    setSourceState({ status: "loading" });

    Promise.all([getSourceSummary(sourceSlug), getSourceFilters(sourceSlug)])
      .then(([summary, filters]) => {
        if (active) {
          setSourceState({
            status: "loaded",
            summary,
            filters
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSourceState({
            status: "error",
            message: error instanceof Error ? error.message : "Falha ao carregar dashboard da fonte."
          });
        }
      });

    return () => {
      active = false;
    };
  }, [sourceSlug]);

  useEffect(() => {
    if (!sourceSlug) {
      return;
    }

    let active = true;
    setChartsState({ status: "loading" });

    Promise.all([
      getYearlyEvolution(sourceSlug, activeFilters),
      getChartBySex(sourceSlug, activeFilters),
      getChartByAgeGroup(sourceSlug, activeFilters),
      getChartByRaceColor(sourceSlug, activeFilters)
    ])
      .then(([yearly, bySex, byAgeGroup, byRaceColor]) => {
        if (active) {
          setChartsState({
            status: "loaded",
            yearly: yearly.series,
            bySex: bySex.series,
            byAgeGroup: byAgeGroup.series,
            byRaceColor: byRaceColor.series
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setChartsState({
            status: "error",
            message: error instanceof Error ? error.message : "Falha ao carregar graficos."
          });
        }
      });

    return () => {
      active = false;
    };
  }, [activeFilters, sourceSlug]);

  function updateDashboardFilter(key: keyof DashboardFilterValues, value: string) {
    setDashboardFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function changeSource(nextSourceSlug: string) {
    setSourceSlug(nextSourceSlug);
    setDashboardFilters({
      year: "",
      sex: "",
      ageGroup: "",
      raceColor: ""
    });
  }

  function clearDashboardFilters() {
    setDashboardFilters({
      year: "",
      sex: "",
      ageGroup: "",
      raceColor: ""
    });
  }

  const hasSelectedFilters = Object.values(dashboardFilters).some(Boolean);
  const selectedSource = sources.find((source) => source.slug === sourceSlug) ?? sources[0] ?? null;
  const availableFilters = sourceState.status === "loaded" ? sourceState.filters.filters : null;
  const visibleYearly = chartsState.status === "loaded" ? chartsState.yearly : null;
  const visibleTotalCases =
    visibleYearly?.reduce((total, point) => total + point.value, 0) ??
    (sourceState.status === "loaded" ? sourceState.summary.summary.totalCases : 0);
  const latestVisiblePoint = visibleYearly ? visibleYearly[visibleYearly.length - 1] : null;
  const firstVisibleYear =
    visibleYearly?.[0]?.year ??
    (sourceState.status === "loaded" ? sourceState.summary.summary.firstAvailableYear : null);
  const lastVisibleYear =
    latestVisiblePoint?.year ??
    (sourceState.status === "loaded" ? sourceState.summary.summary.lastAvailableYear : null);

  return (
    <div className="space-y-5">
      <section className="rounded border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Activity size={17} className="text-slate-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-950">Dashboard da fonte</h2>
          </div>
          <button
            type="button"
            onClick={clearDashboardFilters}
            disabled={!hasSelectedFilters}
            className="inline-flex h-9 items-center justify-center gap-2 rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={16} aria-hidden="true" />
            Limpar
          </button>
        </div>

        <div className="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Fonte</span>
            <select
              value={sourceSlug}
              onChange={(event) => changeSource(event.target.value)}
              disabled={sources.length === 0}
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {sources.map((source) => (
                <option key={source.slug} value={source.slug}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>

          <DashboardFilterSelect
            label="Ano"
            value={dashboardFilters.year}
            options={(availableFilters?.years ?? []).map(String)}
            onChange={(value) => updateDashboardFilter("year", value)}
            disabled={sourceState.status !== "loaded"}
          />
          <DashboardFilterSelect
            label="Sexo"
            value={dashboardFilters.sex}
            options={availableFilters?.sex ?? []}
            onChange={(value) => updateDashboardFilter("sex", value)}
            disabled={sourceState.status !== "loaded"}
          />
          <DashboardFilterSelect
            label="Faixa etaria"
            value={dashboardFilters.ageGroup}
            options={availableFilters?.ageGroups ?? []}
            onChange={(value) => updateDashboardFilter("ageGroup", value)}
            disabled={sourceState.status !== "loaded"}
          />
          <DashboardFilterSelect
            label="Raca/cor"
            value={dashboardFilters.raceColor}
            options={availableFilters?.raceColors ?? []}
            onChange={(value) => updateDashboardFilter("raceColor", value)}
            disabled={sourceState.status !== "loaded"}
          />
        </div>

        {sourceState.status === "error" ? (
          <div className="border-t border-pet-red/30 bg-pet-red/5 px-4 py-3 text-sm text-pet-red">
            {sourceState.message}
          </div>
        ) : null}
      </section>

      {sourceState.status === "loaded" ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Casos"
            value={formatNumber(visibleTotalCases)}
            detail={hasSelectedFilters ? "Filtros aplicados" : selectedSource?.name ?? "Fonte"}
            icon={Activity}
            tone="green"
          />
          <MetricCard
            label="Ultimo ano"
            value={latestVisiblePoint?.value ?? sourceState.summary.summary.latestYearValue ?? 0}
            detail={String(latestVisiblePoint?.year ?? sourceState.summary.summary.latestYear ?? "")}
            icon={CalendarDays}
            tone="blue"
          />
          <MetricCard
            label="Registros"
            value={formatNumber(sourceState.summary.summary.totalRecords)}
            detail="Normalizados"
            icon={Database}
          />
          <MetricCard
            label="Periodo"
            value={formatYearRange(firstVisibleYear, lastVisibleYear)}
            detail="Anos disponiveis"
            icon={CalendarDays}
          />
          <MetricCard
            label="Atualizacao"
            value={sourceState.summary.summary.lastSyncStatus ?? "Sem status"}
            detail={formatDateTime(sourceState.summary.summary.lastUpdate)}
            icon={RefreshCw}
            tone="amber"
          />
        </section>
      ) : (
        <AdminDashboardMetricSkeleton />
      )}

      <AdminDashboardCharts state={chartsState} />
    </div>
  );
}

function DashboardFilterSelect({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminDashboardCharts({ state }: { state: AdminChartsState }) {
  if (state.status === "loading") {
    return (
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="h-[370px] animate-pulse rounded border border-slate-200 bg-white" />
          <div className="h-[370px] animate-pulse rounded border border-slate-200 bg-white" />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="h-[340px] animate-pulse rounded border border-slate-200 bg-white" />
          <div className="h-[340px] animate-pulse rounded border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded border border-pet-red bg-pet-red/5 p-4 text-sm text-pet-red">
        {state.message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <ChartPanel title="Evolucao anual" type="line" data={state.yearly} height={320} />
        <ChartPanel title="Por sexo" type="bar" data={state.bySex} height={320} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Por raca/cor" type="bar" data={state.byRaceColor} />
        <ChartPanel title="Por faixa etaria" type="bar" data={state.byAgeGroup} horizontal />
      </div>
    </div>
  );
}

function AdminDashboardMetricSkeleton() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded border border-slate-200 bg-white" />
      ))}
    </section>
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
            ? "border-pet-light bg-pet-light/15 text-pet-dark"
          : failed
            ? "border-pet-red/30 bg-pet-red/5 text-pet-red"
            : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {success ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}
      {status}
    </span>
  );
}

function HistoryTable({ history }: { history: AdminSyncHistoryResponse }) {
  const pagination = useClientPagination(history.syncJobs, ADMIN_TABLE_PAGE_SIZE);

  if (history.syncJobs.length === 0) {
    return <div className="p-4 text-sm text-slate-600">Nenhuma sincronizacao registrada.</div>;
  }

  return (
    <>
      <div className="divide-y divide-slate-100 md:hidden">
        {pagination.items.map((job) => (
          <article key={job.id} className="space-y-3 p-4">
            <div>
              <div className="font-medium text-slate-950">{job.source?.name ?? "-"}</div>
              <div className="mt-1 break-all text-xs text-slate-500">{job.source?.slug ?? "-"}</div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="mb-1 text-xs uppercase text-slate-500">Status</dt>
                <dd>
                  <JobStatus status={job.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Registros</dt>
                <dd className="mt-1 text-slate-900">{formatNumber(job.recordsImported)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Inicio</dt>
                <dd className="mt-1 text-slate-700">{formatDateTime(job.startedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Fim</dt>
                <dd className="mt-1 text-slate-700">{formatDateTime(job.finishedAt)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase text-slate-500">Origem</dt>
                <dd className="mt-1 text-slate-700">{job.requestedBy ?? "-"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase text-slate-500">Erro</dt>
                <dd className="mt-1 text-slate-700">{job.errorMessage ?? "-"}</dd>
              </div>
            </dl>
        </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-pet-dark text-xs uppercase text-white">
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
          {pagination.items.map((job) => (
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
      <TablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={history.syncJobs.length}
        pageSize={ADMIN_TABLE_PAGE_SIZE}
        onPageChange={pagination.setPage}
      />
    </>
  );
}

function AuditTable({ auditLogs }: { auditLogs: AdminAuditLogsResponse }) {
  const pagination = useClientPagination(auditLogs.auditLogs, ADMIN_TABLE_PAGE_SIZE);

  if (auditLogs.auditLogs.length === 0) {
    return <div className="p-4 text-sm text-slate-600">Nenhum evento administrativo registrado.</div>;
  }

  return (
    <>
      <div className="divide-y divide-slate-100 md:hidden">
        {pagination.items.map((log) => (
          <article key={log.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-slate-950">{formatAuditAction(log.action)}</div>
                <div className="mt-1 text-xs text-slate-500">{formatDateTime(log.createdAt)}</div>
              </div>
              <JobStatus status={log.status} />
            </div>
            <dl className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase text-slate-500">Origem</dt>
                <dd className="mt-1 text-slate-700">{log.ipAddress ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">User-Agent</dt>
                <dd className="mt-1 break-words text-slate-700">{log.userAgent ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Detalhes</dt>
                <dd className="mt-1 text-slate-700">{formatAuditMetadata(log.metadata)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-pet-dark text-xs uppercase text-white">
          <tr>
            <th className="px-4 py-3 font-semibold">Data</th>
            <th className="px-4 py-3 font-semibold">Acao</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Origem</th>
            <th className="px-4 py-3 font-semibold">User-Agent</th>
            <th className="px-4 py-3 font-semibold">Detalhes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pagination.items.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3 text-slate-700">{formatDateTime(log.createdAt)}</td>
              <td className="px-4 py-3 text-slate-950">{formatAuditAction(log.action)}</td>
              <td className="px-4 py-3">
                <JobStatus status={log.status} />
              </td>
              <td className="px-4 py-3 text-slate-700">{log.ipAddress ?? "-"}</td>
              <td className="max-w-md px-4 py-3 text-slate-700">{log.userAgent ?? "-"}</td>
              <td className="max-w-lg px-4 py-3 text-slate-700">
                {formatAuditMetadata(log.metadata)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <TablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={auditLogs.auditLogs.length}
        pageSize={ADMIN_TABLE_PAGE_SIZE}
        onPageChange={pagination.setPage}
      />
    </>
  );
}

function useClientPagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + pageSize),
    setPage
  };
}

function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const firstItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(totalItems, page * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        {firstItem}-{lastItem} de {formatNumber(totalItems)} registros
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <button
          type="button"
          aria-label="Pagina anterior"
          title="Pagina anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <span className="min-w-20 text-center text-sm text-slate-600 sm:min-w-24">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          aria-label="Proxima pagina"
          title="Proxima pagina"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function StatusMessages({
  actionState
}: {
  actionState: {
    busyAction: string | null;
    message: string | null;
    error: string | null;
  };
}) {
  return (
    <>
      {actionState.message ? (
        <div className="border-t border-pet-mid/30 bg-pet-light/15 px-4 py-3 text-sm text-pet-dark">
          {actionState.message}
        </div>
      ) : null}
      {actionState.error ? (
        <div className="border-t border-pet-red/30 bg-pet-red/5 px-4 py-3 text-sm text-pet-red">
          {actionState.error}
        </div>
      ) : null}
    </>
  );
}

function formatAuditAction(action: string) {
  const labels: Record<string, string> = {
    admin_login: "Login",
    admin_logout: "Logout",
    admin_request_blocked: "Bloqueio",
    admin_export_csv: "Exportacao CSV",
    admin_export_dashboard: "Exportacao Dashboard",
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

  if (typeof metadata.reason === "string") {
    return metadata.reason;
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
