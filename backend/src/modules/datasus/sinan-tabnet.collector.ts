import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { ALLOWED_CITY } from "../../config/city";
import { postTabnetPrn } from "./tabnet-client";
import { parsePrnTable } from "./tabnet-prn";

const TABNET_CITY_CODE = "220770";
const TABNET_CITY_OPTION_VALUE = "827";
const DEFAULT_LINE_ENCODED = "Ano_Diagn%F3stico";
const DEFAULT_LINE_LABEL = "Ano_Diagnostico";
const DEFAULT_MUNICIPALITY_RESIDENCE_FILTER = "SMunic%EDpio_de_resid%EAncia";

type QueryDefinition = {
  name: string;
  columnEncoded: string;
  columnLabel: string;
  sourceTable: string;
  aggregationType: "yearly" | "by_sex" | "by_age_group" | "by_race_color";
};

type SinanTabnetCollectorConfig = {
  sourceSlug: string;
  diseaseOrCondition: string;
  metric: string;
  tabnetQueryUrl: string;
  periodFiles: string[];
  lineEncoded?: string;
  lineLabel?: string;
  incrementEncoded: string;
  incrementLabel: string;
  sourceTablePrefix: string;
  ageGroupColumnEncoded: string;
  ageGroupColumnLabel: string;
  municipalityResidenceFilterEncoded?: string;
  municipalityResidenceOptionValue?: string;
};

type NormalizedRecord = {
  year: number;
  value: number;
  sex: string | null;
  ageGroup: string | null;
  raceColor: string | null;
  sourceTable: string;
  recordKey: string;
  dimensions: Prisma.InputJsonValue;
};

export type SinanCollectorResult = {
  recordsImported: number;
  rawImportsCreated: number;
};

const collectorConfigs: Record<string, SinanTabnetCollectorConfig> = {
  tuberculose_sinan: {
    sourceSlug: "tuberculose_sinan",
    diseaseOrCondition: "Tuberculose",
    metric: "casos_confirmados",
    tabnetQueryUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/tubercbr.def",
    periodFiles: numberedFiles("tubebr", 1, 25),
    incrementEncoded: "Casos_confirmados",
    incrementLabel: "Casos_confirmados",
    sourceTablePrefix: "tabnet_tuberculose",
    ageGroupColumnEncoded: "Fx_Et%E1ria",
    ageGroupColumnLabel: "Fx Etaria"
  },
  hanseniase_sinan: {
    sourceSlug: "hanseniase_sinan",
    diseaseOrCondition: "Hanseniase",
    metric: "frequencia",
    tabnetQueryUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/hanswbr.def",
    periodFiles: numberedFiles("hansbr", 1, 26),
    incrementEncoded: "Frequ%EAncia",
    incrementLabel: "Frequencia",
    sourceTablePrefix: "tabnet_hanseniase",
    ageGroupColumnEncoded: "Faixa_Et%E1ria_Hans",
    ageGroupColumnLabel: "Faixa Etaria Hans"
  },
  sifilis_congenita_sinan: {
    sourceSlug: "sifilis_congenita_sinan",
    diseaseOrCondition: "Sifilis congenita",
    metric: "casos_confirmados",
    tabnetQueryUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/sifilisbr.def",
    periodFiles: numberedFiles("sifcbr", 7, 24),
    incrementEncoded: "Casos_confirmados",
    incrementLabel: "Casos_confirmados",
    sourceTablePrefix: "tabnet_sifilis_congenita",
    ageGroupColumnEncoded: "Faixa_Et%E1ria",
    ageGroupColumnLabel: "Faixa Etaria"
  },
  dengue_sinan: {
    sourceSlug: "dengue_sinan",
    diseaseOrCondition: "Dengue",
    metric: "casos_provaveis",
    tabnetQueryUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/denguebr.def",
    periodFiles: numberedFiles("dengbr", 7, 13),
    lineEncoded: "Ano_1%BA_Sintoma(s)",
    lineLabel: "Ano_1o_Sintoma(s)",
    incrementEncoded: "Casos_Prov%E1veis",
    incrementLabel: "Casos_Provaveis",
    sourceTablePrefix: "tabnet_dengue",
    ageGroupColumnEncoded: "Faixa_Et%E1ria",
    ageGroupColumnLabel: "Faixa Etaria"
  },
  sifilis_gestacional_sinan: {
    sourceSlug: "sifilis_gestacional_sinan",
    diseaseOrCondition: "Sifilis gestacional",
    metric: "casos_confirmados",
    tabnetQueryUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/sifilisgestantepi.def",
    periodFiles: numberedFiles("sifgpi", 7, 24),
    lineEncoded: "Ano_de_Diagn%F3stico",
    lineLabel: "Ano de Diagnostico",
    incrementEncoded: "Casos_confirmados",
    incrementLabel: "Casos_confirmados",
    sourceTablePrefix: "tabnet_sifilis_gestacional",
    ageGroupColumnEncoded: "Faixa_Et%E1ria",
    ageGroupColumnLabel: "Faixa Etaria",
    municipalityResidenceOptionValue: "152"
  },
  zika_sinan: {
    sourceSlug: "zika_sinan",
    diseaseOrCondition: "Zika",
    metric: "todos_os_casos",
    tabnetQueryUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/zikabr.def",
    periodFiles: numberedFiles("zikabr", 15, 26),
    lineEncoded: "Ano_1%BA_Sintoma(s)",
    lineLabel: "Ano_1o_Sintoma(s)",
    incrementEncoded: "Todos_os_casos",
    incrementLabel: "Todos_os_casos",
    sourceTablePrefix: "tabnet_zika",
    ageGroupColumnEncoded: "Faixa_Et%E1ria",
    ageGroupColumnLabel: "Faixa Etaria"
  }
};

export function hasSinanCollector(sourceSlug: string): boolean {
  return Boolean(collectorConfigs[sourceSlug]);
}

export async function collectSinanTabnetSource(
  sourceSlug: string,
  prisma: PrismaClient,
  sourceId: number,
  syncJobId: number
): Promise<SinanCollectorResult> {
  const config = collectorConfigs[sourceSlug];

  if (!config) {
    throw new Error(`Coletor SINAN/TABNET nao configurado para a fonte ${sourceSlug}.`);
  }

  let recordsImported = 0;
  let rawImportsCreated = 0;

  for (const queryDefinition of buildQueryDefinitions(config)) {
    const encodedFormBody = buildEncodedFormBody(config, queryDefinition);
    const tabnetResponse = await postTabnetPrn(config.tabnetQueryUrl, encodedFormBody);
    const normalizedRecords = parseSinanRecords(config, queryDefinition, tabnetResponse.html);
    const storedPath = await storeRawImport(config.sourceSlug, queryDefinition.name, tabnetResponse.html);

    await prisma.rawImport.create({
      data: {
        sourceId,
        syncJobId,
        requestUrl: tabnetResponse.requestUrl,
        requestParams: buildRequestParams(config, queryDefinition),
        responseFormat: tabnetResponse.responseFormat,
        contentHash: tabnetResponse.contentHash,
        storedPath,
        rowCount: normalizedRecords.length
      }
    });

    rawImportsCreated += 1;

    for (const record of normalizedRecords) {
      await prisma.epidemiologicalRecord.upsert({
        where: {
          recordKey: record.recordKey
        },
        update: {
          syncJobId,
          value: record.value,
          sex: record.sex,
          ageGroup: record.ageGroup,
          raceColor: record.raceColor,
          dimensions: record.dimensions,
          importedAt: new Date()
        },
        create: {
          sourceId,
          syncJobId,
          state: ALLOWED_CITY.state,
          stateCode: ALLOWED_CITY.uf,
          city: ALLOWED_CITY.name,
          cityIbgeCode: ALLOWED_CITY.ibgeCode,
          year: record.year,
          month: null,
          diseaseOrCondition: config.diseaseOrCondition,
          metric: config.metric,
          value: record.value,
          sex: record.sex,
          ageGroup: record.ageGroup,
          raceColor: record.raceColor,
          dimensions: record.dimensions,
          sourceTable: record.sourceTable,
          recordKey: record.recordKey
        }
      });

      recordsImported += 1;
    }
  }

  return {
    recordsImported,
    rawImportsCreated
  };
}

function buildQueryDefinitions(config: SinanTabnetCollectorConfig): QueryDefinition[] {
  return [
    {
      name: "yearly",
      columnEncoded: "--N%E3o-Ativa--",
      columnLabel: "Nao ativa",
      sourceTable: `${config.sourceTablePrefix}_yearly_residence`,
      aggregationType: "yearly"
    },
    {
      name: "by_sex",
      columnEncoded: "Sexo",
      columnLabel: "Sexo",
      sourceTable: `${config.sourceTablePrefix}_by_sex_residence`,
      aggregationType: "by_sex"
    },
    {
      name: "by_age_group",
      columnEncoded: config.ageGroupColumnEncoded,
      columnLabel: config.ageGroupColumnLabel,
      sourceTable: `${config.sourceTablePrefix}_by_age_group_residence`,
      aggregationType: "by_age_group"
    },
    {
      name: "by_race_color",
      columnEncoded: "Ra%E7a",
      columnLabel: "Raca",
      sourceTable: `${config.sourceTablePrefix}_by_race_color_residence`,
      aggregationType: "by_race_color"
    }
  ];
}

function buildEncodedFormBody(
  config: SinanTabnetCollectorConfig,
  queryDefinition: QueryDefinition
): string {
  const municipalityOptionValue =
    config.municipalityResidenceOptionValue ?? TABNET_CITY_OPTION_VALUE;

  return [
    `Linha=${config.lineEncoded ?? DEFAULT_LINE_ENCODED}`,
    `Coluna=${queryDefinition.columnEncoded}`,
    `Incremento=${config.incrementEncoded}`,
    ...config.periodFiles.map((file) => `Arquivos=${file}`),
    `${config.municipalityResidenceFilterEncoded ?? DEFAULT_MUNICIPALITY_RESIDENCE_FILTER}=${municipalityOptionValue}`,
    "formato=prn",
    "mostre=Mostra"
  ].join("&");
}

function buildRequestParams(
  config: SinanTabnetCollectorConfig,
  queryDefinition: QueryDefinition
): Prisma.InputJsonValue {
  const municipalityOptionValue =
    config.municipalityResidenceOptionValue ?? TABNET_CITY_OPTION_VALUE;

  return {
    queryName: queryDefinition.name,
    line: config.lineLabel ?? DEFAULT_LINE_LABEL,
    column: queryDefinition.columnLabel,
    increment: config.incrementLabel,
    periodFiles: config.periodFiles,
    municipalityFilter: {
      type: "municipio_residencia",
      tabnetCode: TABNET_CITY_CODE,
      tabnetOptionValue: municipalityOptionValue,
      cityIbgeCode: ALLOWED_CITY.ibgeCode,
      city: ALLOWED_CITY.name,
      uf: ALLOWED_CITY.uf
    },
    format: "prn"
  };
}

function parseSinanRecords(
  config: SinanTabnetCollectorConfig,
  queryDefinition: QueryDefinition,
  html: string
): NormalizedRecord[] {
  const table = parsePrnTable(html);
  const records: NormalizedRecord[] = [];

  for (const row of table.rows) {
    const year = parseYear(row[0]);

    if (!year) {
      continue;
    }

    if (queryDefinition.aggregationType === "yearly") {
      const value = parseTabnetNumber(row[1]);

      if (value === null) {
        continue;
      }

      records.push(
        buildRecord(config, queryDefinition, year, value, {
          sex: null,
          ageGroup: null,
          raceColor: null
        })
      );
      continue;
    }

    for (let columnIndex = 1; columnIndex < table.headers.length; columnIndex += 1) {
      const category = table.headers[columnIndex];

      if (isTotalLabel(category)) {
        continue;
      }

      const value = parseTabnetNumber(row[columnIndex]);

      if (value === null) {
        continue;
      }

      records.push(
        buildRecord(config, queryDefinition, year, value, {
          sex: queryDefinition.aggregationType === "by_sex" ? normalizeSex(category) : null,
          ageGroup:
            queryDefinition.aggregationType === "by_age_group"
              ? normalizeAgeGroup(category)
              : null,
          raceColor:
            queryDefinition.aggregationType === "by_race_color"
              ? normalizeRaceColor(category)
              : null
        })
      );
    }
  }

  return records;
}

function buildRecord(
  config: SinanTabnetCollectorConfig,
  queryDefinition: QueryDefinition,
  year: number,
  value: number,
  dimensions: Pick<NormalizedRecord, "sex" | "ageGroup" | "raceColor">
): NormalizedRecord {
  const baseDimensions = {
    aggregationType: queryDefinition.aggregationType,
    locationType: "municipio_residencia",
    tabnetMunicipalityCode: TABNET_CITY_CODE,
    tabnetMunicipalityOptionValue:
      config.municipalityResidenceOptionValue ?? TABNET_CITY_OPTION_VALUE
  };

  return {
    year,
    value,
    sex: dimensions.sex,
    ageGroup: dimensions.ageGroup,
    raceColor: dimensions.raceColor,
    sourceTable: queryDefinition.sourceTable,
    dimensions: {
      ...baseDimensions,
      sex: dimensions.sex,
      ageGroup: dimensions.ageGroup,
      raceColor: dimensions.raceColor
    },
    recordKey: createRecordKey(config, queryDefinition, year, dimensions)
  };
}

function createRecordKey(
  config: SinanTabnetCollectorConfig,
  queryDefinition: QueryDefinition,
  year: number,
  dimensions: Pick<NormalizedRecord, "sex" | "ageGroup" | "raceColor">
): string {
  return createHash("sha256")
    .update(
      [
        config.sourceSlug,
        queryDefinition.sourceTable,
        ALLOWED_CITY.ibgeCode,
        year,
        dimensions.sex ?? "",
        dimensions.ageGroup ?? "",
        dimensions.raceColor ?? ""
      ].join("|")
    )
    .digest("hex");
}

function parseYear(value: string | undefined): number | null {
  if (!value || isTotalLabel(value)) {
    return null;
  }

  const year = Number.parseInt(value, 10);
  return Number.isInteger(year) && year >= 1900 ? year : null;
}

function parseTabnetNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized || normalized === "-") {
    return 0;
  }

  const number = Number(normalized.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function normalizeSex(value: string): string {
  const comparable = normalizeComparable(value);

  if (comparable === "masculino") {
    return "Masculino";
  }

  if (comparable === "feminino") {
    return "Feminino";
  }

  if (comparable.includes("branco")) {
    return "Em branco";
  }

  if (comparable.includes("ignorado")) {
    return "Ignorado";
  }

  return value.trim();
}

function normalizeAgeGroup(value: string): string {
  const trimmed = value.trim();
  const comparable = normalizeComparable(trimmed);

  if (comparable.includes("branco") || comparable.includes("ign")) {
    return "Ignorado";
  }

  if (comparable === "<1 ano" || comparable === "menor 1 ano") {
    return "Menor de 1 ano";
  }

  if (comparable === "80 e +") {
    return "80 anos e mais";
  }

  return trimmed;
}

function normalizeRaceColor(value: string): string {
  const comparable = normalizeComparable(value);

  if (comparable.includes("branco") || comparable.includes("ign")) {
    return "Ignorado";
  }

  if (comparable === "branca") {
    return "Branca";
  }

  if (comparable === "preta") {
    return "Preta";
  }

  if (comparable === "amarela") {
    return "Amarela";
  }

  if (comparable === "parda") {
    return "Parda";
  }

  if (comparable === "indigena") {
    return "Indigena";
  }

  return value.trim();
}

function isTotalLabel(value: string): boolean {
  return normalizeComparable(value) === "total";
}

function normalizeComparable(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function storeRawImport(sourceSlug: string, queryName: string, html: string): Promise<string> {
  const storageDir = getRawImportStorageDir(sourceSlug);
  await mkdir(storageDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${timestamp}_${sourceSlug}_${queryName}.html`;
  const filePath = path.join(storageDir, fileName);

  await writeFile(filePath, html, "latin1");

  return path.relative(process.cwd(), filePath);
}

function getRawImportStorageDir(sourceSlug: string): string {
  const cwd = process.cwd();
  const backendRoot = path.basename(cwd) === "backend" ? cwd : path.join(cwd, "backend");
  return path.join(backendRoot, "storage", "raw-imports", sourceSlug);
}

function numberedFiles(prefix: string, start: number, end: number): string[] {
  return Array.from({ length: end - start + 1 }, (_item, index) => {
    const suffix = String(start + index).padStart(2, "0");
    return `${prefix}${suffix}.dbf`;
  });
}
