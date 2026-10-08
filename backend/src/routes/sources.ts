import { Router } from "express";
import { ALLOWED_CITY, ALLOWED_DATASUS_CATEGORY } from "../config/city";
import { getPublicSourceBySlug, publicSources } from "../config/sources";
import { getSourceFilters, getSourceSummary } from "../modules/public/public-data.service";
import { isSourceHidden } from "../modules/sources/source-publication";
import { sendError } from "../utils/api-response";

export const sourcesRouter = Router();

sourcesRouter.get("/", (_request, response) => {
  // Fontes tiradas do site pelo administrador (7.5) não aparecem.
  const sources = publicSources.filter((source) => !isSourceHidden(source.slug));
  return response.json({
    city: ALLOWED_CITY,
    category: ALLOWED_DATASUS_CATEGORY,
    total: sources.length,
    sources
  });
});

// Fonte fora do site (7.5) responde como inexistente em todas as rotas públicas dela.
sourcesRouter.use("/:slug", (request, response, next) => {
  if (isSourceHidden(request.params.slug)) {
    return sendError(response, 404, "not_found", "Fonte não permitida ou inexistente.");
  }
  return next();
});

sourcesRouter.get("/:slug/availability", (request, response) => {
  const source = getPublicSourceBySlug(request.params.slug);

  if (!source) {
    return sendError(response, 404, "not_found", "Fonte não permitida ou inexistente.");
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
      return sendError(response, 404, "not_found", "Fonte não permitida ou inexistente.");
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
      return sendError(response, 404, "not_found", "Fonte não permitida ou inexistente.");
    }

    return response.json(filters);
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao carregar filtros da fonte.");
  }
});

sourcesRouter.get("/:slug", (request, response) => {
  const source = getPublicSourceBySlug(request.params.slug);

  if (!source) {
    return sendError(response, 404, "not_found", "Fonte não permitida ou inexistente.");
  }

  return response.json({
    city: ALLOWED_CITY,
    source
  });
});
