import { Router } from "express";
import type { Request, Response } from "express";
import { ALLOWED_CITY } from "../config/city";
import { getPublicSourceBySlug } from "../config/sources";
import {
  getChartByAgeGroup,
  getChartByRaceColor,
  getChartBySex,
  getDemographicFilterConflict,
  getIgnoredChartFilters,
  getYearlyEvolution,
  parseFilters,
  type DemographicFilterKey,
  type PublicFilters
} from "../modules/public/public-data.service";
import { validateRecordsQuery } from "./records-query";
import { sendError } from "../utils/api-response";

export const chartsRouter = Router();

function resolveSource(response: Response, sourceSlug: unknown) {
  if (!sourceSlug || typeof sourceSlug !== "string") {
    sendError(response, 400, "invalid_query", "O parâmetro source e obrigatório.");
    return null;
  }

  const source = getPublicSourceBySlug(sourceSlug);

  if (!source) {
    sendError(response, 404, "not_found", "Fonte não permitida ou inexistente.");
    return null;
  }

  return source;
}

/**
 * Monta um endpoint de gráfico. `dimension` é a dimensão demográfica do gráfico (null para a
 * evolução anual); filtros de outras dimensões não se aplicam a ele e voltam em `ignoredFilters`.
 */
function chartHandler(
  loadSeries: (sourceSlug: string, filters: PublicFilters) => Promise<unknown[]>,
  dimension: DemographicFilterKey | null,
  errorMessage: string
) {
  return async (request: Request, response: Response) => {
    const validationError = validateRecordsQuery(request.query, false);

    if (validationError) {
      return validationError(response);
    }

    const source = resolveSource(response, request.query.source);

    if (!source) {
      return;
    }

    const filters = parseFilters(request.query);
    const conflict = getDemographicFilterConflict(filters);

    if (conflict) {
      return sendError(response, 400, "invalid_query", conflict);
    }

    try {
      return response.json({
        city: ALLOWED_CITY,
        source,
        series: await loadSeries(source.slug, filters),
        ignoredFilters: dimension ? getIgnoredChartFilters(dimension, filters) : []
      });
    } catch (error) {
      console.error(error);
      return sendError(response, 500, "internal_error", errorMessage);
    }
  };
}

chartsRouter.get(
  "/yearly-evolution",
  chartHandler(getYearlyEvolution, null, "Erro ao carregar grafico anual.")
);
chartsRouter.get("/by-sex", chartHandler(getChartBySex, "sex", "Erro ao carregar grafico por sexo."));
chartsRouter.get(
  "/by-age-group",
  chartHandler(getChartByAgeGroup, "ageGroup", "Erro ao carregar grafico por faixa etária.")
);
chartsRouter.get(
  "/by-race-color",
  chartHandler(getChartByRaceColor, "raceColor", "Erro ao carregar grafico por raça/cor.")
);
