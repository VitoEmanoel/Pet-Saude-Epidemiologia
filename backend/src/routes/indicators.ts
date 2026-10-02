import { Router } from "express";
import { ALLOWED_CITY } from "../config/city";
import { getPublicSourceBySlug } from "../config/sources";
import { prisma } from "../database/prisma";
import { getSourceIndicators } from "../modules/public/indicators.service";
import { sendError } from "../utils/api-response";

export const indicatorsRouter = Router();

// Indicadores de saúde de uma fonte (A5). Só `source` é aceito.
indicatorsRouter.get("/", async (request, response) => {
  const extraParams = Object.keys(request.query).filter((param) => param !== "source");

  if (extraParams.length > 0) {
    return sendError(response, 400, "invalid_query", "Parametro de consulta nao permitido.", { invalidParams: extraParams });
  }

  const sourceSlug = request.query.source;

  if (typeof sourceSlug !== "string" || !sourceSlug) {
    return sendError(response, 400, "invalid_query", "O parametro source e obrigatorio.");
  }

  const source = getPublicSourceBySlug(sourceSlug);

  if (!source) {
    return sendError(response, 404, "not_found", "Fonte nao permitida ou inexistente.");
  }

  try {
    const [indicators, population] = await Promise.all([
      getSourceIndicators(source.slug),
      prisma.populationEstimate.aggregate({ _count: { year: true }, _min: { year: true }, _max: { year: true, updatedAt: true } })
    ]);

    return response.json({
      city: ALLOWED_CITY,
      source,
      population: {
        years: population._count.year,
        firstYear: population._min.year,
        lastYear: population._max.year,
        updatedAt: population._max.updatedAt
      },
      indicators
    });
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao calcular indicadores.");
  }
});
