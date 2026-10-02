"use client";

import Link from "next/link";
import { Activity, CheckCircle2, Clock3, Database, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { getDashboardOverview, getSources } from "@/lib/api";
import { formatDateTime, formatNumber, formatYearRange } from "@/lib/format";
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
      <div className="rounded border border-pet-red bg-pet-red/5 p-4 text-sm text-pet-red">
        API indisponivel: {state.message}
      </div>
    );
  }

  const { overview, sources } = state;
  const casesBySlug = new Map(overview.casesBySource.map((item) => [item.slug, item]));

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
          detail="Normalizados"
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
          detail="Aguardando validacao"
          icon={Clock3}
          tone="amber"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <ChartPanel
          title="Evolucao anual"
          note={`Soma dos casos das ${overview.summary.casesSourceCount} doenças. Veja cada doença na sua página.`}
          type="line"
          data={overview.charts.yearlyEvolution}
          height={340}
        />
        <section className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-950">Atualizacao</h2>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Ultima sincronizacao</p>
              <p className="mt-1 text-sm font-medium text-slate-950">
                {formatDateTime(overview.summary.lastUpdate)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Status</p>
              <p className="mt-1 text-sm font-medium text-slate-950">{overview.summary.dataStatus}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Os dados exibidos foram coletados do DATASUS/TABNET e filtrados para Parnaiba - PI.
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
            const pageLabel = source.active ? "Abrir pagina" : "Em validacao";

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
                      className="font-medium text-institutional-600 hover:text-institutional-800"
                    >
                      {pageLabel}
                    </Link>
                  ) : (
                    <span className="text-slate-400">Indisponivel</span>
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
                <th className="px-4 py-3 font-semibold">Pagina</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.sources.map((source) => {
                const pageHref = sourcePages[source.slug];
                const pageLabel = source.active ? "Abrir" : "Em validacao";

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
                          className="font-medium text-institutional-600 hover:text-institutional-800"
                        >
                          {pageLabel}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Indisponivel</span>
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded border border-slate-200 bg-white" />
      ))}
    </div>
  );
}
