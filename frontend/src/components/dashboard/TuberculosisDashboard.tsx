"use client";

import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  Filter,
  RefreshCw
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
import { formatDateTime, formatNumber, formatYearRange } from "@/lib/format";
import type {
  CategoryPoint,
  ChartPoint,
  RecordsResponse,
  SourceFiltersResponse,
  SourceSummaryResponse
} from "@/types/api";
import { ChartPanel } from "./ChartPanel";
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
      yearly: ChartPoint[];
      bySex: CategoryPoint[];
      byAgeGroup: CategoryPoint[];
      byRaceColor: CategoryPoint[];
    }
  | { status: "error"; message: string };

type SelectedFilters = {
  year: string;
  sex: string;
  ageGroup: string;
  raceColor: string;
};

type DiseaseDashboardProps = {
  source: string;
  title: string;
};

export function DiseaseDashboard({ source, title }: DiseaseDashboardProps) {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    year: "",
    sex: "",
    ageGroup: "",
    raceColor: ""
  });
  const [page, setPage] = useState(1);
  const [recordsState, setRecordsState] = useState<
    | { status: "loading" }
    | { status: "loaded"; data: RecordsResponse }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let active = true;

    Promise.all([
      getSourceSummary(source),
      getSourceFilters(source),
      getYearlyEvolution(source),
      getChartBySex(source),
      getChartByAgeGroup(source),
      getChartByRaceColor(source)
    ])
      .then(([summary, filters, yearly, bySex, byAgeGroup, byRaceColor]) => {
        if (active) {
          setState({
            status: "loaded",
            summary,
            filters,
            yearly: yearly.series,
            bySex: bySex.series,
            byAgeGroup: byAgeGroup.series,
            byRaceColor: byRaceColor.series
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

  const recordFilters = useMemo(
    () => ({
      source,
      year: selectedFilters.year ? Number(selectedFilters.year) : undefined,
      sex: selectedFilters.sex || undefined,
      ageGroup: selectedFilters.ageGroup || undefined,
      raceColor: selectedFilters.raceColor || undefined,
      page,
      pageSize: 12
    }),
    [page, selectedFilters, source]
  );

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
    setSelectedFilters((current) => ({
      ...current,
      [key]: value
    }));
    setPage(1);
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

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Casos"
          value={formatNumber(state.summary.summary.totalCases)}
          detail={title}
          icon={Activity}
          tone="green"
        />
        <MetricCard
          label="Ultimo ano"
          value={state.summary.summary.latestYearValue ?? 0}
          detail={String(state.summary.summary.latestYear ?? "")}
          icon={CalendarDays}
          tone="blue"
        />
        <MetricCard
          label="Registros"
          value={formatNumber(state.summary.summary.totalRecords)}
          detail="Normalizados"
          icon={Database}
        />
        <MetricCard
          label="Periodo"
          value={formatYearRange(
            state.summary.summary.firstAvailableYear,
            state.summary.summary.lastAvailableYear
          )}
          detail="Anos disponiveis"
          icon={CalendarDays}
        />
        <MetricCard
          label="Atualizacao"
          value={state.summary.summary.lastSyncStatus ?? "Sem status"}
          detail={formatDateTime(state.summary.summary.lastUpdate)}
          icon={RefreshCw}
          tone="amber"
        />
      </section>

      {!state.summary.summary.municipalityDataAvailable ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Esta fonte nao disponibiliza consulta municipal para Parnaiba - PI no formato acessado pelo sistema.
        </div>
      ) : null}

      {state.summary.summary.lastSyncStatus && state.summary.summary.lastSyncStatus !== "SUCCESS" ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nao foi possivel atualizar esta fonte no momento. Os dados exibidos correspondem a ultima coleta realizada com sucesso.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
        <ChartPanel title="Evolucao anual" type="line" data={state.yearly} height={340} />
        <ParnaibaMap />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ChartPanel title="Por sexo" type="bar" data={state.bySex} />
        <ChartPanel title="Por raca/cor" type="bar" data={state.byRaceColor} />
        <ChartPanel title="Por faixa etaria" type="bar" data={state.byAgeGroup} horizontal />
      </div>

      <section className="rounded border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter size={17} className="text-slate-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-950">Registros</h2>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-4">
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
            label="Faixa etaria"
            value={selectedFilters.ageGroup}
            onChange={(value) => updateFilter("ageGroup", value)}
            options={state.filters.filters.ageGroups}
          />
          <FilterSelect
            label="Raca/cor"
            value={selectedFilters.raceColor}
            onChange={(value) => updateFilter("raceColor", value)}
            options={state.filters.filters.raceColors}
          />
        </div>

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
    return <div className="p-4 text-sm text-amber-800">{state.message}</div>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Ano</th>
              <th className="px-4 py-3 font-semibold">Condicao</th>
              <th className="px-4 py-3 font-semibold">Valor</th>
              <th className="px-4 py-3 font-semibold">Sexo</th>
              <th className="px-4 py-3 font-semibold">Faixa etaria</th>
              <th className="px-4 py-3 font-semibold">Raca/cor</th>
              <th className="px-4 py-3 font-semibold">Tabela</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.data.records.map((record) => (
              <tr key={record.id}>
                <td className="px-4 py-3 text-slate-900">{record.year}</td>
                <td className="px-4 py-3 font-medium text-slate-950">{record.diseaseOrCondition}</td>
                <td className="px-4 py-3 text-slate-900">{formatNumber(record.value)}</td>
                <td className="px-4 py-3 text-slate-700">{record.sex ?? "-"}</td>
                <td className="px-4 py-3 text-slate-700">{record.ageGroup ?? "-"}</td>
                <td className="px-4 py-3 text-slate-700">{record.raceColor ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{record.sourceTable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {formatNumber(state.data.pagination.total)} registros
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Pagina anterior"
            title="Pagina anterior"
            disabled={page <= 1}
            onClick={() => setPage(Math.max(1, page - 1))}
            className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <span className="min-w-24 text-center text-sm text-slate-600">
            {state.data.pagination.page}/{state.data.pagination.totalPages}
          </span>
          <button
            type="button"
            aria-label="Proxima pagina"
            title="Proxima pagina"
            disabled={page >= state.data.pagination.totalPages}
            onClick={() => setPage(Math.min(state.data.pagination.totalPages, page + 1))}
            className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}

function LoadingBlocks() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded border border-slate-200 bg-white" />
    </div>
  );
}
