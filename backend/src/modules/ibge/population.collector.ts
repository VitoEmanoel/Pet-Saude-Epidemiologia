import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { ALLOWED_CITY } from "../../config/city";

export async function syncIbgePopulationEstimates(client: PrismaClient, sourceId: number, syncJobId: number, years: number[]) {
  for (const year of [...new Set(years)]) {
    const result = await resolvePopulation(client, year);
    if (!result) continue;
    await client.rawImport.create({ data: {
      sourceId, syncJobId, requestUrl: result.sourceUrl,
      requestParams: { provider: "IBGE SIDRA", kind: result.sourceKind, requestedYear: year, referenceYear: result.referenceYear },
      responseFormat: "json", contentHash: createHash("sha256").update(result.raw).digest("hex"), rowCount: 1
    }});
    await client.populationEstimate.upsert({
      where: { cityIbgeCode_year: { cityIbgeCode: ALLOWED_CITY.ibgeCode, year } },
      update: { population: result.population, sourceUrl: result.sourceUrl, sourceKind: result.sourceKind, referenceYear: result.referenceYear, importedAt: new Date() },
      create: { cityIbgeCode: ALLOWED_CITY.ibgeCode, year, population: result.population, sourceUrl: result.sourceUrl, sourceKind: result.sourceKind, referenceYear: result.referenceYear }
    });
  }
}

type PopulationResult = { population: number; sourceUrl: string; sourceKind: string; referenceYear: number; raw: string };

async function resolvePopulation(client: PrismaClient, year: number): Promise<PopulationResult | null> {
  const censusYear = year === 2020 ? 2022 : year;
  const censusTable = censusYear === 2022 ? "4714" : censusYear === 2010 ? "608" : null;
  if (censusTable) {
    const census = await fetchSidra(censusTable, "93", censusYear);
    if (census) return { ...census, sourceKind: year === 2020 ? "censo_2022_substitui_2020" : "censo", referenceYear: censusYear };
  }

  const estimate = await fetchSidra("6579", "9324", year);
  if (estimate) return { ...estimate, sourceKind: "estimativa", referenceYear: year };

  const available = await client.populationEstimate.findMany({
    where: { cityIbgeCode: ALLOWED_CITY.ibgeCode },
    select: { year: true, population: true, sourceUrl: true }
  });
  const nearest = available.reduce<typeof available[number] | null>((current, item) =>
    !current || Math.abs(item.year - year) < Math.abs(current.year - year) ? item : current, null);
  if (!nearest) return null;
  return { population: nearest.population, sourceUrl: nearest.sourceUrl, sourceKind: "repetido_ano_mais_proximo", referenceYear: nearest.year, raw: JSON.stringify(nearest) };
}

async function fetchSidra(table: string, variable: string, year: number): Promise<Omit<PopulationResult, "sourceKind" | "referenceYear"> | null> {
  const sourceUrl = `https://apisidra.ibge.gov.br/values/t/${table}/n6/${ALLOWED_CITY.ibgeCode}/v/${variable}/p/${year}`;
  const response = await fetch(sourceUrl, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const raw = await response.text();
  const rows = JSON.parse(raw) as Array<{ V?: string; D3C?: string }>;
  const population = Number(rows.find((row) => row.D3C === String(year))?.V);
  return Number.isInteger(population) && population > 0 ? { population, sourceUrl, raw } : null;
}
