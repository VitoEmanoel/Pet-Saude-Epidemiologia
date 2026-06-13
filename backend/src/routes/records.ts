import { Router } from "express";
import { BLOCKED_MUNICIPALITY_QUERY_PARAMS } from "../config/city";
import { getSourceBySlug } from "../config/sources";
import {
  getRecords,
  getRecordsForExport,
  parseFilters,
  parsePagination,
  toRecordsCsv
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
  "page",
  "pageSize"
]);

export const recordsRouter = Router();

recordsRouter.get("/export.csv", async (request, response) => {
  const validationError = validateRecordsQuery(request.query, false);

  if (validationError) {
    return validationError(response);
  }

  try {
    const filters = parseFilters(request.query);
    const records = await getRecordsForExport(filters);
    const csv = toRecordsCsv(records);

    response.setHeader("content-type", "text/csv; charset=utf-8");
    response.setHeader(
      "content-disposition",
      "attachment; filename=\"registros-epidemiologicos-parnaiba.csv\""
    );

    return response.send(csv);
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao exportar registros.");
  }
});

recordsRouter.get("/", async (request, response) => {
  const validationError = validateRecordsQuery(request.query, true);

  if (validationError) {
    return validationError(response);
  }

  try {
    const filters = parseFilters(request.query);
    const pagination = parsePagination(request.query);
    return response.json(await getRecords(filters, pagination));
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao listar registros.");
  }
});

function validateRecordsQuery(
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

  if (sourceSlug && !getSourceBySlug(sourceSlug)) {
    return (response) =>
      sendError(response, 404, "not_found", "Fonte nao permitida ou inexistente.");
  }

  return null;
}
