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

/**
 * Lê a planilha: cabeçalho `ano` e `populacao` (obrigatórios) e `populacao_60_mais` (opcional),
 * separados por `;` ou `,`. Linhas vazias são ignoradas. Nunca estima nem completa valores.
 */
export function parsePopulationCsv(text: string): PopulationParseResult {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const errors: string[] = [];

  if (lines.length === 0) {
    return { rows: [], errors: ["A planilha está vazia."] };
  }

  const separator = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(separator).map((cell) => cell.trim().toLowerCase().replace(/^"|"$/g, ""));
  const yearIndex = header.indexOf("ano");
  const populationIndex = header.indexOf("populacao");
  const elderlyIndex = header.indexOf("populacao_60_mais");

  if (yearIndex === -1 || populationIndex === -1) {
    return {
      rows: [],
      errors: [`Cabeçalho inválido. A primeira linha deve ter as colunas: ${POPULATION_CSV_HEADER} (a última é opcional).`]
    };
  }

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

  return { rows: rows.sort((a, b) => a.year - b.year), errors };
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

/** Planilha com os dados atuais (ou só o cabeçalho), no formato aceito pelo envio. */
export function toPopulationCsv(rows: PopulationRow[]) {
  return [POPULATION_CSV_HEADER, ...rows.map((row) => `${row.year};${row.population};${row.population60Plus ?? ""}`)].join("\n") + "\n";
}
