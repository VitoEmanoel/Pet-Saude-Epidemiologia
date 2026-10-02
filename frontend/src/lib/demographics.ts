import type { DemographicFilterKey } from "@/types/api";

// O DATASUS fornece os casos por sexo, por faixa etária e por raça/cor separadamente,
// nunca cruzados. Por isso só um filtro demográfico pode estar ativo por vez.
export const DEMOGRAPHIC_KEYS: readonly DemographicFilterKey[] = ["sex", "ageGroup", "raceColor"];

const DIMENSION_LABELS: Record<DemographicFilterKey, string> = {
  sex: "sexo",
  ageGroup: "faixa etária",
  raceColor: "raça/cor"
};

const ALL_VALUES_LABELS: Record<DemographicFilterKey, string> = {
  sex: "todos os sexos",
  ageGroup: "todas as faixas etárias",
  raceColor: "todas as raças/cores"
};

function isDemographicKey(key: string): key is DemographicFilterKey {
  return (DEMOGRAPHIC_KEYS as readonly string[]).includes(key);
}

/** Aplica um filtro; se for demográfico e tiver valor, limpa os outros filtros demográficos. */
export function withSingleDemographic<T extends Partial<Record<DemographicFilterKey, unknown>>>(
  filters: T,
  key: keyof T & string,
  value: T[keyof T]
): T {
  const next = { ...filters, [key]: value };

  if (isDemographicKey(key) && value) {
    for (const other of DEMOGRAPHIC_KEYS) {
      if (other !== key && other in next) {
        next[other] = (typeof filters[other] === "string" ? "" : undefined) as T[typeof other];
      }
    }
  }

  return next;
}

/** Aviso para um gráfico que não pôde aplicar um filtro de outra dimensão. */
export function ignoredFiltersNote(
  chartDimension: DemographicFilterKey,
  ignoredFilters: DemographicFilterKey[] | undefined
): string | undefined {
  const ignored = ignoredFilters?.[0];

  if (!ignored) {
    return undefined;
  }

  return `Mostrando ${ALL_VALUES_LABELS[ignored]}: o DATASUS não separa ${DIMENSION_LABELS[chartDimension]} por ${DIMENSION_LABELS[ignored]}.`;
}
