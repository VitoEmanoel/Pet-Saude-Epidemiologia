import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { ALLOWED_CITY } from "../../config/city";
import { postTabnetPrn } from "./tabnet-client";
import { parsePrnTable } from "./tabnet-prn";

const SOURCE_SLUG = "tuberculose_sinan";
const DISEASE_OR_CONDITION = "Tuberculose";
const METRIC = "casos_confirmados";
const TABNET_QUERY_URL = "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/tubercbr.def";
const TABNET_CITY_CODE = "220770";
const TABNET_CITY_OPTION_VALUE = "827";

type QueryDefinition = {
  name: string;
  columnEncoded: string;
  columnLabel: string;
  sourceTable: string;
  aggregationType: "yearly" | "by_sex" | "by_age_group" | "by_race_color";
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

export type TuberculosisCollectorResult = {
  recordsImported: number;
  rawImportsCreated: number;
};

const QUERY_DEFINITIONS: QueryDefinition[] = [
  {
    name: "yearly",
    columnEncoded: "--N%E3o-Ativa--",
    columnLabel: "Não ativa",
    sourceTable: "tabnet_tuberculose_yearly_residence",
    aggregationType: "yearly"
  },
  {
    name: "by_sex",
    columnEncoded: "Sexo",
    columnLabel: "Sexo",
    sourceTable: "tabnet_tuberculose_by_sex_residence",
    aggregationType: "by_sex"
  },
  {
    name: "by_age_group",
    columnEncoded: "Fx_Et%E1ria",
    columnLabel: "Fx Etaria",
    sourceTable: "tabnet_tuberculose_by_age_group_residence",
    aggregationType: "by_age_group"
  },
  {
    name: "by_race_color",
    columnEncoded: "Ra%E7a",
    columnLabel: "Raca",
    sourceTable: "tabnet_tuberculose_by_race_color_residence",
    aggregationType: "by_race_color"
  }
];

const PERIOD_FILES = Array.from({ length: 25 }, (_item, index) => {
  const yearSuffix = String(index + 1).padStart(2, "0");
  return `tubebr${yearSuffix}.dbf`;
});

export async function collectTuberculosisSinan(
  prisma: PrismaClient,
  sourceId: number,
  syncJobId: number
): Promise<TuberculosisCollectorResult> {
  let recordsImported = 0;
  let rawImportsCreated = 0;

  for (const queryDefinition of QUERY_DEFINITIONS) {
    const encodedFormBody = buildEncodedFormBody(queryDefinition);
    const tabnetResponse = await postTabnetPrn(TABNET_QUERY_URL, encodedFormBody);
    const normalizedRecords = parseTuberculosisRecords(queryDefinition, tabnetResponse.html);
    const storedPath = await storeRawImport(queryDefinition.name, tabnetResponse.html);

    await prisma.rawImport.create({
      data: {
        sourceId,
        syncJobId,
        requestUrl: tabnetResponse.requestUrl,
        requestParams: buildRequestParams(queryDefinition),
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
          diseaseOrCondition: DISEASE_OR_CONDITION,
          metric: METRIC,
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

function buildEncodedFormBody(queryDefinition: QueryDefinition): string {
  return [
    "Linha=Ano_Diagn%F3stico",
    `Coluna=${queryDefinition.columnEncoded}`,
    "Incremento=Casos_confirmados",
    ...PERIOD_FILES.map((file) => `Arquivos=${file}`),
    `SMunic%EDpio_de_resid%EAncia=${TABNET_CITY_OPTION_VALUE}`,
    "formato=prn",
    "mostre=Mostra"
  ].join("&");
}

function buildRequestParams(queryDefinition: QueryDefinition): Prisma.InputJsonValue {
  return {
    queryName: queryDefinition.name,
    line: "Ano_Diagnostico",
    column: queryDefinition.columnLabel,
    increment: "Casos_confirmados",
    periodFiles: PERIOD_FILES,
    municipalityFilter: {
      type: "municipio_residencia",
      tabnetCode: TABNET_CITY_CODE,
      tabnetOptionValue: TABNET_CITY_OPTION_VALUE,
      cityIbgeCode: ALLOWED_CITY.ibgeCode,
      city: ALLOWED_CITY.name,
      uf: ALLOWED_CITY.uf
    },
    format: "prn"
  };
}

function parseTuberculosisRecords(
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
        buildRecord(queryDefinition, year, value, {
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
        buildRecord(queryDefinition, year, value, {
          sex:
            queryDefinition.aggregationType === "by_sex" ? normalizeSex(category) : null,
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
  queryDefinition: QueryDefinition,
  year: number,
  value: number,
  dimensions: Pick<NormalizedRecord, "sex" | "ageGroup" | "raceColor">
): NormalizedRecord {
  const baseDimensions = {
    aggregationType: queryDefinition.aggregationType,
    locationType: "municipio_residencia",
    tabnetMunicipalityCode: TABNET_CITY_CODE,
    tabnetMunicipalityOptionValue: TABNET_CITY_OPTION_VALUE
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
    recordKey: createRecordKey(queryDefinition, year, dimensions)
  };
}

function createRecordKey(
  queryDefinition: QueryDefinition,
  year: number,
  dimensions: Pick<NormalizedRecord, "sex" | "ageGroup" | "raceColor">
): string {
  return createHash("sha256")
    .update(
      [
        SOURCE_SLUG,
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

  if (comparable === "<1 ano") {
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

async function storeRawImport(queryName: string, html: string): Promise<string> {
  const storageDir = getRawImportStorageDir();
  await mkdir(storageDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${timestamp}_${SOURCE_SLUG}_${queryName}.html`;
  const filePath = path.join(storageDir, fileName);

  await writeFile(filePath, html, "latin1");

  return path.relative(process.cwd(), filePath);
}

function getRawImportStorageDir(): string {
  const cwd = process.cwd();
  const backendRoot = path.basename(cwd) === "backend" ? cwd : path.join(cwd, "backend");
  return path.join(backendRoot, "storage", "raw-imports", SOURCE_SLUG);
}

