import type { EpidemiologicalRecord, Prisma } from "@prisma/client";
import { ALLOWED_CITY } from "../../config/city";
import { allowedSources, getPublicSourceBySlug, getSourceBySlug, publicSources } from "../../config/sources";
import { isSourceHidden } from "../sources/source-publication";
import { prisma } from "../../database/prisma";

// Cada caso é gravado em 4 visões (agregações) diferentes: total do ano, por sexo,
// por faixa etária e por raça/cor. Somar visões diferentes conta o mesmo caso várias vezes.
export const RECORD_AGGREGATIONS = ["yearly", "sex", "age_group", "race_color", "all"] as const;
export type RecordAggregation = (typeof RECORD_AGGREGATIONS)[number];
export type ResolvedAggregation = Exclude<RecordAggregation, "all">;

export type PublicFilters = {
  source?: string;
  year?: number;
  month?: number;
  sex?: string;
  ageGroup?: string;
  raceColor?: string;
  condition?: string;
  aggregation?: RecordAggregation;
};

export type Pagination = {
  page: number;
  pageSize: number;
};

export type SerializedRecord = {
  id: number;
  source: {
    slug: string;
    name: string;
    system: string;
  };
  city: typeof ALLOWED_CITY;
  year: number | null;
  month: number | null;
  diseaseOrCondition: string | null;
  metric: string | null;
  value: number | null;
  sex: string | null;
  ageGroup: string | null;
  raceColor: string | null;
  dimensions: Prisma.JsonValue;
  sourceTable: string | null;
  aggregation: ResolvedAggregation | null;
  importedAt: Date;
};

const YEARLY_SOURCE_TABLE_FRAGMENT = "_yearly_";
const SEX_SOURCE_TABLE_FRAGMENT = "_by_sex_";
const AGE_GROUP_SOURCE_TABLE_FRAGMENT = "_by_age_group_";
const RACE_COLOR_SOURCE_TABLE_FRAGMENT = "_by_race_color_";
const AGGREGATION_SOURCE_TABLE_FRAGMENTS: Record<ResolvedAggregation, string> = {
  yearly: YEARLY_SOURCE_TABLE_FRAGMENT,
  sex: SEX_SOURCE_TABLE_FRAGMENT,
  age_group: AGE_GROUP_SOURCE_TABLE_FRAGMENT,
  race_color: RACE_COLOR_SOURCE_TABLE_FRAGMENT
};
const AGE_GROUP_ORDER = [
  "Menor de 1 ano",
  "1-4",
  "5-9",
  "10-14",
  "15-19",
  "20-39",
  "40-59",
  "60-64",
  "65-69",
  "70-79",
  "80 anos e mais",
  "Ignorado"
];
const baseSourceSlugs = allowedSources.map((source) => source.slug);
// A visão geral soma só as fontes primárias públicas (fontes internas ficam de fora).
const primarySourceSlugs = publicSources
  .filter((source) => source.kind === "primary")
  .map((source) => source.slug);
// Fontes tiradas do site pelo administrador (7.5) saem da soma na hora.
const visibleOverviewSlugs = () => primarySourceSlugs.filter((slug) => !isSourceHidden(slug));
const visiblePublicSources = () => publicSources.filter((source) => !isSourceHidden(source.slug));

export async function getDashboardOverview() {
  const sourcesWithoutMunicipalData = visiblePublicSources().filter(
    (source) => source.municipalityFilterStatus === "unavailable"
  ).length;
  const sourcesPendingValidation = visiblePublicSources().filter(
    (source) => source.municipalityFilterStatus === "unknown"
  ).length;

  const overviewWhere: Prisma.EpidemiologicalRecordWhereInput = {
    ...cityWhere(),
    source: {
      slug: {
        in: visibleOverviewSlugs()
      }
    }
  };
  const overviewYearlyWhere: Prisma.EpidemiologicalRecordWhereInput = {
    ...overviewWhere,
    year: {
      not: null
    },
    sourceTable: {
      contains: YEARLY_SOURCE_TABLE_FRAGMENT
    }
  };

  const [totalNormalizedRecords, totalCases, lastImportedRecord, yearlyRows, casesBySource] =
    await Promise.all([
      prisma.epidemiologicalRecord.count({
        where: overviewWhere
      }),
      sumValues(overviewYearlyWhere),
      prisma.epidemiologicalRecord.findFirst({
        where: overviewWhere,
        orderBy: {
          importedAt: "desc"
        },
        select: {
          importedAt: true
        }
      }),
      prisma.epidemiologicalRecord.groupBy({
        by: ["year"],
        where: overviewYearlyWhere,
        _sum: {
          value: true
        },
        orderBy: {
          year: "asc"
        }
      }),
      getCasesBySource()
    ]);

  // Fonte com dados = tem pelo menos um ano coletado (evita uma consulta por fonte)
  const sourcesWithData = casesBySource.filter((item) => item.firstYear !== null).length;
  const yearlyEvolution = yearlyRows.map((row) => ({
    year: row.year as number,
    value: decimalToNumber(row._sum.value)
  }));

  return {
    city: ALLOWED_CITY,
    summary: {
      totalRecords: totalNormalizedRecords,
      totalCases,
      lastUpdate: lastImportedRecord?.importedAt ?? null,
      totalSources: visiblePublicSources().length,
      sourcesWithMunicipalData: sourcesWithData,
      sourcesWithoutMunicipalData,
      sourcesPendingValidation,
      dataStatus: totalNormalizedRecords > 0 ? "synced" : "not_synced",
      casesSourceCount: visibleOverviewSlugs().length
    },
    casesBySource,
    charts: {
      yearlyEvolution
    }
  };
}

/** Casos (total anual) e período de cada fonte pública, em uma única consulta agrupada. */
async function getCasesBySource() {
  const rows = await prisma.epidemiologicalRecord.groupBy({
    by: ["sourceId"],
    where: {
      ...baseCityRecordWhere(),
      year: {
        not: null
      },
      sourceTable: {
        contains: YEARLY_SOURCE_TABLE_FRAGMENT
      }
    },
    _sum: {
      value: true
    },
    _min: {
      year: true
    },
    _max: {
      year: true
    }
  });
  const dataSources = await prisma.dataSource.findMany({
    where: {
      id: {
        in: rows.map((row) => row.sourceId)
      }
    },
    select: {
      id: true,
      slug: true
    }
  });
  const rowsBySlug = new Map(
    rows.map((row) => [dataSources.find((source) => source.id === row.sourceId)?.slug, row])
  );

  return visiblePublicSources().map((source) => {
    const sourceRows = getResolvedSourceSlugs(source.slug)
      .map((slug) => rowsBySlug.get(slug))
      .filter((row): row is (typeof rows)[number] => Boolean(row));
    const years = sourceRows.flatMap((row) => [row._min.year, row._max.year]).filter((year): year is number => year !== null);

    return {
      slug: source.slug,
      name: source.name,
      kind: source.kind,
      totalCases: sourceRows.reduce((total, row) => total + decimalToNumber(row._sum.value), 0),
      firstYear: years.length > 0 ? Math.min(...years) : null,
      lastYear: years.length > 0 ? Math.max(...years) : null
    };
  });
}

export async function getSourceSummary(sourceSlug: string) {
  const source = getPublicSourceBySlug(sourceSlug);

  if (!source) {
    return null;
  }

  const resolvedSourceIds = await getResolvedSourceIds(sourceSlug);

  if (resolvedSourceIds.length === 0) {
    return {
      city: ALLOWED_CITY,
      source,
      summary: emptySourceSummary(source.municipalityFilterStatus === "available")
    };
  }

  const where = {
    ...cityWhere(),
    sourceId: {
      in: resolvedSourceIds
    }
  };

  const [latestSyncJob, latestAvailability] = await Promise.all([
    prisma.syncJob.findFirst({
      where: {
        source: {
          slug: {
            in: getResolvedSourceSlugs(sourceSlug)
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.dataAvailability.findFirst({
      where: {
        source: {
          slug: {
            in: getResolvedSourceSlugs(sourceSlug)
          }
        }
      },
      orderBy: {
        checkedAt: "desc"
      }
    })
  ]);

  const [totalRecords, totalCases, yearBounds, latestYearRecord] = await Promise.all([
    prisma.epidemiologicalRecord.count({ where }),
    sumValues({
      ...where,
      sourceTable: {
        contains: YEARLY_SOURCE_TABLE_FRAGMENT
      }
    }),
    prisma.epidemiologicalRecord.aggregate({
      where: {
        ...where,
        year: {
          not: null
        }
      },
      _min: {
        year: true
      },
      _max: {
        year: true
      }
    }),
    prisma.epidemiologicalRecord.findFirst({
      where: {
        ...where,
        sourceTable: {
          contains: YEARLY_SOURCE_TABLE_FRAGMENT
        },
        year: {
          not: null
        }
      },
      orderBy: {
        year: "desc"
      },
      select: {
        year: true,
        value: true
      }
    })
  ]);

  return {
    city: ALLOWED_CITY,
    source,
    summary: {
      totalRecords,
      totalCases,
      firstAvailableYear: yearBounds._min.year,
      lastAvailableYear: yearBounds._max.year,
      latestYear: latestYearRecord?.year ?? null,
      latestYearValue: decimalToNumber(latestYearRecord?.value ?? null),
      lastUpdate: latestSyncJob?.finishedAt ?? null,
      lastSyncStatus: latestSyncJob?.status ?? null,
      municipalityDataAvailable: source.municipalityFilterStatus === "available",
      availabilityStatus: latestAvailability?.status ?? null
    }
  };
}

export async function getSourceFilters(sourceSlug: string) {
  const source = getPublicSourceBySlug(sourceSlug);

  if (!source) {
    return null;
  }

  const resolvedSourceIds = await getResolvedSourceIds(sourceSlug);

  if (resolvedSourceIds.length === 0) {
    return {
      city: ALLOWED_CITY,
      source,
      filters: {
        years: [],
        sex: [],
        ageGroups: [],
        raceColors: [],
        conditions: [],
        metrics: []
      }
    };
  }

  const where = {
    ...cityWhere(),
    sourceId: {
      in: resolvedSourceIds
    }
  };

  const [years, sex, ageGroups, raceColors, conditions, metrics] = await Promise.all([
    distinctRecordValues("year", where),
    distinctRecordValues("sex", where),
    distinctRecordValues("ageGroup", where),
    distinctRecordValues("raceColor", where),
    distinctRecordValues("diseaseOrCondition", where),
    distinctRecordValues("metric", where)
  ]);

  return {
    city: ALLOWED_CITY,
    source,
    filters: {
      years,
      sex,
      ageGroups: ageGroups.map(String).sort(compareAgeGroups),
      raceColors,
      conditions,
      metrics
    }
  };
}

export async function getRecords(filters: PublicFilters, pagination: Pagination) {
  const where = await buildRecordWhere(filters);
  const skip = (pagination.page - 1) * pagination.pageSize;

  const [total, records] = await Promise.all([
    prisma.epidemiologicalRecord.count({ where }),
    prisma.epidemiologicalRecord.findMany({
      where,
      orderBy: [
        {
          year: "desc"
        },
        {
          sourceTable: "asc"
        },
        {
          id: "asc"
        }
      ],
      skip,
      take: pagination.pageSize,
      include: {
        source: {
          select: {
            slug: true,
            name: true,
            system: true
          }
        }
      }
    })
  ]);

  return {
    city: ALLOWED_CITY,
    filters,
    aggregation: resolveRecordAggregation(filters),
    pagination: {
      ...pagination,
      total,
      totalPages: Math.ceil(total / pagination.pageSize)
    },
    records: records.map(serializeRecord)
  };
}

export async function getRecordsForExport(filters: PublicFilters) {
  const where = await buildRecordWhere(filters);

  const records = await prisma.epidemiologicalRecord.findMany({
    where,
    orderBy: [
      {
        year: "asc"
      },
      {
        sourceTable: "asc"
      },
      {
        id: "asc"
      }
    ],
    include: {
      source: {
        select: {
          slug: true,
          name: true,
          system: true
        }
      }
    }
  });

  return records.map(serializeRecord);
}

export async function getYearlyEvolution(sourceSlug?: string, filters: PublicFilters = {}) {
  const where = await buildChartWhere(sourceSlug, getYearlyChartSourceTableFragment(filters), filters);

  const rows = await prisma.epidemiologicalRecord.groupBy({
    by: ["year"],
    where,
    _sum: {
      value: true
    },
    orderBy: {
      year: "asc"
    }
  });

  return rows
    .filter((row) => row.year !== null)
    .map((row) => ({
      year: row.year as number,
      value: decimalToNumber(row._sum.value)
    }));
}

export async function getChartBySex(sourceSlug: string, filters: PublicFilters = {}) {
  const where = await buildChartWhere(sourceSlug, SEX_SOURCE_TABLE_FRAGMENT, onlyOwnDimension("sex", filters));

  const rows = await prisma.epidemiologicalRecord.groupBy({
    by: ["sex"],
    where,
    _sum: {
      value: true
    },
    orderBy: {
      sex: "asc"
    }
  });

  return rows
    .filter((row) => row.sex !== null)
    .map((row) => ({
      label: row.sex as string,
      value: decimalToNumber(row._sum.value)
    }));
}

export async function getChartByAgeGroup(sourceSlug: string, filters: PublicFilters = {}) {
  const where = await buildChartWhere(sourceSlug, AGE_GROUP_SOURCE_TABLE_FRAGMENT, onlyOwnDimension("ageGroup", filters));

  const rows = await prisma.epidemiologicalRecord.groupBy({
    by: ["ageGroup"],
    where,
    _sum: {
      value: true
    }
  });

  return rows
    .filter((row) => row.ageGroup !== null)
    .map((row) => ({
      label: row.ageGroup as string,
      value: decimalToNumber(row._sum.value)
    }))
    .sort((a, b) => compareAgeGroups(a.label, b.label));
}

export async function getChartByRaceColor(sourceSlug: string, filters: PublicFilters = {}) {
  const where = await buildChartWhere(sourceSlug, RACE_COLOR_SOURCE_TABLE_FRAGMENT, onlyOwnDimension("raceColor", filters));

  const rows = await prisma.epidemiologicalRecord.groupBy({
    by: ["raceColor"],
    where,
    _sum: {
      value: true
    },
    orderBy: {
      raceColor: "asc"
    }
  });

  return rows
    .filter((row) => row.raceColor !== null)
    .map((row) => ({
      label: row.raceColor as string,
      value: decimalToNumber(row._sum.value)
    }));
}

export function parsePagination(query: Record<string, unknown>): Pagination {
  return {
    page: parsePositiveInteger(query.page, 1, 1, 100000),
    pageSize: parsePositiveInteger(query.pageSize, 50, 1, 500)
  };
}

export function parseFilters(query: Record<string, unknown>): PublicFilters {
  return {
    source: parseString(query.source),
    year: parseOptionalInteger(query.year),
    month: parseOptionalInteger(query.month),
    sex: parseString(query.sex),
    ageGroup: parseString(query.ageGroup),
    raceColor: parseString(query.raceColor),
    condition: parseString(query.condition),
    aggregation: parseAggregation(query.aggregation)
  };
}

/**
 * Visão usada na tabela e no CSV. Sem escolha explícita, segue o filtro demográfico
 * (sexo, faixa etária ou raça/cor); sem filtro demográfico, usa o total do ano.
 */
export function resolveRecordAggregation(filters: PublicFilters): RecordAggregation {
  if (filters.aggregation) {
    return filters.aggregation;
  }

  return getDemographicAggregation(filters) ?? "yearly";
}

/**
 * Retorna uma mensagem de erro quando a visão pedida não combina com o filtro demográfico
 * (ex.: filtro de sexo com visão por faixa etária, que sempre viria vazio).
 */
export function getAggregationConflict(filters: PublicFilters): string | null {
  const demographicConflict = getDemographicFilterConflict(filters);

  if (demographicConflict) {
    return demographicConflict;
  }

  const demographic = getDemographicAggregation(filters);

  if (filters.aggregation && filters.aggregation !== "all" && demographic && filters.aggregation !== demographic) {
    return "A visão escolhida não combina com o filtro aplicado. Use a visão da mesma dimensão do filtro.";
  }

  return null;
}

/** O DATASUS fornece totais de uma dimensão por vez: sexo, faixa etária e raça/cor nunca se cruzam. */
export function getDemographicFilterConflict(filters: PublicFilters): string | null {
  const demographicFilters = [filters.sex, filters.ageGroup, filters.raceColor].filter(Boolean);

  if (demographicFilters.length > 1) {
    return "O DATASUS não fornece dados cruzados: filtre por apenas uma dimensão (sexo, faixa etária ou raça/cor).";
  }

  return null;
}

export type DemographicFilterKey = "sex" | "ageGroup" | "raceColor";

/**
 * Filtros demográficos que um gráfico de dimensão não consegue aplicar. Ex.: o gráfico por
 * faixa etária não tem os casos separados por sexo, então ignora o filtro de sexo e mostra
 * a distribuição de todas as pessoas (a interface avisa).
 */
export function getIgnoredChartFilters(
  chartDimension: DemographicFilterKey,
  filters: PublicFilters
): DemographicFilterKey[] {
  return (["sex", "ageGroup", "raceColor"] as const).filter(
    (key) => key !== chartDimension && Boolean(filters[key])
  );
}

function onlyOwnDimension(chartDimension: DemographicFilterKey, filters: PublicFilters): PublicFilters {
  return {
    ...filters,
    sex: chartDimension === "sex" ? filters.sex : undefined,
    ageGroup: chartDimension === "ageGroup" ? filters.ageGroup : undefined,
    raceColor: chartDimension === "raceColor" ? filters.raceColor : undefined
  };
}

function getDemographicAggregation(filters: PublicFilters): ResolvedAggregation | null {
  if (filters.sex) {
    return "sex";
  }

  if (filters.ageGroup) {
    return "age_group";
  }

  if (filters.raceColor) {
    return "race_color";
  }

  return null;
}

export function toRecordsCsv(records: SerializedRecord[]): string {
  const headers = [
    "source_slug",
    "source_name",
    "city",
    "city_ibge_code",
    "state_code",
    "year",
    "month",
    "condition",
    "metric",
    "value",
    "sex",
    "age_group",
    "race_color",
    "source_table",
    "aggregation",
    "imported_at"
  ];

  const rows = records.map((record) => [
    record.source.slug,
    record.source.name,
    record.city.name,
    record.city.ibgeCode,
    record.city.uf,
    record.year,
    record.month,
    record.diseaseOrCondition,
    record.metric,
    record.value,
    record.sex,
    record.ageGroup,
    record.raceColor,
    record.sourceTable,
    record.aggregation,
    record.importedAt.toISOString()
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

async function buildRecordWhere(filters: PublicFilters): Promise<Prisma.EpidemiologicalRecordWhereInput> {
  const where: Prisma.EpidemiologicalRecordWhereInput = baseCityRecordWhere();
  const aggregation = resolveRecordAggregation(filters);

  if (aggregation !== "all") {
    where.sourceTable = {
      contains: AGGREGATION_SOURCE_TABLE_FRAGMENTS[aggregation]
    };
  }

  if (filters.source) {
    const sourceIds = await getResolvedSourceIds(filters.source);
    where.sourceId = sourceIds.length > 0 ? { in: sourceIds } : -1;
  } else {
    // Sem fonte: só as primárias públicas (como a visão geral); a zika é interna (S12).
    where.source = { slug: { in: visibleOverviewSlugs() } };
  }

  if (filters.year !== undefined) {
    where.year = filters.year;
  }

  if (filters.month !== undefined) {
    where.month = filters.month;
  }

  if (filters.sex) {
    where.sex = filters.sex;
  }

  if (filters.ageGroup) {
    where.ageGroup = filters.ageGroup;
  }

  if (filters.raceColor) {
    where.raceColor = filters.raceColor;
  }

  if (filters.condition) {
    where.diseaseOrCondition = filters.condition;
  }

  return where;
}

async function buildChartWhere(
  sourceSlug: string | undefined,
  sourceTableFragment: string,
  filters: PublicFilters = {}
): Promise<Prisma.EpidemiologicalRecordWhereInput> {
  const where: Prisma.EpidemiologicalRecordWhereInput = {
    ...baseCityRecordWhere(),
    year: {
      not: null
    },
    sourceTable: {
      contains: sourceTableFragment
    }
  };

  if (sourceSlug) {
    const sourceIds = await getResolvedSourceIds(sourceSlug);
    where.sourceId = sourceIds.length > 0 ? { in: sourceIds } : -1;
  }

  if (filters.year !== undefined) {
    where.year = filters.year;
  }

  if (filters.month !== undefined) {
    where.month = filters.month;
  }

  if (filters.sex) {
    where.sex = filters.sex;
  }

  if (filters.ageGroup) {
    where.ageGroup = filters.ageGroup;
  }

  if (filters.raceColor) {
    where.raceColor = filters.raceColor;
  }

  if (filters.condition) {
    where.diseaseOrCondition = filters.condition;
  }

  return where;
}

function getYearlyChartSourceTableFragment(filters: PublicFilters): string {
  if (filters.sex) {
    return SEX_SOURCE_TABLE_FRAGMENT;
  }

  if (filters.ageGroup) {
    return AGE_GROUP_SOURCE_TABLE_FRAGMENT;
  }

  if (filters.raceColor) {
    return RACE_COLOR_SOURCE_TABLE_FRAGMENT;
  }

  return YEARLY_SOURCE_TABLE_FRAGMENT;
}

function cityWhere(): Prisma.EpidemiologicalRecordWhereInput {
  return {
    cityIbgeCode: ALLOWED_CITY.ibgeCode,
    city: ALLOWED_CITY.name,
    stateCode: ALLOWED_CITY.uf
  };
}

function baseCityRecordWhere(): Prisma.EpidemiologicalRecordWhereInput {
  return {
    ...cityWhere(),
    source: {
      slug: {
        in: baseSourceSlugs
      }
    }
  };
}

function getResolvedSourceSlugs(sourceSlug: string): string[] {
  const source = getSourceBySlug(sourceSlug);

  return source ? [source.slug] : [];
}

async function getResolvedSourceIds(sourceSlug: string): Promise<number[]> {
  const sourceSlugs = getResolvedSourceSlugs(sourceSlug);

  if (sourceSlugs.length === 0) {
    return [];
  }

  const rows = await prisma.dataSource.findMany({
    where: {
      slug: {
        in: sourceSlugs
      }
    },
    select: {
      id: true
    }
  });

  return rows.map((row) => row.id);
}

async function sumValues(where: Prisma.EpidemiologicalRecordWhereInput): Promise<number> {
  const result = await prisma.epidemiologicalRecord.aggregate({
    where,
    _sum: {
      value: true
    }
  });

  return decimalToNumber(result._sum.value);
}

async function distinctRecordValues(
  field:
    | "year"
    | "sex"
    | "ageGroup"
    | "raceColor"
    | "diseaseOrCondition"
    | "metric",
  where: Prisma.EpidemiologicalRecordWhereInput
) {
  const rows = await prisma.epidemiologicalRecord.findMany({
    where: {
      ...where,
      [field]: {
        not: null
      }
    },
    distinct: [field],
    orderBy: {
      [field]: "asc"
    },
    select: {
      [field]: true
    }
  });

  return rows
    .map((row) => (row as unknown as Record<string, unknown>)[field])
    .filter((value) => value !== null && value !== undefined) as Array<string | number>;
}

function serializeRecord(
  record: EpidemiologicalRecord & {
    source: {
      slug: string;
      name: string;
      system: string;
    };
  }
): SerializedRecord {
  return {
    id: record.id,
    source: record.source,
    city: ALLOWED_CITY,
    year: record.year,
    month: record.month,
    diseaseOrCondition: record.diseaseOrCondition,
    metric: record.metric,
    value: decimalToNumber(record.value),
    sex: record.sex,
    ageGroup: record.ageGroup,
    raceColor: record.raceColor,
    dimensions: record.dimensions,
    sourceTable: record.sourceTable,
    aggregation: getAggregationFromSourceTable(record.sourceTable),
    importedAt: record.importedAt
  };
}

function getAggregationFromSourceTable(sourceTable: string | null): ResolvedAggregation | null {
  if (!sourceTable) {
    return null;
  }

  const match = (Object.entries(AGGREGATION_SOURCE_TABLE_FRAGMENTS) as Array<[ResolvedAggregation, string]>).find(
    ([, fragment]) => sourceTable.includes(fragment)
  );

  return match?.[0] ?? null;
}

function emptySourceSummary(municipalityDataAvailable: boolean) {
  return {
    totalRecords: 0,
    totalCases: 0,
    firstAvailableYear: null,
    lastAvailableYear: null,
    latestYear: null,
    latestYearValue: null,
    lastUpdate: null,
    lastSyncStatus: null,
    municipalityDataAvailable,
    availabilityStatus: null
  };
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  return value ? Number(value) : 0;
}

function parseString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseAggregation(value: unknown): RecordAggregation | undefined {
  return RECORD_AGGREGATIONS.find((aggregation) => aggregation === value);
}

function parseOptionalInteger(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function compareAgeGroups(left: string, right: string): number {
  const leftIndex = AGE_GROUP_ORDER.indexOf(left);
  const rightIndex = AGE_GROUP_ORDER.indexOf(right);

  if (leftIndex !== -1 && rightIndex !== -1) {
    return leftIndex - rightIndex;
  }

  if (leftIndex !== -1) {
    return -1;
  }

  if (rightIndex !== -1) {
    return 1;
  }

  return left.localeCompare(right);
}
