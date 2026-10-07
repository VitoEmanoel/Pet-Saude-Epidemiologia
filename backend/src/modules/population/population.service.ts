import { prisma } from "../../database/prisma";

// População residente por ano (A4). A planilha enviada pelo admin substitui a tabela inteira.

export type PopulationRow = {
  year: number;
  population: number;
  population60Plus: number | null;
};

export type PopulationParseResult = {
  rows: PopulationRow[];
  errors: string[];
  /** Avisos que não impedem gravar (ex.: coluna ignorada, sem a coluna de 60+). */
  warnings: string[];
  /** Nome de cada coluna como veio na planilha (null = não encontrada). */
  columns: { year: string | null; population: string | null; population60Plus: string | null };
};

export type PopulationDiff = {
  added: number[];
  changed: number[];
  removed: number[];
  unchanged: number[];
};

const MIN_YEAR = 1980;
const MAX_YEAR = 2100;
export const POPULATION_CSV_HEADER = "ano;populacao;populacao_60_mais";

/** "153.482", "153482" ou "153 482" → 153482; qualquer outra coisa → null. */
function parseCount(raw: string): number | null {
  const value = raw.trim().replace(/\s/g, "");

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    return Number(value.replace(/\./g, ""));
  }

  return null;
}

type ColumnKind = "year" | "population" | "population60Plus";

/** "População 60+" → "populacao_60": sem acento, minúsculas, só letras, números e "_". */
function normalizeHeader(cell: string) {
  return cell
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^"|"$/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Qual coluna é, aceitando os nomes que as pessoas costumam usar: "Ano"; "População",
 * "populacao_total", "Habitantes"; "População 60+", "60 anos ou mais", "Idosos".
 */
function classifyHeader(normalized: string): ColumnKind | null {
  if (normalized === "ano" || normalized === "anos" || normalized.startsWith("ano_")) {
    return "year";
  }

  if (/60|idos/.test(normalized)) {
    return "population60Plus";
  }

  if (/^pop|populac|habitant|residente/.test(normalized)) {
    return "population";
  }

  return null;
}

const COLUMN_LABELS: Record<ColumnKind, string> = {
  year: "ano",
  population: "população",
  population60Plus: "população de 60 anos ou mais"
};

/**
 * Lê a planilha: colunas de ano e população (obrigatórias) e de 60 anos ou mais (opcional),
 * separadas por `;` ou `,`, com os nomes do modelo (`ano;populacao;populacao_60_mais`) ou
 * variações comuns (acentos, maiúsculas, "60+", "idosos"). Linhas vazias são ignoradas.
 * Nunca estima nem completa valores; o que não reconhece vira aviso, não chute.
 */
export function parsePopulationCsv(text: string): PopulationParseResult {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const errors: string[] = [];
  const warnings: string[] = [];
  const noColumns = { year: null, population: null, population60Plus: null };

  if (lines.length === 0) {
    return { rows: [], errors: ["A planilha está vazia."], warnings, columns: noColumns };
  }

  const separator = lines[0].includes(";") ? ";" : ",";
  const rawHeader = lines[0].split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""));
  const indexes: Record<ColumnKind, number> = { year: -1, population: -1, population60Plus: -1 };

  rawHeader.forEach((cell, index) => {
    const kind = classifyHeader(normalizeHeader(cell));

    if (!kind) {
      if (cell !== "") {
        warnings.push(`A coluna "${cell}" não foi reconhecida e foi ignorada.`);
      }
      return;
    }

    if (indexes[kind] !== -1) {
      errors.push(
        `Duas colunas parecem ser a de ${COLUMN_LABELS[kind]} ("${rawHeader[indexes[kind]]}" e "${cell}"). Deixe só uma.`
      );
      return;
    }

    indexes[kind] = index;
  });

  const columns = {
    year: indexes.year === -1 ? null : rawHeader[indexes.year],
    population: indexes.population === -1 ? null : rawHeader[indexes.population],
    population60Plus: indexes.population60Plus === -1 ? null : rawHeader[indexes.population60Plus]
  };

  if (indexes.year === -1 || indexes.population === -1) {
    errors.unshift(
      `Cabeçalho inválido: não achei a coluna de ${indexes.year === -1 ? "ano" : "população"}. ` +
        `A primeira linha deve ser como no modelo: ${POPULATION_CSV_HEADER} (a última é opcional).`
    );
  }

  if (errors.length > 0) {
    return { rows: [], errors, warnings, columns };
  }

  if (indexes.population60Plus === -1) {
    warnings.push(
      "A planilha não tem a coluna de população de 60 anos ou mais: a incidência em idosos (chikungunya) vai continuar sem valor."
    );
  }

  const yearIndex = indexes.year;
  const populationIndex = indexes.population;
  const elderlyIndex = indexes.population60Plus;

  const rows: PopulationRow[] = [];
  const seenYears = new Set<number>();

  lines.slice(1).forEach((line, index) => {
    const lineNumber = index + 2;
    const cells = line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const year = Number(cells[yearIndex]);
    const population = parseCount(cells[populationIndex] ?? "");
    const elderlyRaw = elderlyIndex === -1 ? "" : cells[elderlyIndex] ?? "";
    const population60Plus = elderlyRaw === "" ? null : parseCount(elderlyRaw);

    if (!/^\d{4}$/.test(cells[yearIndex] ?? "") || year < MIN_YEAR || year > MAX_YEAR) {
      errors.push(`Linha ${lineNumber}: ano inválido ("${cells[yearIndex] ?? ""}").`);
      return;
    }

    if (seenYears.has(year)) {
      errors.push(`Linha ${lineNumber}: o ano ${year} aparece mais de uma vez.`);
      return;
    }

    if (population === null || population <= 0) {
      errors.push(`Linha ${lineNumber}: população inválida ("${cells[populationIndex] ?? ""}").`);
      return;
    }

    if (elderlyRaw !== "" && (population60Plus === null || population60Plus <= 0)) {
      errors.push(`Linha ${lineNumber}: população de 60 anos ou mais inválida ("${elderlyRaw}").`);
      return;
    }

    if (population60Plus !== null && population60Plus > population) {
      errors.push(`Linha ${lineNumber}: população de 60 anos ou mais maior que a população total.`);
      return;
    }

    seenYears.add(year);
    rows.push({ year, population, population60Plus });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push("A planilha não tem nenhum ano.");
  }

  if (elderlyIndex !== -1 && rows.length > 0 && rows.every((row) => row.population60Plus === null)) {
    warnings.push(`A coluna "${columns.population60Plus}" está vazia em todos os anos.`);
  }

  return { rows: rows.sort((a, b) => a.year - b.year), errors, warnings, columns };
}

export function diffPopulation(current: PopulationRow[], next: PopulationRow[]): PopulationDiff {
  const currentByYear = new Map(current.map((row) => [row.year, row]));
  const nextYears = new Set(next.map((row) => row.year));
  const diff: PopulationDiff = { added: [], changed: [], removed: [], unchanged: [] };

  for (const row of next) {
    const before = currentByYear.get(row.year);

    if (!before) {
      diff.added.push(row.year);
    } else if (before.population !== row.population || before.population60Plus !== row.population60Plus) {
      diff.changed.push(row.year);
    } else {
      diff.unchanged.push(row.year);
    }
  }

  diff.removed = current.filter((row) => !nextYears.has(row.year)).map((row) => row.year);
  return diff;
}

export async function getPopulation() {
  return prisma.populationEstimate.findMany({ orderBy: { year: "asc" } });
}

export function toPopulationRows(records: Awaited<ReturnType<typeof getPopulation>>): PopulationRow[] {
  return records.map((record) => ({
    year: record.year,
    population: record.population,
    population60Plus: record.population60Plus
  }));
}

/** Troca a tabela inteira pelas linhas da planilha, numa transação (ou tudo, ou nada). */
export async function replacePopulation(rows: PopulationRow[], sourceNote: string | null, updatedBy: string) {
  await prisma.$transaction([
    prisma.populationEstimate.deleteMany({}),
    prisma.populationEstimate.createMany({
      data: rows.map((row) => ({ ...row, sourceNote, updatedBy, updatedAt: new Date() }))
    })
  ]);
}

/** Esvazia a tabela (usado pelos testes para restaurar o estado; não há botão na tela). */
export async function clearPopulation() {
  return (await prisma.populationEstimate.deleteMany({})).count;
}

/**
 * Modelo para preencher: o cabeçalho certo e uma linha por ano, com os números em branco.
 * Enviado sem preencher, é recusado (população inválida): o modelo nunca vira dado.
 */
export function toPopulationTemplateCsv(firstYear: number, lastYear: number) {
  const years = Array.from({ length: Math.max(0, lastYear - firstYear + 1) }, (_, index) => firstYear + index);
  return [POPULATION_CSV_HEADER, ...years.map((year) => `${year};;`)].join("\n") + "\n";
}

/** Planilha com os dados atuais (ou só o cabeçalho), no formato aceito pelo envio. */
export function toPopulationCsv(rows: PopulationRow[]) {
  return [POPULATION_CSV_HEADER, ...rows.map((row) => `${row.year};${row.population};${row.population60Plus ?? ""}`)].join("\n") + "\n";
}
