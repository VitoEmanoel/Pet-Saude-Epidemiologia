import { BLOCKED_MUNICIPALITY_QUERY_PARAMS } from "../config/city";
import { getPublicSourceBySlug } from "../config/sources";
import {
  RECORD_AGGREGATIONS,
  getAggregationConflict,
  parseFilters
} from "../modules/public/public-data.service";
import { sendError } from "../utils/api-response";

const ALLOWED_RECORD_QUERY_PARAMS = new Set([
  "source",
  "year",
  "month",
  "sex",
  "ageGroup",
  "raceColor",
  "condition",
  "aggregation",
  "page",
  "pageSize"
]);

export function validateRecordsQuery(
  query: Record<string, unknown>,
  allowPagination: boolean
): null | ((response: Parameters<typeof sendError>[0]) => ReturnType<typeof sendError>) {
  const allowedParams = allowPagination
    ? ALLOWED_RECORD_QUERY_PARAMS
    : new Set(
        [...ALLOWED_RECORD_QUERY_PARAMS].filter((param) => !["page", "pageSize"].includes(param))
      );
  const receivedParams = Object.keys(query);
  const blockedMunicipalityParams = receivedParams.filter((param) =>
    BLOCKED_MUNICIPALITY_QUERY_PARAMS.has(param)
  );

  if (blockedMunicipalityParams.length > 0) {
    return (response) =>
      sendError(
        response,
        400,
        "invalid_query",
        "Nao e permitido filtrar por outro municipio. O municipio fixo e Parnaiba - PI.",
        { blockedParams: blockedMunicipalityParams }
      );
  }

  const invalidParams = receivedParams.filter((param) => !allowedParams.has(param));

  if (invalidParams.length > 0) {
    return (response) =>
      sendError(response, 400, "invalid_query", "Parametro de consulta nao permitido.", {
        invalidParams,
        allowedParams: [...allowedParams]
      });
  }

  const sourceSlug = String(query.source ?? "");

  // Só fontes públicas: a zika (interna) não pode ser consultada diretamente (S12).
  if (sourceSlug && !getPublicSourceBySlug(sourceSlug)) {
    return (response) =>
      sendError(response, 404, "not_found", "Fonte nao permitida ou inexistente.");
  }

  if (
    query.aggregation !== undefined &&
    !RECORD_AGGREGATIONS.some((aggregation) => aggregation === query.aggregation)
  ) {
    return (response) =>
      sendError(response, 400, "invalid_query", "Visao (aggregation) invalida.", {
        allowedValues: [...RECORD_AGGREGATIONS]
      });
  }

  return null;
}

/** Validação extra da tabela e do CSV: a visão precisa combinar com o filtro demográfico. */
export function validateRecordsAggregation(
  query: Record<string, unknown>
): null | ((response: Parameters<typeof sendError>[0]) => ReturnType<typeof sendError>) {
  const conflict = getAggregationConflict(parseFilters(query));

  if (!conflict) {
    return null;
  }

  return (response) => sendError(response, 400, "invalid_query", conflict);
}
