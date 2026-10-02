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
