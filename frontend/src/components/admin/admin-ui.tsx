"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import { formatNumber } from "@/lib/format";

// Peças compartilhadas pelas telas da área administrativa.

export const ADMIN_TABLE_PAGE_SIZE = 15;

export type ActionState = {
  busyAction: string | null;
  message: string | null;
  error: string | null;
};

export const IDLE_ACTION: ActionState = { busyAction: null, message: null, error: null };

export function isAdminAuthError(error: unknown) {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}

export function isAdminRateLimitError(error: unknown) {
  return error instanceof ApiRequestError && error.status === 429;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function confirmAdminAction(message: string) {
  return typeof window === "undefined" ? true : window.confirm(message);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

export function getSourceReferenceUrl(sourceUrl: string | null) {
  if (!sourceUrl) {
    return null;
  }

  return sourceUrl.startsWith("http://tabnet.datasus.gov.br")
    ? sourceUrl.replace("http://tabnet.datasus.gov.br", "https://tabnet.datasus.gov.br")
    : sourceUrl;
}

/** Bloco branco com título, ações à direita e conteúdo. */
export function Panel({
  title,
  icon: Icon,
  actions,
  children
}: {
  title: string;
  icon?: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {Icon ? <Icon size={17} className="text-slate-500" aria-hidden /> : null}
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

const buttonStyles = {
  primary: "bg-pet-orange text-white hover:bg-pet-dark",
  secondary: "border border-slate-300 text-slate-700 hover:bg-slate-50",
  blue: "bg-institutional-600 text-white hover:bg-institutional-800"
} as const;

export function ActionButton({
  variant = "secondary",
  icon: Icon,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonStyles;
  icon?: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]}`}
    >
      {Icon ? <Icon size={16} aria-hidden /> : null}
      {children}
    </button>
  );
}

const STATUS_LABELS: Record<string, string> = {
  SUCCESS: "Sucesso",
  FAILED: "Falha",
  RUNNING: "Em andamento",
  UNAVAILABLE: "Indisponível",
  PENDING: "Pendente",
  PARTIAL_SUCCESS: "Parcial",
  SKIPPED: "Ignorada"
};

export function JobStatus({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-sm text-slate-400">Sem status</span>;
  }

  const success = status === "SUCCESS";
  const failed = status === "FAILED" || status === "UNAVAILABLE";
  const Icon = success ? CheckCircle2 : failed ? XCircle : Clock3;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1 text-xs font-medium ${
        success
          ? "border-pet-light bg-pet-light/15 text-pet-dark"
          : failed
            ? "border-pet-red/30 bg-pet-red/5 text-pet-red"
            : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      <Icon size={14} aria-hidden="true" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function StatusMessages({ actionState }: { actionState: ActionState }) {
  return (
    <>
      {actionState.message ? (
        <div role="status" className="border-t border-pet-mid/30 bg-pet-light/15 px-4 py-3 text-sm text-pet-dark">
          {actionState.message}
        </div>
      ) : null}
      {actionState.error ? (
        <div role="alert" className="border-t border-pet-red/30 bg-pet-red/5 px-4 py-3 text-sm text-pet-red">
          {actionState.error}
        </div>
      ) : null}
    </>
  );
}

export function useClientPagination<T>(items: T[], pageSize = ADMIN_TABLE_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return { page: safePage, totalPages, items: items.slice(start, start + pageSize), setPage, pageSize };
}

export function TablePagination({
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
        {firstItem}–{lastItem} de {formatNumber(totalItems)} registros
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <button
          type="button"
          aria-label="Página anterior"
          title="Página anterior"
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
          aria-label="Próxima página"
          title="Próxima página"
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

export function SelectField({
  label,
  value,
  onChange,
  disabled = false,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
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
        {children}
      </select>
    </label>
  );
}

export function LoadingBlocks() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded border border-slate-200 bg-white" />
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded border border-pet-red bg-pet-red/5 p-4 text-sm text-pet-red">
      {message}
    </div>
  );
}
