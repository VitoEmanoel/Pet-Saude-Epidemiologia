import type { RecordAggregation } from "@/types/api";

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Sem sincronizacao";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatYearRange(first: number | null, last: number | null) {
  if (!first || !last) {
    return "Sem periodo";
  }

  return `${first}-${last}`;
}

export const AGGREGATION_LABELS: Record<RecordAggregation, string> = {
  yearly: "Total do ano",
  sex: "Por sexo",
  age_group: "Por faixa etária",
  race_color: "Por raça/cor",
  all: "Todas as visões"
};

export function formatAggregation(value: RecordAggregation | null | undefined) {
  return value ? AGGREGATION_LABELS[value] : "-";
}

/** Data e hora com segundos (auditoria): 02/10/2026 14:32:05. */
export function formatDateTimeSeconds(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}
