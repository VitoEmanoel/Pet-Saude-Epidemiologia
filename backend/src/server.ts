import cors from "cors";
import express from "express";
import { ALLOWED_CITY, ALLOWED_DATASUS_CATEGORY } from "./config/city";
import { adminRouter } from "./routes/admin";
import { chartsRouter } from "./routes/charts";
import { dashboardRouter } from "./routes/dashboard";
import { recordsRouter } from "./routes/records";
import { sourcesRouter } from "./routes/sources";
import { sendError } from "./utils/api-response";

export function createServer() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") ?? true,
      credentials: true
    })
  );
  app.use(express.json());

  app.get("/health", (_request, response) => {
    return response.json({
      status: "ok",
      city: ALLOWED_CITY,
      category: ALLOWED_DATASUS_CATEGORY
    });
  });

  app.use("/api/sources", sourcesRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/records", recordsRouter);
  app.use("/api/charts", chartsRouter);
  app.use("/api/admin", adminRouter);

  app.use((_request, response) => {
    return sendError(response, 404, "not_found", "Rota nao encontrada.");
  });

  app.use((error: unknown, _request: express.Request, response: express.Response) => {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro interno do servidor.");
  });

  return app;
}
