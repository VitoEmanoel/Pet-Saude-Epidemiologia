"use client";

import { Activity, CalendarDays, Database, Download, FileText, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  downloadAdminDashboardHtml,
  downloadAdminIndicatorsCsv,
  downloadAdminRecordsCsv,
  getChartByAgeGroup,
  getChartByRaceColor,
  getChartBySex,
  getSourceFilters,
  getSourceSummary,
  getYearlyEvolution
} from "@/lib/api";
import { ignoredFiltersNote, withSingleDemographic } from "@/lib/demographics";
import { formatDateTime, formatNumber, formatYearRange } from "@/lib/format";
import type { CategoryPoint, ChartPoint, DataSource, RecordFilters, SourceFiltersResponse, SourceSummaryResponse } from "@/types/api";
import { ChartPanel } from "../dashboard/ChartPanel";
import { IndicatorPanel } from "../dashboard/IndicatorPanel";
import { MetricCard } from "../ui/MetricCard";
import { useAdminSession } from "./AdminSession";
import {
  ActionButton,
  ErrorBox,
  IDLE_ACTION,
  Panel,
  SelectField,
  StatusMessages,
  downloadBlob,
  errorMessage,
  type ActionState
} from "./admin-ui";

type FilterValues = { year: string; sex: string; ageGroup: string; raceColor: string };

const EMPTY_FILTERS: FilterValues = { year: "", sex: "", ageGroup: "", raceColor: "" };

type SourceState =
  | { status: "loading" }
  | { status: "loaded"; summary: SourceSummaryResponse; filters: SourceFiltersResponse }
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

type DownloadKind = "csv" | "html";

/** Dashboard de uma fonte com filtros; os botões de download baixam exatamente o que está filtrado. */
export function AdminSourceDashboard({ sources }: { sources: DataSource[] }) {
  const { handleAuthError } = useAdminSession();
  const [sourceSlug, setSourceSlug] = useState(sources[0]?.slug ?? "");
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [sourceState, setSourceState] = useState<SourceState>({ status: "loading" });
  const [chartsState, setChartsState] = useState<ChartsState>({ status: "loading" });
  const [actionState, setActionState] = useState<ActionState>(IDLE_ACTION);

  const activeFilters = useMemo<RecordFilters>(
    () => ({
      year: filters.year ? Number(filters.year) : undefined,
      sex: filters.sex || undefined,
      ageGroup: filters.ageGroup || undefined,
      raceColor: filters.raceColor || undefined
    }),
    [filters]
  );

  useEffect(() => {
    if (!sourceSlug) {
      return;
    }

    let active = true;
    setSourceState({ status: "loading" });

    Promise.all([getSourceSummary(sourceSlug), getSourceFilters(sourceSlug)])
      .then(([summary, sourceFilters]) => {
        if (active) {
          setSourceState({ status: "loaded", summary, filters: sourceFilters });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSourceState({ status: "error", message: errorMessage(error, "Falha ao carregar a fonte.") });
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
          setChartsState({ status: "error", message: errorMessage(error, "Falha ao carregar os gráficos.") });
        }
      });

    return () => {
      active = false;
    };
  }, [activeFilters, sourceSlug]);

  async function download(kind: DownloadKind) {
    setActionState({ ...IDLE_ACTION, busyAction: kind });

    try {
      const query = { source: sourceSlug, ...activeFilters };
      const { blob, filename } =
        kind === "html" ? await downloadAdminDashboardHtml(query) : await downloadAdminRecordsCsv(query);
      downloadBlob(blob, filename);
      setActionState({
        ...IDLE_ACTION,
        message: kind === "html" ? "Dashboard baixado." : "Tabela CSV baixada."
      });
    } catch (error) {
      if (!handleAuthError(error)) {
        setActionState({ ...IDLE_ACTION, error: errorMessage(error, "Falha ao baixar o arquivo.") });
      }
    }
  }

  const hasFilters = Object.values(filters).some(Boolean);
  const available = sourceState.status === "loaded" ? sourceState.filters.filters : null;
  const summary = sourceState.status === "loaded" ? sourceState.summary.summary : null;
  const yearly = chartsState.status === "loaded" ? chartsState.yearly : null;
  const totalCases = yearly?.reduce((total, point) => total + point.value, 0) ?? summary?.totalCases ?? 0;
  const latestPoint = yearly ? yearly[yearly.length - 1] : null;
  const selectedSource = sources.find((source) => source.slug === sourceSlug) ?? null;
  const busy = actionState.busyAction !== null;

  return (
    <div className="space-y-5">
      <Panel
        title="Dashboard da fonte"
        icon={Activity}
        actions={
          <>
            <ActionButton icon={X} onClick={() => setFilters(EMPTY_FILTERS)} disabled={!hasFilters}>
              Limpar
            </ActionButton>
            <ActionButton
              variant="blue"
              icon={Download}
              onClick={() => void download("csv")}
              disabled={busy || sourceState.status !== "loaded"}
              title="Baixa os registros da fonte com os filtros escolhidos"
            >
              Baixar CSV
            </ActionButton>
            <ActionButton
              variant="blue"
              icon={FileText}
              onClick={() => void download("html")}
              disabled={busy || sourceState.status !== "loaded"}
              title="Baixa este dashboard (indicadores e gráficos) em um arquivo HTML"
            >
              Baixar dashboard
            </ActionButton>
          </>
        }
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <SelectField
            label="Fonte"
            value={sourceSlug}
            onChange={(value) => {
              setSourceSlug(value);
              setFilters(EMPTY_FILTERS);
            }}
            disabled={sources.length === 0}
          >
            {sources.map((source) => (
              <option key={source.slug} value={source.slug}>
                {source.name}
              </option>
            ))}
          </SelectField>
          <FilterSelect label="Ano" value={filters.year} options={(available?.years ?? []).map(String)} disabled={!available} onChange={(value) => setFilters((current) => ({ ...current, year: value }))} />
          <FilterSelect label="Sexo" value={filters.sex} options={available?.sex ?? []} disabled={!available} onChange={(value) => setFilters((current) => withSingleDemographic(current, "sex", value))} />
          <FilterSelect label="Faixa etária" value={filters.ageGroup} options={available?.ageGroups ?? []} disabled={!available} onChange={(value) => setFilters((current) => withSingleDemographic(current, "ageGroup", value))} />
          <FilterSelect label="Raça/cor" value={filters.raceColor} options={available?.raceColors ?? []} disabled={!available} onChange={(value) => setFilters((current) => withSingleDemographic(current, "raceColor", value))} />
        </div>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          Os arquivos baixados seguem os filtros acima. O DATASUS não cruza sexo, faixa etária e raça/cor: escolha um por vez.
        </p>
        {sourceState.status === "error" ? (
          <div className="border-t border-pet-red-text px-4 py-3 text-sm font-medium text-pet-red-text">{sourceState.message}</div>
        ) : null}
        <StatusMessages actionState={actionState} />
      </Panel>

      {summary ? (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
          <MetricCard label="Casos" value={formatNumber(totalCases)} detail={hasFilters ? "Com os filtros" : selectedSource?.name ?? "Fonte"} icon={Activity} tone="green" />
          <MetricCard label="Último ano" value={formatNumber(latestPoint?.value ?? summary.latestYearValue ?? 0)} detail={String(latestPoint?.year ?? summary.latestYear ?? "")} icon={CalendarDays} tone="blue" />
          <MetricCard label="Linhas no banco" value={formatNumber(summary.totalRecords)} detail="Total da fonte, sem filtros" icon={Database} />
          <MetricCard label="Período" value={formatYearRange(yearly?.[0]?.year ?? summary.firstAvailableYear, latestPoint?.year ?? summary.lastAvailableYear)} detail="Anos disponíveis" icon={CalendarDays} />
          <MetricCard label="Atualização" value={summary.lastSyncStatus === "SUCCESS" ? "Sucesso" : summary.lastSyncStatus ?? "Sem status"} detail={formatDateTime(summary.lastUpdate)} icon={RefreshCw} tone="amber" />
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded border border-slate-200 bg-white" />
          ))}
        </section>
      )}

      <IndicatorPanel
        source={sourceSlug}
        selectedYear={activeFilters.year}
        hasDemographicFilter={Boolean(filters.sex || filters.ageGroup || filters.raceColor)}
        onDownload={async () => {
          try {
            const { blob, filename } = await downloadAdminIndicatorsCsv(sourceSlug);
            downloadBlob(blob, filename);
          } catch (error) {
            if (!handleAuthError(error)) {
              setActionState({ ...IDLE_ACTION, error: errorMessage(error, "Falha ao baixar os indicadores.") });
            }
          }
        }}
      />

      {chartsState.status === "loading" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[340px] animate-pulse rounded border border-slate-200 bg-white" />
          ))}
        </div>
      ) : chartsState.status === "error" ? (
        <ErrorBox message={chartsState.message} />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <ChartPanel title="Evolução anual" type="line" data={chartsState.yearly} height={320} />
            <ChartPanel title="Por sexo" type="bar" data={chartsState.bySex} height={320} note={chartsState.notes.bySex} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <ChartPanel title="Por raça/cor" type="bar" data={chartsState.byRaceColor} note={chartsState.notes.byRaceColor} />
            <ChartPanel title="Por faixa etária" type="bar" data={chartsState.byAgeGroup} horizontal note={chartsState.notes.byAgeGroup} />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <SelectField label={label} value={value} onChange={onChange} disabled={disabled}>
      <option value="">Todos</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </SelectField>
  );
}
