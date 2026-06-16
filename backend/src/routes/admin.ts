import { Router } from "express";
import { ALLOWED_CITY } from "../config/city";
import { allowedSources, getSourceBySlug } from "../config/sources";
import { requireAdminAuth } from "../middleware/admin-auth";
import { prisma } from "../database/prisma";
import {
  SourceNotAllowedError,
  SyncAlreadyRunningError,
  UnsupportedCollectorError,
  syncSource
} from "../modules/sync/sync.service";
import { getRecordsForExport, parseFilters, toRecordsCsv } from "../modules/public/public-data.service";
import { sendError } from "../utils/api-response";
import { validateRecordsQuery } from "./records-query";

export const adminRouter = Router();

adminRouter.use(requireAdminAuth);

adminRouter.get("/records/export.csv", async (request, response) => {
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
        "Nao ha coletor implementado para esta fonte.",
        { city: ALLOWED_CITY, source }
      );
    }

    if (error instanceof SourceNotAllowedError) {
      return sendError(response, 404, "not_found", "Fonte nao permitida ou inexistente.");
    }

    if (error instanceof SyncAlreadyRunningError) {
      return sendError(response, 409, "sync_already_running", error.message);
    }

    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao executar sincronizacao.");
  }
});

adminRouter.post("/sync-all", async (_request, response) => {
  const results = [];

  for (const source of allowedSources) {
    try {
      results.push(await syncSource(source.slug, "admin_api_sync_all"));
    } catch (error) {
      if (error instanceof SyncAlreadyRunningError) {
        results.push({
          city: ALLOWED_CITY,
          source: {
            slug: source.slug,
            name: source.name,
            system: source.system
          },
          error: {
            code: "sync_already_running",
            message: error.message
          }
        });
        continue;
      }

      if (error instanceof UnsupportedCollectorError) {
        results.push({
          city: ALLOWED_CITY,
          source: {
            slug: source.slug,
            name: source.name,
            system: source.system
          },
          error: {
            code: "not_implemented",
            message: error.message
          }
        });
        continue;
      }

      console.error(error);
      return sendError(response, 500, "internal_error", "Erro ao executar sincronizacao geral.");
    }
  }

  return response.json({
    city: ALLOWED_CITY,
    results
  });
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
