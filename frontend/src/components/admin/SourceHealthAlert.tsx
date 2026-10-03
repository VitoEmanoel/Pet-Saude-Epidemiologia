"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { SourceHealth } from "@/types/api";

const LEVEL_STYLES = {
  ok: { label: "Em dia", icon: CheckCircle2, className: "border-pet-light bg-pet-light/15 text-pet-dark" },
  warning: { label: "Atenção", icon: AlertTriangle, className: "border-amber-200 bg-amber-50 text-amber-700" },
  error: { label: "Problema", icon: XCircle, className: "border-pet-red/40 bg-pet-red/5 text-pet-red-text" }
} as const;

export function HealthBadge({ level }: { level: SourceHealth["level"] }) {
  const { label, icon: Icon, className } = LEVEL_STYLES[level];

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1 text-xs font-medium ${className}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Alerta do Painel: aparece só quando alguma fonte falha seguido, está desatualizada ou tem aviso (O5). */
export function SourceHealthAlert({ sources }: { sources: SourceHealth[] }) {
  const problems = sources.filter((source) => source.level !== "ok");

  if (problems.length === 0) {
    return null;
  }

  const hasError = problems.some((source) => source.level === "error");

  return (
    <section
      role="alert"
      className={`rounded border p-4 text-sm ${hasError ? "border-pet-red/40 bg-pet-red/5 text-pet-red-text" : "border-amber-200 bg-amber-50 text-amber-700"}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              {problems.length === 1 ? "1 fonte precisa de atenção" : `${problems.length} fontes precisam de atenção`}
            </p>
            <ul className="mt-1 space-y-1">
              {problems.map((source) => (
                <li key={source.slug}>
                  <span className="font-medium">{source.name}:</span> {source.problems.join(" ")}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Link href="/admin/fontes" className="shrink-0 font-medium underline underline-offset-2">
          Ver fontes
        </Link>
      </div>
    </section>
  );
}
