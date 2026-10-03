"use client";

import { RefreshCw, ScrollText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getAdminAuditLogs, getSources } from "@/lib/api";
import { AGGREGATION_LABELS, formatDateTimeSeconds, formatNumber, pluralize } from "@/lib/format";
import type { AdminAuditLog, RecordAggregation } from "@/types/api";
import {
  ActionButton,
  ErrorBox,
  JobStatus,
  LoadingBlocks,
  Panel,
  SelectField,
  TablePagination,
  useClientPagination
} from "./admin-ui";
import { useAdminLoader } from "./useAdminLoader";

const ACTION_LABELS: Record<string, string> = {
  admin_login: "Entrou",
  admin_logout: "Saiu",
  admin_request_blocked: "Requisição bloqueada",
  admin_export_csv: "Baixou CSV",
  admin_export_dashboard: "Baixou dashboard",
  admin_sync_source: "Sincronizou fonte",
  admin_sync_all: "Sincronizou todas",
  admin_population_upload: "Enviou população",
  admin_population_clear: "Apagou população",
  admin_export_indicators: "Baixou indicadores"
};

const UNIDENTIFIED_ACTOR = "nao_identificado";

type SourceNames = Map<string, string>;

async function loadAudit() {
  const [audit, sources] = await Promise.all([getAdminAuditLogs(), getSources()]);
  return { logs: audit.auditLogs, sourceNames: new Map(sources.sources.map((source) => [source.slug, source.name])) };
}

function text(value: unknown) {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
}

function describeFilters(filters: unknown, sourceNames: SourceNames) {
  if (!filters || typeof filters !== "object") {
    return [];
  }

  const values = filters as Record<string, unknown>;
  const parts = [
    text(values.source) ? sourceNames.get(text(values.source)!) ?? text(values.source) : null,
    text(values.year) ? `ano ${text(values.year)}` : null,
    text(values.sex) ? `sexo ${text(values.sex)}` : null,
    text(values.ageGroup) ? `faixa ${text(values.ageGroup)}` : null,
    text(values.raceColor) ? `raça/cor ${text(values.raceColor)}` : null,
    text(values.aggregation) ? AGGREGATION_LABELS[text(values.aggregation) as RecordAggregation] ?? null : null
  ];

  return parts.filter((part): part is string => Boolean(part));
}

/** Frase em português que explica o que aconteceu no evento. */
export function describeAuditEvent(log: AdminAuditLog, sourceNames: SourceNames) {
  const metadata = log.metadata ?? {};
  const reason = text(metadata.reason);
  const sourceName = text(metadata.source) ? sourceNames.get(text(metadata.source)!) ?? text(metadata.source) : null;
  const failureMessage = text(metadata.message);

  switch (log.action) {
    case "admin_login":
      if (log.status === "SUCCESS") {
        return "Entrou no painel administrativo.";
      }
      if (reason === "rate_limited") {
        const minutes = Math.ceil(Number(metadata.retryAfterSeconds ?? 0) / 60);
        return `Login bloqueado por excesso de tentativas${minutes ? ` (libera em ${minutes} min)` : ""}.`;
      }
      return `Usuário ou senha incorretos${text(metadata.username) ? ` (usuário digitado: “${text(metadata.username)}”)` : ""}.`;
    case "admin_logout":
      return "Saiu do painel administrativo.";
    case "admin_request_blocked":
      return `Pedido vindo de um site não autorizado foi recusado (${text(metadata.method) ?? ""} ${text(metadata.path) ?? ""}).`;
    case "admin_export_csv": {
      if (log.status !== "SUCCESS") {
        return `Falha ao gerar o CSV${failureMessage ? `: ${failureMessage}` : "."}`;
      }
      const filters = describeFilters(metadata.filters, sourceNames);
      const count = typeof metadata.recordsExported === "number" ? pluralize(metadata.recordsExported, "registro", "registros") : null;
      return `Baixou CSV${filters.length ? ` de ${filters.join(", ")}` : ""}${count ? ` (${count})` : ""}.`;
    }
    case "admin_export_dashboard": {
      if (log.status !== "SUCCESS") {
        return `Falha ao gerar o dashboard de ${sourceName ?? "fonte"}${failureMessage ? `: ${failureMessage}` : "."}`;
      }
      const filters = describeFilters({ ...(metadata.filters as object), source: metadata.source }, sourceNames);
      return `Baixou o dashboard HTML de ${filters.join(", ") || sourceName || "fonte"}.`;
    }
    case "admin_sync_source":
      if (reason === "sync_already_running") {
        return `Pediu para sincronizar ${sourceName}, mas ela já estava sincronizando.`;
      }
      if (log.status !== "SUCCESS") {
        return `Sincronização de ${sourceName ?? "fonte"} falhou${failureMessage ? `: ${failureMessage}` : "."}`;
      }
      return `Sincronizou ${sourceName ?? "fonte"}${typeof metadata.recordsImported === "number" ? ` (${pluralize(metadata.recordsImported, "registro", "registros")})` : ""}.`;
    case "admin_sync_all": {
      if (reason === "sync_error") {
        return `Sincronização geral parou em ${sourceName ?? "uma fonte"}${failureMessage ? `: ${failureMessage}` : "."}`;
      }
      const results = Array.isArray(metadata.results) ? (metadata.results as Record<string, unknown>[]) : [];
      const failed = results.filter((result) => result.error || result.status === "FAILED");
      return `Sincronizou todas as fontes (${results.length || text(metadata.totalSources) || "?"})${
        failed.length ? `; com problema: ${failed.map((result) => sourceNames.get(String(result.source)) ?? result.source).join(", ")}` : ""
      }.`;
    }
    case "admin_population_upload": {
      const list = (key: string) => (Array.isArray(metadata[key]) ? (metadata[key] as unknown[]).join(", ") : "");
      const changes = [
        list("added") && `novos: ${list("added")}`,
        list("changed") && `alterados: ${list("changed")}`,
        list("removed") && `apagados: ${list("removed")}`
      ].filter(Boolean);
      return `Enviou a planilha de população (${text(metadata.years) ?? "?"} anos, ${text(metadata.firstYear) ?? "?"}–${text(metadata.lastYear) ?? "?"})${
        changes.length ? `; ${changes.join("; ")}` : "; sem mudanças"
      }.`;
    }
    case "admin_export_indicators":
      return `Baixou os indicadores de ${sourceName ?? "fonte"} em CSV.`;
    case "admin_population_clear":
      return `Apagou a tabela de população (${text(metadata.removed) ?? "0"} anos).`;
    default:
      return reason ?? failureMessage ?? "-";
  }
}

/** "Firefox 155 · Linux" a partir do User-Agent (o texto completo fica no title). */
export function describeBrowser(userAgent: string | null) {
  if (!userAgent) {
    return "-";
  }

  const browser =
    userAgent.match(/Edg\/(\d+)/)?.[1] ? `Edge ${userAgent.match(/Edg\/(\d+)/)![1]}` :
    userAgent.match(/Firefox\/(\d+)/) ? `Firefox ${userAgent.match(/Firefox\/(\d+)/)![1]}` :
    userAgent.match(/HeadlessChrome\/(\d+)/) ? "Chrome (automatizado)" :
    userAgent.match(/Chrome\/(\d+)/) ? `Chrome ${userAgent.match(/Chrome\/(\d+)/)![1]}` :
    userAgent.match(/Version\/(\d+).*Safari/) ? `Safari ${userAgent.match(/Version\/(\d+)/)![1]}` :
    /^curl\//.test(userAgent) ? "curl (script)" :
    /node|undici/i.test(userAgent) ? "Node.js (script)" :
    userAgent.split(/[ /]/)[0];
  const system = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;

  return system ? `${browser} · ${system}` : browser;
}

/**
 * Login com falha e pedido bloqueado acontecem sem sessão: quem fez não é identificado
 * (registros antigos gravavam "admin" nesses casos; o backend agora grava "nao_identificado").
 */
function isUnidentified(log: AdminAuditLog) {
  return (
    log.actor === UNIDENTIFIED_ACTOR ||
    log.action === "admin_request_blocked" ||
    (log.action === "admin_login" && log.status !== "SUCCESS")
  );
}

function describeActor(log: AdminAuditLog) {
  return isUnidentified(log) ? "Não identificado" : log.actor;
}

/** Tela de auditoria: quem fez o quê, quando, de onde e com qual navegador. */
export function AdminAudit() {
  const { state, reload } = useAdminLoader(loadAudit);
  const [actionFilter, setActionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    if (state.status !== "loaded") {
      return [];
    }

    const term = search.trim().toLocaleLowerCase("pt-BR");

    return state.data.logs
      .map((log) => ({
        log,
        actor: describeActor(log),
        details: describeAuditEvent(log, state.data.sourceNames),
        browser: describeBrowser(log.userAgent)
      }))
      .filter(
        ({ log, actor, details, browser }) =>
          (!actionFilter || log.action === actionFilter) &&
          (!statusFilter || log.status === statusFilter) &&
          (!term || [actor, log.ipAddress ?? "", details, browser].join(" ").toLocaleLowerCase("pt-BR").includes(term))
      );
  }, [state, actionFilter, statusFilter, search]);
  const pagination = useClientPagination(rows);

  if (state.status === "loading") {
    return <LoadingBlocks />;
  }

  if (state.status === "error") {
    return <ErrorBox message={`API indisponível: ${state.message}`} />;
  }

  return (
    <Panel
      title="Auditoria administrativa"
      icon={ScrollText}
      actions={
        <ActionButton icon={RefreshCw} onClick={() => void reload()}>
          Atualizar
        </ActionButton>
      }
    >
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr]">
        <SelectField label="Ação" value={actionFilter} onChange={setActionFilter}>
          <option value="">Todas</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" value={statusFilter} onChange={setStatusFilter}>
          <option value="">Todos</option>
          <option value="SUCCESS">Sucesso</option>
          <option value="FAILED">Falha</option>
        </SelectField>
        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Buscar</span>
          <span className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Usuário, IP, fonte, navegador..."
              className="h-10 w-full rounded border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
            />
          </span>
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="p-4 text-sm text-slate-600">Nenhum evento encontrado.</div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 lg:hidden">
            {pagination.items.map(({ log, actor, details, browser }) => (
              <article key={log.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-950">{ACTION_LABELS[log.action] ?? log.action}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTimeSeconds(log.createdAt)}</div>
                  </div>
                  <JobStatus status={log.status} />
                </div>
                <p className="text-sm text-slate-900">{details}</p>
                <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <dt className="uppercase text-slate-400">Usuário</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{actor}</dd>
                  </div>
                  <div>
                    <dt className="uppercase text-slate-400">IP</dt>
                    <dd className="mt-0.5 tabular-nums">{log.ipAddress ?? "-"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="uppercase text-slate-400">Navegador</dt>
                    <dd className="mt-0.5" title={log.userAgent ?? undefined}>
                      {browser}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-pet-dark text-xs uppercase text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Data e hora</th>
                  <th className="px-4 py-3 font-semibold">Usuário</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                  <th className="px-4 py-3 font-semibold">Ação</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Detalhes</th>
                  <th className="px-4 py-3 font-semibold">Navegador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.items.map(({ log, actor, details, browser }) => (
                  <tr key={log.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTimeSeconds(log.createdAt)}</td>
                    <td className={`px-4 py-3 font-medium ${isUnidentified(log) ? "text-slate-500" : "text-slate-950"}`}>{actor}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">{log.ipAddress ?? "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-950">{ACTION_LABELS[log.action] ?? log.action}</td>
                    <td className="px-4 py-3">
                      <JobStatus status={log.status} />
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-900">{details}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600" title={log.userAgent ?? undefined}>
                      {browser}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={rows.length}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
        </>
      )}
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        Mostra os 500 eventos mais recentes. Há uma única conta de administrador: para saber qual pessoa usou a conta, cruze
        o horário, o IP e o navegador.
      </p>
    </Panel>
  );
}
