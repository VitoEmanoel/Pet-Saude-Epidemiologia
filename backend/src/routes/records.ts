import { Router } from "express";
import {
  getRecords,
  parseFilters,
  parsePagination
} from "../modules/public/public-data.service";
import { validateRecordsQuery } from "./records-query";
import { sendError } from "../utils/api-response";

export const recordsRouter = Router();

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
