"use client";

import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  Filter,
  RefreshCw,
  X
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  getChartByAgeGroup,
  getChartByRaceColor,
  getChartBySex,
  getRecords,
  getSourceFilters,
  getSourceSummary,
  getYearlyEvolution
} from "@/lib/api";
import {
  AGGREGATION_LABELS,
  formatAggregation,
  formatDateTime,
  formatNumber,
  formatYearRange, formatSyncStatus, pluralize } from "@/lib/format";
import type {
  CategoryPoint,
  ChartPoint,
  RecordFilters,
  RecordsResponse,
  ResolvedAggregation,
  SourceFiltersResponse,
  SourceSummaryResponse
} from "@/types/api";
import { ignoredFiltersNote, withSingleDemographic } from "@/lib/demographics";
import { ChartPanel } from "./ChartPanel";
import { IndicatorPanel } from "./IndicatorPanel";
import { MetricCard } from "../ui/MetricCard";

const ParnaibaMap = dynamic(
  () => import("../maps/ParnaibaMap").then((module) => module.ParnaibaMap),
  { ssr: false }
);

type PageState =
  | { status: "loading" }
  | {
      status: "loaded";
      summary: SourceSummaryResponse;
      filters: SourceFiltersResponse;
    }
  | { status: "error"; message: string };

type ChartsState =
  | { status: "loading" }
  | {
      status: "loaded";
      yearly: ChartPoint[];
      bySex: CategoryPoint[];
      byAgeGroup: CategoryPoint[];
      byRaceColor: CategoryPoint[];
      notes: { bySex?: string; byAgeGroup?: string; byRaceColor?: string };
    }
  | { status: "error"; message: string };

type SelectedFilters = {
  year: string;
  sex: string;
  ageGroup: string;
  raceColor: string;
};

const RECORD_VIEWS: ResolvedAggregation[] = ["yearly", "sex", "age_group", "race_color"];

const DEMOGRAPHIC_LABELS: Record<Exclude<ResolvedAggregation, "yearly">, string> = {
  sex: "sexo",
  age_group: "faixa etária",
  race_color: "raça/cor"
};

function getDemographicView(filters: SelectedFilters): Exclude<ResolvedAggregation, "yearly"> | null {
  if (filters.sex) {
    return "sex";
  }

  if (filters.ageGroup) {
    return "age_group";
  }

  if (filters.raceColor) {
    return "race_color";
  }

  return null;
}

type DiseaseDashboardProps = {
  source: string;
  title: string;
};

export function DiseaseDashboard({ source, title }: DiseaseDashboardProps) {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [chartsState, setChartsState] = useState<ChartsState>({ status: "loading" });
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    year: "",
    sex: "",
    ageGroup: "",
    raceColor: ""
  });
  const [page, setPage] = useState(1);
  const [recordView, setRecordView] = useState<ResolvedAggregation>("yearly");
  const [recordsState, setRecordsState] = useState<
    | { status: "loading" }
    | { status: "loaded"; data: RecordsResponse }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let active = true;

    Promise.all([
      getSourceSummary(source),
      getSourceFilters(source)
    ])
      .then(([summary, filters]) => {
        if (active) {
          setState({
            status: "loaded",
            summary,
            filters
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Falha ao carregar dados."
          });
        }
      });

    return () => {
      active = false;
    };
  }, [source]);

  const activeFilters = useMemo<RecordFilters>(
    () => ({
      year: selectedFilters.year ? Number(selectedFilters.year) : undefined,
      sex: selectedFilters.sex || undefined,
      ageGroup: selectedFilters.ageGroup || undefined,
      raceColor: selectedFilters.raceColor || undefined
    }),
    [selectedFilters]
  );

  // Com filtro demográfico, a tabela mostra a visão da mesma dimensão (a API escolhe sozinha);
  // sem filtro, mostra a visão escolhida em "Detalhar por".
  const demographicView = getDemographicView(selectedFilters);
  const effectiveRecordView = demographicView ?? recordView;

  const recordFilters = useMemo<RecordFilters>(
    () => ({
      source,
      ...activeFilters,
      aggregation: demographicView ? undefined : recordView,
      page,
      pageSize: 12
    }),
    [activeFilters, demographicView, page, recordView, source]
  );

  useEffect(() => {
    let active = true;
    setChartsState({ status: "loading" });

    Promise.all([
      getYearlyEvolution(source, activeFilters),
      getChartBySex(source, activeFilters),
      getChartByAgeGroup(source, activeFilters),
      getChartByRaceColor(source, activeFilters)
    ])
      .then(([yearly, bySex, byAgeGroup, byRaceColor]) => {
        if (active) {
          setChartsState({
            status: "loaded",
            yearly: yearly.series,
            bySex: bySex.series,
            byAgeGroup: byAgeGroup.series,
            byRaceColor: byRaceColor.series,
            notes: {
              bySex: ignoredFiltersNote("sex", bySex.ignoredFilters),
              byAgeGroup: ignoredFiltersNote("ageGroup", byAgeGroup.ignoredFilters),
              byRaceColor: ignoredFiltersNote("raceColor", byRaceColor.ignoredFilters)
            }
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setChartsState({
            status: "error",
            message: error instanceof Error ? error.message : "Falha ao carregar os gráficos."
          });
        }
      });

    return () => {
      active = false;
    };
  }, [activeFilters, source]);

  useEffect(() => {
    let active = true;
    setRecordsState({ status: "loading" });

    getRecords(recordFilters)
      .then((data) => {
        if (active) {
          setRecordsState({ status: "loaded", data });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setRecordsState({
            status: "error",
            message: error instanceof Error ? error.message : "Falha ao carregar registros."
          });
        }
      });

    return () => {
      active = false;
    };
  }, [recordFilters]);

  function updateFilter(key: keyof SelectedFilters, value: string) {
    // Só um filtro demográfico por vez: o DATASUS não cruza sexo, faixa etária e raça/cor
    setSelectedFilters((current) => withSingleDemographic(current, key, value));
    setPage(1);
  }

  function clearFilters() {
    setSelectedFilters({
      year: "",
      sex: "",
      ageGroup: "",
      raceColor: ""
    });
    setRecordView("yearly");
    setPage(1);
  }

  if (state.status === "loading") {
    return <LoadingBlocks />;
  }

  if (state.status === "error") {
    return (
      <div className="rounded border border-pet-red bg-pet-red/5 p-4 text-sm text-pet-red-text">
        API indisponível: {state.message}
      </div>
    );
  }

  const sourceIsActive = state.summary.source.active;
  const isArboviroses = state.summary.source.slug === "arboviroses_sinan";
  const isSifilisGestacional = state.summary.source.slug === "sifilis_gestacional_sinan";
  const hasSelectedFilters = Object.values(selectedFilters).some(Boolean);
  const visibleYearly = chartsState.status === "loaded" ? chartsState.yearly : null;
  const visibleTotalCases = visibleYearly
    ? visibleYearly.reduce((total, point) => total + point.value, 0)
    : state.summary.summary.totalCases;
  const latestVisiblePoint = visibleYearly?.at(-1) ?? null;
  const firstVisibleYear = visibleYearly?.[0]?.year ?? state.summary.summary.firstAvailableYear;
  const lastVisibleYear = latestVisiblePoint?.year ?? state.summary.summary.lastAvailableYear;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
        <MetricCard
          label="Casos"
          value={formatNumber(visibleTotalCases)}
          detail={hasSelectedFilters ? "Filtros aplicados" : title}
          icon={Activity}
          tone="green"
        />
        <MetricCard
          label="Último ano"
          value={latestVisiblePoint?.value ?? state.summary.summary.latestYearValue ?? 0}
          detail={String(latestVisiblePoint?.year ?? state.summary.summary.latestYear ?? "")}
          icon={CalendarDays}
          tone="blue"
        />
        <MetricCard
          label="Registros"
          value={formatNumber(state.summary.summary.totalRecords)}
          detail="No banco de dados"
          icon={Database}
        />
        <MetricCard
          label="Período"
          value={formatYearRange(firstVisibleYear, lastVisibleYear)}
          detail="Anos disponíveis"
          icon={CalendarDays}
        />
        <MetricCard
          label="Atualização"
          value={formatSyncStatus(state.summary.summary.lastSyncStatus)}
          detail={formatDateTime(state.summary.summary.lastUpdate)}
          icon={RefreshCw}
          tone="amber"
        />
      </section>

      {!sourceIsActive ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {isSifilisGestacional
            ? "Esta doença ainda está em validação técnica: a fonte oficial municipal de sífilis gestacional ainda não foi localizada em um formato compatível com a coleta automática."
            : "Esta doença ainda está em validação técnica: a página acompanha a expansão do painel, mas a coleta automática ainda não está ativa."}
        </div>
      ) : !state.summary.summary.municipalityDataAvailable ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Esta fonte não disponibiliza consulta municipal para Parnaíba - PI no formato acessado pelo sistema.
        </div>
      ) : null}

      {isArboviroses ? (
        <div className="rounded border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Esta visão soma as arboviroses transmitidas pelo Aedes aegypti, todas contadas como casos
          prováveis (notificações exceto as descartadas): dengue, zika e chikungunya.
        </div>
      ) : null}

      {state.summary.summary.lastSyncStatus && state.summary.summary.lastSyncStatus !== "SUCCESS" ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Não foi possível atualizar esta fonte no momento. Os dados exibidos são da última coleta feita com sucesso.
        </div>
      ) : null}

      <section className="rounded border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter size={17} className="text-slate-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-950">Filtros do painel</h2>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasSelectedFilters}
            className="inline-flex h-9 items-center justify-center gap-2 rounded border border-pet-orange-text px-3 text-sm font-medium text-pet-orange-text hover:bg-pet-orange-text hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={16} aria-hidden="true" />
            Limpar
          </button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label="Ano"
            value={selectedFilters.year}
            onChange={(value) => updateFilter("year", value)}
            options={state.filters.filters.years.map(String)}
          />
          <FilterSelect
            label="Sexo"
            value={selectedFilters.sex}
            onChange={(value) => updateFilter("sex", value)}
            options={state.filters.filters.sex}
          />
          <FilterSelect
            label="Faixa etária"
            value={selectedFilters.ageGroup}
            onChange={(value) => updateFilter("ageGroup", value)}
            options={state.filters.filters.ageGroups}
          />
          <FilterSelect
            label="Raça/cor"
            value={selectedFilters.raceColor}
            onChange={(value) => updateFilter("raceColor", value)}
            options={state.filters.filters.raceColors}
          />
        </div>
      </section>

      <IndicatorPanel
        source={source}
        selectedYear={activeFilters.year}
        hasDemographicFilter={demographicView !== null}
      />

      <DashboardCharts state={chartsState} />

      <section className="rounded border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter size={17} className="text-slate-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-950">Registros</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span className="whitespace-nowrap text-xs font-medium uppercase text-slate-500">Detalhar por</span>
            <select
              value={effectiveRecordView}
              disabled={demographicView !== null}
              onChange={(event) => {
                setRecordView(event.target.value as ResolvedAggregation);
                setPage(1);
              }}
              className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {RECORD_VIEWS.map((view) => (
                <option key={view} value={view}>
                  {AGGREGATION_LABELS[view]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
          {demographicView
            ? `Com o filtro de ${DEMOGRAPHIC_LABELS[demographicView]}, a tabela mostra os casos por ${DEMOGRAPHIC_LABELS[demographicView]}.`
            : "Total do ano, por sexo, por faixa etária e por raça/cor são visões diferentes dos mesmos casos. A tabela mostra uma visão por vez, para que a soma dos valores corresponda ao total."}
        </p>

        <RecordsTable state={recordsState} page={page} setPage={setPage} />
      </section>
    </div>
  );
}

export function TuberculosisDashboard() {
  return <DiseaseDashboard source="tuberculose_sinan" title="Tuberculose" />;
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
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

function DashboardCharts({ state }: { state: ChartsState }) {
  if (state.status === "loading") {
    return <ChartLoadingBlocks />;
  }

  if (state.status === "error") {
    return (
      <div className="rounded border border-pet-red bg-pet-red/5 p-4 text-sm text-pet-red-text">
        {state.message}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
        <ChartPanel title="Evolução anual" type="line" data={state.yearly} height={340} />
        <ParnaibaMap />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ChartPanel title="Por sexo" type="bar" data={state.bySex} note={state.notes.bySex} />
        <ChartPanel title="Por raça/cor" type="bar" data={state.byRaceColor} note={state.notes.byRaceColor} />
        <ChartPanel
          title="Por faixa etária"
          type="bar"
          data={state.byAgeGroup}
          horizontal
          note={state.notes.byAgeGroup}
        />
      </div>
    </>
  );
}

function RecordsTable({
  state,
  page,
  setPage
}: {
  state:
    | { status: "loading" }
    | { status: "loaded"; data: RecordsResponse }
    | { status: "error"; message: string };
  page: number;
  setPage: (page: number) => void;
}) {
  if (state.status === "loading") {
    return <div className="h-80 animate-pulse bg-slate-50" />;
  }

  if (state.status === "error") {
    return <div className="border-l-4 border-pet-red bg-pet-red/5 p-4 text-sm text-pet-red-text">{state.message}</div>;
  }

  return (
    <>
      {state.data.records.length === 0 ? (
        <div className="p-4 text-sm text-slate-600">Nenhum registro encontrado para os filtros.</div>
      ) : null}
      <div className="divide-y divide-slate-100 md:hidden">
        {state.data.records.map((record) => (
          <article key={record.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-slate-950">{record.diseaseOrCondition ?? "-"}</div>
                <div className="mt-1 text-xs text-slate-500">Ano {record.year ?? "-"}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase text-slate-500">Valor</div>
                <div className="font-semibold text-slate-950">{formatNumber(record.value)}</div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase text-slate-500">Sexo</dt>
                <dd className="mt-1 text-slate-700">{record.sex ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Raça/cor</dt>
                <dd className="mt-1 text-slate-700">{record.raceColor ?? "-"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase text-slate-500">Faixa etária</dt>
                <dd className="mt-1 text-slate-700">{record.ageGroup ?? "-"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase text-slate-500">Visão</dt>
                <dd className="mt-1 text-slate-700">{formatAggregation(record.aggregation)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-pet-dark text-xs uppercase text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">Ano</th>
              <th className="px-4 py-3 font-semibold">Condição</th>
              <th className="px-4 py-3 font-semibold">Valor</th>
              <th className="px-4 py-3 font-semibold">Sexo</th>
              <th className="px-4 py-3 font-semibold">Faixa etária</th>
              <th className="px-4 py-3 font-semibold">Raça/cor</th>
              <th className="px-4 py-3 font-semibold">Visão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.data.records.map((record) => (
              <tr key={record.id} className="hover:bg-pet-light/10">
                <td className="px-4 py-3 text-slate-900">{record.year}</td>
                <td className="px-4 py-3 font-medium text-slate-950">{record.diseaseOrCondition}</td>
                <td className="px-4 py-3 text-slate-900">{formatNumber(record.value)}</td>
                <td className="px-4 py-3 text-slate-700">{record.sex ?? "-"}</td>
                <td className="px-4 py-3 text-slate-700">{record.ageGroup ?? "-"}</td>
                <td className="px-4 py-3 text-slate-700">{record.raceColor ?? "-"}</td>
                <td className="px-4 py-3 text-slate-700">{formatAggregation(record.aggregation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {pluralize(state.data.pagination.total, "registro", "registros")}
        </p>
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <button
            type="button"
            aria-label="Página anterior"
            title="Página anterior"
            disabled={page <= 1}
            onClick={() => setPage(Math.max(1, page - 1))}
            className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <span className="min-w-20 text-center text-sm text-slate-600 sm:min-w-24">
            {state.data.pagination.page}/{Math.max(1, state.data.pagination.totalPages)}
          </span>
          <button
            type="button"
            aria-label="Próxima página"
            title="Próxima página"
            disabled={page >= state.data.pagination.totalPages}
            onClick={() => setPage(Math.min(Math.max(1, state.data.pagination.totalPages), page + 1))}
            className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}

function ChartLoadingBlocks() {
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
        <div className="h-[390px] animate-pulse rounded border border-slate-200 bg-white" />
        <div className="h-[390px] animate-pulse rounded border border-slate-200 bg-white" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-[350px] animate-pulse rounded border border-slate-200 bg-white" />
        ))}
      </div>
    </>
  );
}

function LoadingBlocks() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded border border-slate-200 bg-white" />
    </div>
  );
}
