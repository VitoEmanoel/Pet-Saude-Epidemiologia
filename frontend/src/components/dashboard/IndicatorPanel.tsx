"use client";

import { Download, Gauge, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { getIndicators } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { Indicator, IndicatorPoint, IndicatorsResponse } from "@/types/api";
import { ChartPanel } from "./ChartPanel";

const STATUS_TEXT: Record<IndicatorPoint["status"], string> = {
  ok: "",
  sem_populacao: "sem população cadastrada",
  nao_se_aplica: "não se aplica (classificação antiga, antes de 2014)",
  sem_dados: "sem dados"
};

function formatIndicatorValue(indicator: Indicator, value: number) {
  const digits = indicator.unit === "casos" ? 0 : 2;
  const text = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  return indicator.unit === "%" ? `${text}%` : text;
}

/**
 * Painel "Indicadores" (A6): escolhe o indicador, mostra o valor do ano, a série e como é calculado.
 * Só aparece nas fontes que têm indicadores (dengue, zika e chikungunya). `onDownload` existe só no admin.
 */
export function IndicatorPanel({
  source,
  selectedYear,
  hasDemographicFilter = false,
  onDownload
}: {
  source: string;
  selectedYear?: number;
  hasDemographicFilter?: boolean;
  onDownload?: () => Promise<void>;
}) {
  const [data, setData] = useState<IndicatorsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);

    getIndicators(source)
      .then((response) => active && setData(response))
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Falha ao carregar indicadores."));

    return () => {
      active = false;
    };
  }, [source]);

  if (error) {
    return <div className="rounded border border-pet-red bg-pet-red/5 p-4 text-sm text-pet-red-text">Indicadores indisponíveis: {error}</div>;
  }

  if (!data) {
    return <div className="h-48 animate-pulse rounded border border-slate-200 bg-white" aria-busy="true" />;
  }

  if (data.indicators.length === 0) {
    return null;
  }

  // Sem população cadastrada, abre em "casos" (a incidência ficaria vazia).
  const defaultKey = data.population.years > 0 ? "incidencia" : "casos";
  const indicator =
    data.indicators.find((item) => item.key === (selectedKey ?? defaultKey)) ?? data.indicators[0];
  const withValue = indicator.series.filter((point): point is IndicatorPoint & { value: number } => point.value !== null);
  // Destaque: o ano filtrado; sem filtro, o último ano fechado (o corrente ainda é revisado).
  const focus =
    (selectedYear ? indicator.series.find((point) => point.year === selectedYear) : undefined) ??
    withValue.filter((point) => !point.provisional).at(-1) ??
    withValue.at(-1) ??
    null;
  const missing = indicator.series.filter((point) => point.value === null);
  const missingByStatus = Object.entries(
    missing.reduce<Record<string, number[]>>((groups, point) => {
      (groups[point.status] ??= []).push(point.year);
      return groups;
    }, {})
  );
  const usesPopulation = indicator.unit.startsWith("por 100 mil");

  return (
    <section className="rounded border border-slate-200 bg-white" aria-label="Indicadores">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Gauge size={17} className="text-slate-500" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-950">Indicadores</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-xs font-medium uppercase text-slate-500">Indicador</span>
            <select
              value={indicator.key}
              onChange={(event) => setSelectedKey(event.target.value)}
              className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            >
              {data.indicators.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {onDownload ? (
            <button
              type="button"
              onClick={() => void onDownload()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded bg-institutional-600 px-3 text-sm font-medium text-white hover:bg-institutional-800"
            >
              <Download size={16} aria-hidden="true" />
              Baixar indicadores
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          <div className="rounded border border-slate-200 p-4">
            <p className="text-xs font-medium uppercase text-slate-500">
              {indicator.label} {focus ? `· ${focus.year}` : ""}
            </p>
            <p className="mt-1 text-3xl font-semibold text-pet-dark">
              {focus?.value !== null && focus?.value !== undefined ? formatIndicatorValue(indicator, focus.value) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {focus?.value !== null && focus?.value !== undefined
                ? indicator.unit
                : focus
                  ? STATUS_TEXT[focus.status]
                  : "sem dados"}
              {focus?.provisional ? " · provisório (dados do ano ainda em revisão)" : ""}
            </p>
            {focus && focus.numerator !== null && focus.denominator !== null && focus.value !== null ? (
              <p className="mt-2 text-xs text-slate-500">
                {formatNumber(focus.numerator)} ÷ {formatNumber(focus.denominator)}
              </p>
            ) : null}
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            <p className="flex gap-2">
              <Info size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
              <span>{indicator.description}</span>
            </p>
            <p className="text-xs text-slate-600">
              <strong>Cálculo:</strong> {indicator.formula}.
            </p>
            {usesPopulation ? (
              <p className="text-xs text-slate-600">
                {data.population.years > 0
                  ? `População cadastrada: ${data.population.firstYear}–${data.population.lastYear} (${data.population.years} anos).`
                  : "Nenhuma população cadastrada ainda: o administrador envia a planilha na tela População."}
              </p>
            ) : null}
            {hasDemographicFilter && indicator.key !== "casos" ? (
              <p className="text-xs text-slate-600">
                O indicador é do município todo: os filtros de sexo, faixa etária e raça/cor não se aplicam a ele.
              </p>
            ) : null}
            {missingByStatus.map(([status, years]) => (
              <p key={status} className="text-xs text-slate-500">
                Sem valor em {years.join(", ")}: {STATUS_TEXT[status as IndicatorPoint["status"]]}.
              </p>
            ))}
          </div>
        </div>
        {/* Barras: uma linha suavizada sugeriria valores entre os anos, que não existem. */}
        <ChartPanel
          title={`${indicator.label} por ano (${indicator.unit})`}
          type="bar"
          data={withValue.map((point) => ({ label: point.provisional ? `${point.year}*` : String(point.year), value: point.value }))}
          note={withValue.some((point) => point.provisional) ? "* ano corrente, provisório" : undefined}
          height={280}
        />
      </div>
    </section>
  );
}
