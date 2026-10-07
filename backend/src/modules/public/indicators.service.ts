import { prisma } from "../../database/prisma";
import { getYearlyEvolution } from "./public-data.service";

// Indicadores de saúde das arboviroses (A5), conforme o documento do GT1 - Vigilância
// Epidemiológica (docs/INDICADORES DE SAÚDE DAS ARBOVIROSES.md). Calculados a cada consulta
// a partir dos casos já coletados do TABNET e da população cadastrada no admin.
// Regra do projeto: nunca estimar. Sem população ou fora do período, o valor fica null
// com o motivo em `status`.

export type IndicatorKey =
  | "casos"
  | "incidencia"
  | "pct_sinais_alarme"
  | "pct_grave"
  | "incidencia_idosos"
  | "casos_confirmados";

export type IndicatorStatus = "ok" | "sem_populacao" | "nao_se_aplica" | "sem_dados";

export type IndicatorPoint = {
  year: number;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  status: IndicatorStatus;
  /** Ano corrente: o DATASUS ainda revisa os dados (casos em investigação). */
  provisional: boolean;
};

export type Indicator = {
  key: IndicatorKey;
  label: string;
  unit: string;
  description: string;
  formula: string;
  series: IndicatorPoint[];
};

type IndicatorDefinition = Omit<Indicator, "series">;

const PER_100K = 100_000;
const NEW_DENGUE_CLASSIFICATION_FROM = 2014;
const ELDERLY_AGE_GROUPS = ["60-64", "65-69", "70-79", "80 anos e mais"];
const DENGUE_ALARM = "Dengue com sinais de alarme";
const DENGUE_SEVERE = "Dengue grave";
// Classificação "confirmado" em cada formulário (zika: "Confirmado"; chikungunya: "Chikungunya").
const CONFIRMED_CLASSIFICATION: Record<string, string> = {
  zika_sinan: "Confirmado",
  chikungunya_sinan: "Chikungunya"
};

const DEFINITIONS: Record<IndicatorKey, IndicatorDefinition> = {
  casos: {
    key: "casos",
    label: "Casos prováveis",
    unit: "casos",
    description: "Notificações de residentes em Parnaíba, exceto as descartadas.",
    formula: "Total de casos prováveis no ano"
  },
  incidencia: {
    key: "incidencia",
    label: "Coeficiente de incidência",
    unit: "por 100 mil hab.",
    description: "Mede a magnitude e a intensidade da transmissão no município.",
    formula: "casos prováveis ÷ população residente × 100.000"
  },
  pct_sinais_alarme: {
    key: "pct_sinais_alarme",
    label: "% com sinais de alarme",
    unit: "%",
    description: "Avalia a gravidade clínica e a oportunidade do diagnóstico e manejo. Classificação usada a partir de 2014.",
    formula: "casos de dengue com sinais de alarme ÷ casos prováveis de dengue × 100"
  },
  pct_grave: {
    key: "pct_grave",
    label: "% de dengue grave",
    unit: "%",
    description: "Indicador direto de severidade da doença. Classificação usada a partir de 2014.",
    formula: "casos de dengue grave ÷ casos prováveis de dengue × 100"
  },
  incidencia_idosos: {
    key: "incidencia_idosos",
    label: "Incidência em idosos (60+)",
    unit: "por 100 mil idosos",
    description: "Indicador de vulnerabilidade, associado a maior risco de gravidade e óbito.",
    formula: "casos prováveis de 60 anos ou mais ÷ população de 60 anos ou mais × 100.000"
  },
  casos_confirmados: {
    key: "casos_confirmados",
    label: "Casos confirmados",
    unit: "casos",
    description: "Parte dos casos prováveis que teve a confirmação registrada (laboratorial ou clínico-epidemiológica).",
    formula: "Casos com classificação final confirmada"
  }
};

// Indicadores de cada fonte (só dengue, zika e chikungunya; sífilis congênita, por exemplo, usa nascidos vivos, não população).
const SOURCE_INDICATORS: Record<string, IndicatorKey[]> = {
  dengue_sinan: ["casos", "incidencia", "pct_sinais_alarme", "pct_grave"],
  zika_sinan: ["casos", "incidencia", "casos_confirmados"],
  chikungunya_sinan: ["casos", "incidencia", "incidencia_idosos", "casos_confirmados"]
};

export function hasIndicators(sourceSlug: string) {
  return Boolean(SOURCE_INDICATORS[sourceSlug]);
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Razão com o motivo quando não dá para calcular. */
export function ratio(
  year: number,
  numerator: number | null,
  denominator: number | null,
  multiplier: number,
  missingDenominatorStatus: IndicatorStatus,
  currentYear: number
): IndicatorPoint {
  const provisional = year >= currentYear;

  if (numerator === null) {
    return { year, value: null, numerator, denominator, status: "sem_dados", provisional };
  }

  if (!denominator) {
    return { year, value: null, numerator, denominator, status: missingDenominatorStatus, provisional };
  }

  return { year, value: round((numerator / denominator) * multiplier, 2), numerator, denominator, status: "ok", provisional };
}

async function getClassificationByYear(sourceSlug: string, classification: string) {
  const rows = await prisma.classificationCount.findMany({
    where: { source: { slug: sourceSlug }, classification },
    select: { year: true, value: true }
  });
  return new Map(rows.map((row) => [row.year, Number(row.value)]));
}

async function getElderlyCasesByYear(sourceSlug: string) {
  const rows = await prisma.epidemiologicalRecord.groupBy({
    by: ["year"],
    where: {
      source: { slug: sourceSlug },
      sourceTable: { contains: "_by_age_group_" },
      ageGroup: { in: ELDERLY_AGE_GROUPS },
      year: { not: null }
    },
    _sum: { value: true }
  });
  return new Map(rows.map((row) => [row.year as number, Number(row._sum.value ?? 0)]));
}

export async function getSourceIndicators(sourceSlug: string, now = new Date()): Promise<Indicator[]> {
  const keys = SOURCE_INDICATORS[sourceSlug];

  if (!keys) {
    return [];
  }

  const currentYear = now.getFullYear();
  const [cases, population] = await Promise.all([
    getYearlyEvolution(sourceSlug),
    prisma.populationEstimate.findMany({ select: { year: true, population: true, population60Plus: true } })
  ]);
  const populationByYear = new Map(population.map((row) => [row.year, row]));
  const years = cases.map((point) => point.year);
  const casesByYear = new Map(cases.map((point) => [point.year, point.value]));

  const build = async (key: IndicatorKey): Promise<IndicatorPoint[]> => {
    switch (key) {
      case "casos":
        return years.map((year) => ({
          year,
          value: casesByYear.get(year) ?? 0,
          numerator: casesByYear.get(year) ?? 0,
          denominator: null,
          status: "ok",
          provisional: year >= currentYear
        }));
      case "incidencia":
        return years.map((year) =>
          ratio(year, casesByYear.get(year) ?? 0, populationByYear.get(year)?.population ?? null, PER_100K, "sem_populacao", currentYear)
        );
      case "pct_sinais_alarme":
      case "pct_grave": {
        const byYear = await getClassificationByYear(sourceSlug, key === "pct_grave" ? DENGUE_SEVERE : DENGUE_ALARM);
        return years.map((year) =>
          year < NEW_DENGUE_CLASSIFICATION_FROM
            ? { year, value: null, numerator: null, denominator: casesByYear.get(year) ?? null, status: "nao_se_aplica", provisional: false }
            : ratio(year, byYear.get(year) ?? 0, casesByYear.get(year) ?? null, 100, "sem_dados", currentYear)
        );
      }
      case "incidencia_idosos": {
        const elderly = await getElderlyCasesByYear(sourceSlug);
        return years.map((year) =>
          ratio(year, elderly.get(year) ?? 0, populationByYear.get(year)?.population60Plus ?? null, PER_100K, "sem_populacao", currentYear)
        );
      }
      case "casos_confirmados": {
        const confirmed = await getClassificationByYear(sourceSlug, CONFIRMED_CLASSIFICATION[sourceSlug] ?? "");
        return years.map((year) => {
          // Anos sem classificação coletada (ex.: chikungunya 2015) ficam sem dado, não zero.
          const hasClassification = confirmed.size > 0 && (confirmed.has(year) || year >= Math.min(...confirmed.keys()));
          const value = hasClassification ? confirmed.get(year) ?? 0 : null;
          return { year, value, numerator: value, denominator: casesByYear.get(year) ?? null, status: value === null ? "sem_dados" : "ok", provisional: year >= currentYear };
        });
      }
    }
  };

  return Promise.all(keys.map(async (key) => ({ ...DEFINITIONS[key], series: await build(key) })));
}
