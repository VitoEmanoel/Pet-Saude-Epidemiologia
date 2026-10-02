"use client";

import { History, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { getAdminSyncHistory } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { AdminSyncHistoryResponse } from "@/types/api";
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

type SyncJob = AdminSyncHistoryResponse["syncJobs"][number];

const ORIGIN_LABELS: Record<string, string> = {
  admin_api: "Admin (uma fonte)",
  admin_api_sync_all: "Admin (todas)",
  scheduler: "Agendador automático",
  cli: "Linha de comando",
  teste_resiliencia: "Teste automatizado"
};

function formatOrigin(requestedBy: string | null) {
  return requestedBy ? ORIGIN_LABELS[requestedBy] ?? requestedBy : "-";
}

function formatDuration(job: SyncJob) {
  if (!job.startedAt || !job.finishedAt) {
    return "-";
  }

  const seconds = Math.max(0, Math.round((Date.parse(job.finishedAt) - Date.parse(job.startedAt)) / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** Tela com o histórico das últimas sincronizações com o TABNET. */
export function AdminSyncHistory() {
  const { state, reload } = useAdminLoader(getAdminSyncHistory);
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const jobs = useMemo(
    () =>
      state.status === "loaded"
        ? state.data.syncJobs.filter(
            (job) => (!sourceFilter || job.source?.slug === sourceFilter) && (!statusFilter || job.status === statusFilter)
          )
        : [],
    [state, sourceFilter, statusFilter]
  );
  const pagination = useClientPagination(jobs);

  if (state.status === "loading") {
    return <LoadingBlocks />;
  }

  if (state.status === "error") {
    return <ErrorBox message={`API indisponível: ${state.message}`} />;
  }

  const sources = [
    ...new Map(state.data.syncJobs.filter((job) => job.source).map((job) => [job.source!.slug, job.source!.name])).entries()
  ];

  return (
    <Panel
      title="Histórico de sincronizações"
      icon={History}
      actions={
        <ActionButton icon={RefreshCw} onClick={() => void reload()}>
          Atualizar
        </ActionButton>
      }
    >
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:max-w-2xl">
        <SelectField label="Fonte" value={sourceFilter} onChange={setSourceFilter}>
          <option value="">Todas</option>
          {sources.map(([slug, name]) => (
            <option key={slug} value={slug}>
              {name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" value={statusFilter} onChange={setStatusFilter}>
          <option value="">Todos</option>
          <option value="SUCCESS">Sucesso</option>
          <option value="FAILED">Falha</option>
          <option value="RUNNING">Em andamento</option>
          <option value="UNAVAILABLE">Indisponível</option>
        </SelectField>
      </div>

      {jobs.length === 0 ? (
        <div className="p-4 text-sm text-slate-600">Nenhuma sincronização encontrada.</div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 md:hidden">
            {pagination.items.map((job) => (
              <article key={job.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-950">{job.source?.name ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(job.startedAt)}</div>
                  </div>
                  <JobStatus status={job.status} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Registros</dt>
                    <dd className="mt-1 text-slate-900">{formatNumber(job.recordsImported)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Duração</dt>
                    <dd className="mt-1 text-slate-700">{formatDuration(job)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs uppercase text-slate-500">Origem</dt>
                    <dd className="mt-1 text-slate-700">{formatOrigin(job.requestedBy)}</dd>
                  </div>
                  {job.errorMessage ? (
                    <div className="col-span-2">
                      <dt className="text-xs uppercase text-slate-500">Erro</dt>
                      <dd className="mt-1 break-words text-pet-red">{job.errorMessage}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-pet-dark text-xs uppercase text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Início</th>
                  <th className="px-4 py-3 font-semibold">Fonte</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Registros</th>
                  <th className="px-4 py-3 font-semibold">Duração</th>
                  <th className="px-4 py-3 font-semibold">Origem</th>
                  <th className="px-4 py-3 font-semibold">Erro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.items.map((job) => (
                  <tr key={job.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(job.startedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950">{job.source?.name ?? "-"}</div>
                      <div className="text-xs text-slate-500">{job.source?.slug ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <JobStatus status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-900">{formatNumber(job.recordsImported)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDuration(job)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatOrigin(job.requestedBy)}</td>
                    <td className="max-w-md px-4 py-3 text-pet-red">{job.errorMessage ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={jobs.length}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
        </>
      )}
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Mostra as 50 sincronizações mais recentes.</p>
    </Panel>
  );
}
