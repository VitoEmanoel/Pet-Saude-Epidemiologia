import { Router } from "express";
import type { Response } from "express";
import { ALLOWED_CITY } from "../config/city";
import { getPublicSourceBySlug } from "../config/sources";
import {
  getChartByAgeGroup,
  getChartByRaceColor,
  getChartBySex,
  getYearlyEvolution
} from "../modules/public/public-data.service";
import { sendError } from "../utils/api-response";

export const chartsRouter = Router();

function resolveSource(response: Response, sourceSlug: unknown) {
  if (!sourceSlug || typeof sourceSlug !== "string") {
    sendError(response, 400, "invalid_query", "O parametro source e obrigatorio.");
    return null;
  }

  const source = getPublicSourceBySlug(sourceSlug);

  if (!source) {
    sendError(response, 404, "not_found", "Fonte nao permitida ou inexistente.");
    return null;
  }

  return source;
}

chartsRouter.get("/yearly-evolution", async (request, response) => {
  const source = resolveSource(response, request.query.source);

  if (!source) {
    return;
  }

  try {
    return response.json({
      city: ALLOWED_CITY,
      source,
      series: await getYearlyEvolution(source.slug)
    });
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao carregar grafico anual.");
  }
});

chartsRouter.get("/by-sex", async (request, response) => {
  const source = resolveSource(response, request.query.source);

  if (!source) {
    return;
  }

  try {
    return response.json({
      city: ALLOWED_CITY,
      source,
      series: await getChartBySex(source.slug)
    });
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao carregar grafico por sexo.");
  }
});

chartsRouter.get("/by-age-group", async (request, response) => {
  const source = resolveSource(response, request.query.source);

  if (!source) {
    return;
  }

  try {
    return response.json({
      city: ALLOWED_CITY,
      source,
      series: await getChartByAgeGroup(source.slug)
    });
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao carregar grafico por faixa etaria.");
  }
});

chartsRouter.get("/by-race-color", async (request, response) => {
  const source = resolveSource(response, request.query.source);

  if (!source) {
    return;
  }

  try {
    return response.json({
      city: ALLOWED_CITY,
      source,
      series: await getChartByRaceColor(source.slug)
    });
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao carregar grafico por raca/cor.");
  }
});
