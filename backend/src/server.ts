import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ALLOWED_CITY, ALLOWED_DATASUS_CATEGORY } from "./config/city";
import { parseTrustProxy } from "./config/proxy";
import { adminRouter } from "./routes/admin";
import { chartsRouter } from "./routes/charts";
import { dashboardRouter } from "./routes/dashboard";
import { recordsRouter } from "./routes/records";
import { sourcesRouter } from "./routes/sources";
import { sendError } from "./utils/api-response";

export function createServer() {
  const app = express();

  // IP real do visitante (request.ip) só vem do X-Forwarded-For de proxies confiáveis.
  app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));

  // A API só devolve JSON, CSV e HTML para download: nada nela precisa carregar recursos.
  // As rotas do admin reforçam esses cabeçalhos em setAdminSecurityHeaders.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] }
      },
      // O frontend roda em outra porta/subdomínio do mesmo site.
      crossOriginResourcePolicy: { policy: "same-site" },
      strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false },
      xFrameOptions: { action: "deny" }
    })
  );
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

  // Precisa dos 4 parâmetros: é assim que o Express reconhece um tratador de erro.
  app.use(
    (error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
      if (response.headersSent) {
        return next(error);
      }

      const type = (error as { type?: unknown } | null)?.type;

      if (type === "entity.parse.failed") {
        return sendError(response, 400, "invalid_body", "Corpo da requisicao nao e um JSON valido.");
      }

      if (type === "entity.too.large") {
        return sendError(response, 413, "payload_too_large", "Corpo da requisicao grande demais.");
      }

      console.error(error);
      return sendError(response, 500, "internal_error", "Erro interno do servidor.");
    }
  );

  app.use((_request, response) => {
    return sendError(response, 404, "not_found", "Rota nao encontrada.");
  });

  return app;
}
