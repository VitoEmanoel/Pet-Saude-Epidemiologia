import { Router } from "express";
import { ALLOWED_CITY } from "../config/city";
import { allowedSources, getSourceBySlug } from "../config/sources";
import { requireAdminAuth } from "../middleware/admin-auth";
import { prisma } from "../database/prisma";
import {
  SourceNotAllowedError,
  UnsupportedCollectorError,
  syncSource
} from "../modules/sync/sync.service";
import { sendError } from "../utils/api-response";

export const adminRouter = Router();

adminRouter.use(requireAdminAuth);

adminRouter.post("/sync/:sourceSlug", async (request, response) => {
  const source = getSourceBySlug(request.params.sourceSlug);

  if (!source) {
    return sendError(response, 404, "not_found", "Fonte nao permitida ou inexistente.");
  }

  try {
    const result = await syncSource(source.slug, "admin_api");
    return response.json(result);
  } catch (error) {
    if (error instanceof UnsupportedCollectorError) {
      return sendError(
        response,
        501,
        "not_implemented",
        "A Fase 3 permite reprocessar somente a fonte piloto tuberculose_sinan.",
        { city: ALLOWED_CITY, source }
      );
    }

    if (error instanceof SourceNotAllowedError) {
      return sendError(response, 404, "not_found", "Fonte nao permitida ou inexistente.");
    }

    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao executar sincronizacao.");
  }
});

adminRouter.post("/sync-all", (_request, response) => {
  return sendError(
    response,
    501,
    "not_implemented",
    "A sincronizacao de todas as fontes sera implementada apos a validacao tecnica de cada fonte.",
    { city: ALLOWED_CITY, sources: allowedSources.map((source) => source.slug) }
  );
});

adminRouter.get("/sync-history", async (_request, response) => {
  const syncJobs = await prisma.syncJob.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 50,
    include: {
      source: {
        select: {
          slug: true,
          name: true,
          system: true
        }
      }
    }
  });

  return response.json({
    city: ALLOWED_CITY,
    syncJobs
  });
});
