import { AlertTriangle, CalendarClock, Database, ExternalLink } from "lucide-react";
import { formatDateTime, formatYearRange } from "@/lib/format";
import type { DataSource, SourceSummaryResponse } from "@/types/api";

// O agendador atualiza a cada 30 dias; acima disto (com folga) os dados são considerados desatualizados.
export const STALE_AFTER_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(value: string | null, now = Date.now()) {
  return value ? Math.max(0, Math.floor((now - new Date(value).getTime()) / DAY_MS)) : null;
}

function agoText(days: number) {
  return days === 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`;
}

/** Link público da consulta no TABNET (formulário, em HTTPS). */
function tabnetUrl(sourceUrl: string | null) {
  return sourceUrl ? sourceUrl.replace(/^http:\/\/tabnet\.datasus\.gov\.br/, "https://tabnet.datasus.gov.br") : null;
}

/**
 * Transparência (7.3): de onde vêm os números, período, quando o painel foi atualizado e se os
 * dados estão desatualizados. Fica logo abaixo dos cartões de cada doença.
 */
export function SourceTransparency({
  source,
  summary
}: {
  source: DataSource;
  summary: SourceSummaryResponse["summary"];
}) {
  const days = daysSince(summary.lastUpdate);
  const stale = days === null || days > STALE_AFTER_DAYS;
  const url = tabnetUrl(source.sourceUrl);
  const currentYear = new Date().getFullYear();

  return (
    <section aria-labelledby="sobre-os-dados" className="rounded border border-slate-200 bg-white">
      <h2 id="sobre-os-dados" className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950">
        Sobre estes dados
      </h2>
      <dl className="grid gap-4 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase text-slate-500">
            <CalendarClock size={14} aria-hidden="true" /> Atualizado no painel
          </dt>
          <dd className="mt-1 text-base font-semibold text-slate-950">
            {summary.lastUpdate ? formatDateTime(summary.lastUpdate) : "Ainda não atualizado"}
          </dd>
          {days !== null ? <dd className="text-xs text-slate-600">{agoText(days)}</dd> : null}
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Período disponível</dt>
          <dd className="mt-1 text-base font-semibold text-slate-950">
            {formatYearRange(summary.firstAvailableYear, summary.lastAvailableYear)}
          </dd>
          <dd className="text-xs text-slate-600">
            {summary.lastAvailableYear === currentYear
              ? `${currentYear} ainda é revisado pelo DATASUS e pode mudar`
              : "Anos fechados"}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase text-slate-500">
            <Database size={14} aria-hidden="true" /> Fonte oficial
          </dt>
          <dd className="mt-1 text-slate-950">
            {source.system} · DATASUS/TABNET, residentes em Parnaíba - PI
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Conferir na origem</dt>
          <dd className="mt-1">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center gap-1.5 font-medium text-institutional-600 underline-offset-2 hover:underline"
              >
                Abrir a consulta no TABNET
                <ExternalLink size={14} aria-hidden="true" />
                <span className="sr-only">(abre em outra aba)</span>
              </a>
            ) : (
              <span className="text-slate-600">Sem consulta pública</span>
            )}
          </dd>
        </div>
      </dl>
      {stale ? (
        <p role="note" className="flex gap-2 border-t border-pet-red-text px-4 py-3 text-sm font-medium text-pet-red-text">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {days === null
            ? "Esta fonte ainda não foi atualizada no painel."
            : `Dados desatualizados: a última atualização foi ${agoText(days)} (o normal é a cada 30 dias). Os números podem não incluir as revisões mais recentes do DATASUS.`}
        </p>
      ) : null}
    </section>
  );
}
