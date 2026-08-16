import { Router } from "express";
import { ALLOWED_CITY } from "../config/city";
import { prisma } from "../database/prisma";
import { sendError } from "../utils/api-response";

export const dengueRouter = Router();

dengueRouter.get("/indicators", async (_request, response) => {
  const source = await prisma.dataSource.findUnique({ where: { slug: "dengue_sinan" } });
  if (!source) return sendError(response, 404, "not_found", "Dados de dengue ainda nao foram sincronizados.");

  const records = await prisma.epidemiologicalRecord.findMany({
    where: { sourceId: source.id, sourceTable: { contains: "_yearly_" } },
    select: { year: true, metric: true, value: true }
  });
  const populations = await prisma.populationEstimate.findMany({
    where: { cityIbgeCode: ALLOWED_CITY.ibgeCode },
    select: { year: true, population: true }
  });
  const byPopulation = new Map(populations.map((item) => [item.year, item.population]));
  const byYear = new Map<number, Record<string, number>>();
  for (const record of records) {
    if (!record.year || !record.metric || record.value === null) continue;
    const values = byYear.get(record.year) ?? {};
    values[record.metric] = Number(record.value);
    byYear.set(record.year, values);
  }

  const series = [...byYear.entries()].sort(([left], [right]) => left - right).map(([year, values]) => {
    const probable = values.casos_provaveis ?? 0;
    const alarm = values.dengue_sinais_alarme ?? 0;
    const severe = values.dengue_grave ?? 0;
    const population = byPopulation.get(year) ?? null;
    return {
      year,
      population,
      probableCases: probable,
      alarmCases: alarm,
      severeCases: severe,
      incidencePer100k: population ? (probable / population) * 100_000 : null,
      alarmProportion: probable ? (alarm / probable) * 100 : null,
      severeProportion: probable ? (severe / probable) * 100 : null
    };
  });

  return response.json({ city: ALLOWED_CITY, source: "dengue_sinan", series });
});
