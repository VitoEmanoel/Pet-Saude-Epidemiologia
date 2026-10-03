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

// Formato aceito para os parâmetros numéricos; vazio significa "sem filtro" (S14).
const NUMERIC_QUERY_FORMATS: Record<string, RegExp> = {
  year: /^\d{4}$/,
  month: /^(0?[1-9]|1[0-2])$/,
  page: /^[1-9]\d{0,5}$/,
  pageSize: /^[1-9]\d{0,5}$/
};
const QUERY_VALUE_RULES_DESCRIPTION =
  "Cada parâmetro aparece uma vez, como texto. year: 4 dígitos; month: 1 a 12; page e pageSize: inteiros a partir de 1.";

/** Parâmetros repetidos, em formato de objeto ou numéricos fora do formato. */
function getInvalidQueryValues(query: Record<string, unknown>) {
  return Object.entries(query)
    .filter(([name, value]) => {
      if (typeof value !== "string") {
        return true;
      }

      const format = NUMERIC_QUERY_FORMATS[name];
      return Boolean(format) && value !== "" && !format.test(value);
    })
    .map(([name]) => name);
}

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
        "Não é permitido filtrar por outro município. O município fixo é Parnaíba - PI.",
        { blockedParams: blockedMunicipalityParams }
      );
  }

  const invalidParams = receivedParams.filter((param) => !allowedParams.has(param));

  if (invalidParams.length > 0) {
    return (response) =>
      sendError(response, 400, "invalid_query", "Parâmetro de consulta não permitido.", {
        invalidParams,
        allowedParams: [...allowedParams]
      });
  }

  const invalidValues = getInvalidQueryValues(query);

  if (invalidValues.length > 0) {
    return (response) =>
      sendError(response, 400, "invalid_query", "Valor de parâmetro inválido.", {
        invalidValues,
        rules: QUERY_VALUE_RULES_DESCRIPTION
      });
  }

  const sourceSlug = String(query.source ?? "");

  // Só fontes públicas: fontes internas (kind "internal") não podem ser consultadas diretamente (S12).
  if (sourceSlug && !getPublicSourceBySlug(sourceSlug)) {
    return (response) =>
      sendError(response, 404, "not_found", "Fonte não permitida ou inexistente.");
  }

  if (
    query.aggregation !== undefined &&
    !RECORD_AGGREGATIONS.some((aggregation) => aggregation === query.aggregation)
  ) {
    return (response) =>
      sendError(response, 400, "invalid_query", "Visao (aggregation) inválida.", {
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
