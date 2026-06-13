import { Router } from "express";
import { getDashboardOverview } from "../modules/public/public-data.service";
import { sendError } from "../utils/api-response";

export const dashboardRouter = Router();

dashboardRouter.get("/overview", async (_request, response) => {
  try {
    return response.json(await getDashboardOverview());
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao carregar visao geral.");
  }
});
