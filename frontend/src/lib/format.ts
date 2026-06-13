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

