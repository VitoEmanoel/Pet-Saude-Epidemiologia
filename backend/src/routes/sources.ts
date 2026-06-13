import { Router } from "express";
import { ALLOWED_CITY, ALLOWED_DATASUS_CATEGORY } from "../config/city";
import { allowedSources, getSourceBySlug } from "../config/sources";
import { getSourceFilters, getSourceSummary } from "../modules/public/public-data.service";
import { sendError } from "../utils/api-response";

export const sourcesRouter = Router();

sourcesRouter.get("/", (_request, response) => {
  return response.json({
    city: ALLOWED_CITY,
    category: ALLOWED_DATASUS_CATEGORY,
    total: allowedSources.length,
    sources: allowedSources
  });
});

sourcesRouter.get("/:slug/availability", (request, response) => {
  const source = getSourceBySlug(request.params.slug);

  if (!source) {
    return sendError(response, 404, "not_found", "Fonte nao permitida ou inexistente.");
  }

  return response.json({
    city: ALLOWED_CITY,
    source,
    availability: {
      municipalityFilterStatus: source.municipalityFilterStatus,
      message:
        source.municipalityFilterStatus === "unknown"
          ? "A disponibilidade municipal desta fonte ainda precisa ser validada na Fase 2."
          : null
    }
  });
});

sourcesRouter.get("/:slug/summary", async (request, response) => {
  try {
    const summary = await getSourceSummary(request.params.slug);

    if (!summary) {
      return sendError(response, 404, "not_found", "Fonte nao permitida ou inexistente.");
    }

    return response.json(summary);
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao carregar resumo da fonte.");
  }
});

sourcesRouter.get("/:slug/filters", async (request, response) => {
  try {
    const filters = await getSourceFilters(request.params.slug);

    if (!filters) {
      return sendError(response, 404, "not_found", "Fonte nao permitida ou inexistente.");
    }

    return response.json(filters);
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao carregar filtros da fonte.");
  }
});

sourcesRouter.get("/:slug", (request, response) => {
  const source = getSourceBySlug(request.params.slug);

  if (!source) {
    return sendError(response, 404, "not_found", "Fonte nao permitida ou inexistente.");
  }

  return response.json({
    city: ALLOWED_CITY,
    source
  });
});
