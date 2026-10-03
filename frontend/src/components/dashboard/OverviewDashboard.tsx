"use client";

import Link from "next/link";
import { Activity, CheckCircle2, Clock3, Database, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { getDashboardOverview, getSources } from "@/lib/api";
import { formatDateTime, formatNumber, formatYearRange, formatSyncStatus } from "@/lib/format";
import type { DashboardOverviewResponse, SourcesResponse } from "@/types/api";
import { ChartPanel } from "./ChartPanel";
import { MetricCard } from "../ui/MetricCard";
import { StatusPill } from "../ui/StatusPill";

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; sources: SourcesResponse; overview: DashboardOverviewResponse }
  | { status: "error"; message: string };

const sourcePages: Record<string, string> = {
  tuberculose_sinan: "/tuberculose",
  hanseniase_sinan: "/hanseniase",
  sifilis_congenita_sinan: "/sifilis",
  dengue_sinan: "/dengue",
  zika_sinan: "/zika",
  chikungunya_sinan: "/chikungunya",
  arboviroses_sinan: "/arboviroses",
  sifilis_gestacional_sinan: "/sifilis-gestacional"
};

export function OverviewDashboard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    Promise.all([getSources(), getDashboardOverview()])
      .then(([sources, overview]) => {
        if (active) {
          setState({ status: "loaded", sources, overview });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Falha ao carregar API."
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return <LoadingPanel />;
  }

  if (state.status === "error") {
    return (
      <div className="rounded border border-pet-red bg-pet-red/5 p-4 text-sm text-pet-red-text">
        API indisponível: {state.message}
      </div>
    );
  }

  const { overview, sources } = state;
  const casesBySlug = new Map(overview.casesBySource.map((item) => [item.slug, item]));

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
        <MetricCard
          label="Casos"
          value={formatNumber(overview.summary.totalCases)}
          detail={`Soma de ${overview.summary.casesSourceCount} doenças`}
          icon={Activity}
          tone="green"
        />
        <MetricCard
          label="Registros"
          value={formatNumber(overview.summary.totalRecords)}
          detail="No banco de dados"
          icon={Database}
          tone="blue"
        />
        <MetricCard
          label="Fontes"
          value={overview.summary.totalSources}
          detail="Permitidas"
          icon={Layers}
        />
        <MetricCard
          label="Validadas"
          value={overview.summary.sourcesWithMunicipalData}
          detail="Com filtro municipal"
          icon={CheckCircle2}
          tone="green"
        />
        <MetricCard
          label="Pendentes"
          value={overview.summary.sourcesPendingValidation}
          detail="Aguardando validação"
          icon={Clock3}
          tone="amber"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <ChartPanel
          title="Evolução anual"
          note={`Soma dos casos das ${overview.summary.casesSourceCount} doenças. Veja cada doença na sua página.`}
          type="line"
          data={overview.charts.yearlyEvolution}
          height={340}
        />
        <section className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-950">Atualização</h2>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Última sincronização</p>
              <p className="mt-1 text-sm font-medium text-slate-950">
                {formatDateTime(overview.summary.lastUpdate)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Status</p>
              <p className="mt-1 text-sm font-medium text-slate-950">{formatSyncStatus(overview.summary.dataStatus)}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Os dados exibidos foram coletados do DATASUS/TABNET e filtrados para Parnaíba - PI.
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-950">Fontes permitidas</h2>
        </div>
        <div className="divide-y divide-slate-100 md:hidden">
          {sources.sources.map((source) => {
            const pageHref = sourcePages[source.slug];
            const pageLabel = source.active ? "Abrir página" : "Em validação";

            return (
              <div key={source.slug} className="space-y-3 p-4">
                <div>
                  <div className="font-medium text-slate-950">{source.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{source.system}</div>
                </div>
                <div className="text-sm text-slate-700">
                  {formatNumber(casesBySlug.get(source.slug)?.totalCases)} casos ·{" "}
                  {formatYearRange(
                    casesBySlug.get(source.slug)?.firstYear ?? null,
                    casesBySlug.get(source.slug)?.lastYear ?? null
                  )}
                </div>
                <StatusPill status={source.municipalityFilterStatus} />
                <div className="text-sm">
                  {pageHref ? (
                    <Link
                      href={pageHref}
                      className="inline-flex h-10 items-center rounded border border-slate-300 px-3 font-medium text-institutional-600 hover:bg-slate-50 hover:text-institutional-800"
                    >
                      {pageLabel}
                    </Link>
                  ) : (
                    <span className="text-slate-400">Indisponível</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-pet-dark text-xs uppercase text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Fonte</th>
                <th className="px-4 py-3 font-semibold">Sistema</th>
                <th className="px-4 py-3 font-semibold">Casos</th>
                <th className="px-4 py-3 font-semibold">Período</th>
                <th className="px-4 py-3 font-semibold">Status municipal</th>
                <th className="px-4 py-3 font-semibold">Página</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.sources.map((source) => {
                const pageHref = sourcePages[source.slug];
                const pageLabel = source.active ? "Abrir" : "Em validação";

                return (
                  <tr key={source.slug} className="hover:bg-pet-light/10">
                    <td className="px-4 py-3 font-medium text-slate-950">{source.name}</td>
                    <td className="px-4 py-3 text-slate-700">{source.system}</td>
                    <td className="px-4 py-3 text-slate-900">
                      {formatNumber(casesBySlug.get(source.slug)?.totalCases)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatYearRange(
                        casesBySlug.get(source.slug)?.firstYear ?? null,
                        casesBySlug.get(source.slug)?.lastYear ?? null
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={source.municipalityFilterStatus} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {pageHref ? (
                        <Link
                          href={pageHref}
                          className="-mx-2 inline-flex h-8 items-center rounded px-2 font-medium text-institutional-600 hover:bg-slate-50 hover:text-institutional-800"
                        >
                          {pageLabel}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Indisponível</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded border border-slate-200 bg-white" />
      ))}
    </div>
  );
}
