import { Router } from "express";
import { ALLOWED_CITY } from "../config/city";
import { activeSources, getSourceBySlug, syncableSources } from "../config/sources";
import {
  UNIDENTIFIED_ACTOR,
  getAdminActor,
  getAdminAuditLogs,
  recordAdminAudit
} from "../modules/admin/admin-audit.service";
import {
  assertAdminSecurityConfigured,
  clearAdminLoginAttempts,
  clearAdminSessionCookie,
  getAdminLoginRateLimit,
  isAllowedAdminOrigin,
  isValidAdminCredentials,
  requireAdminAuth,
  revokeAdminSession,
  registerFailedAdminLogin,
  setAdminSecurityHeaders,
  startAdminSession
} from "../middleware/admin-auth";
import { prisma } from "../database/prisma";
import { getSourcesHealth } from "../modules/admin/source-health.service";
import { getSourceIndicators } from "../modules/public/indicators.service";
import { getPublicSourceBySlug } from "../config/sources";
import {
  clearPopulation,
  diffPopulation,
  getPopulation,
  parsePopulationCsv,
  replacePopulation,
  toPopulationCsv,
  toPopulationRows
} from "../modules/population/population.service";
import {
  dashboardExportFilename,
  toDashboardHtml
} from "../modules/admin/dashboard-export.service";
import {
  SourceNotAllowedError,
  SyncAlreadyRunningError,
  UnsupportedCollectorError,
  syncSource
} from "../modules/sync/sync.service";
import {
  getChartByAgeGroup,
  getChartByRaceColor,
  getChartBySex,
  getRecordsForExport,
  getSourceSummary,
  getYearlyEvolution,
  parseFilters,
  toRecordsCsv
} from "../modules/public/public-data.service";
import { sendError } from "../utils/api-response";
import { validateRecordsAggregation, validateRecordsQuery } from "./records-query";

export const adminRouter = Router();

adminRouter.use((request, response, next) => {
  setAdminSecurityHeaders(response);

  if (request.method !== "GET" && !isAllowedAdminOrigin(request)) {
    void recordAdminAudit({
      request,
      actor: UNIDENTIFIED_ACTOR,
      action: "admin_request_blocked",
      status: "FAILED",
      metadata: {
        reason: "origin_not_allowed",
        method: request.method,
        path: request.path
      }
    });
    return sendError(response, 403, "forbidden", "Origem administrativa não permitida.");
  }

  return next();
});

adminRouter.post("/auth/login", async (request, response) => {
  if (!assertAdminSecurityConfigured(response)) {
    return;
  }

  const rateLimit = getAdminLoginRateLimit(request);

  if (rateLimit.limited) {
    response.setHeader("retry-after", String(rateLimit.retryAfterSeconds));
    await recordAdminAudit({
      request,
      actor: UNIDENTIFIED_ACTOR,
      action: "admin_login",
      status: "FAILED",
      metadata: {
        reason: "rate_limited",
        code: "rate_limited",
        retryAfterSeconds: rateLimit.retryAfterSeconds
      }
    });
    return sendError(
      response,
      429,
      "rate_limited",
      "Muitas tentativas de acesso. Tente novamente mais tarde."
    );
  }

  if (!isValidAdminCredentials(request.body?.username, request.body?.password)) {
    registerFailedAdminLogin(request);
    await recordAdminAudit({
      request,
      actor: UNIDENTIFIED_ACTOR,
      action: "admin_login",
      status: "FAILED",
      metadata: {
        reason: "invalid_credentials",
        username: typeof request.body?.username === "string" ? request.body.username : null
      }
    });
    return sendError(response, 401, "unauthorized", "Credencial administrativa inválida.");
  }

  try {
    await startAdminSession(response);
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao iniciar a sessão administrativa.");
  }

  clearAdminLoginAttempts(request);
  await recordAdminAudit({
    request,
    action: "admin_login",
    status: "SUCCESS"
  });
  return response.json({ authenticated: true });
});

adminRouter.use(requireAdminAuth);

adminRouter.get("/auth/me", (_request, response) => {
  return response.json({ authenticated: true, username: getAdminActor() });
});

adminRouter.post("/auth/logout", async (request, response) => {
  try {
    await revokeAdminSession(response);
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao encerrar a sessão administrativa.");
  }

  clearAdminSessionCookie(response);
  await recordAdminAudit({
    request,
    action: "admin_logout",
    status: "SUCCESS"
  });
  return response.json({ authenticated: false });
});

adminRouter.get("/records/export.csv", async (request, response) => {
  const validationError =
    validateRecordsQuery(request.query, false) ?? validateRecordsAggregation(request.query);

  if (validationError) {
    return validationError(response);
  }

  try {
    const filters = parseFilters(request.query);
    const records = await getRecordsForExport(filters);
    const csv = toRecordsCsv(records);

    await recordAdminAudit({
      request,
      action: "admin_export_csv",
      status: "SUCCESS",
      metadata: {
        filters,
        recordsExported: records.length
      }
    });

    response.setHeader("content-type", "text/csv; charset=utf-8");
    response.setHeader(
      "content-disposition",
      "attachment; filename=\"registros-epidemiologicos-parnaiba.csv\""
    );

    return response.send(csv);
  } catch (error) {
    console.error(error);
    await recordAdminAudit({
      request,
      action: "admin_export_csv",
      status: "FAILED",
      metadata: {
        reason: "export_error",
        message: error instanceof Error ? error.message : "Erro desconhecido."
      }
    });
    return sendError(response, 500, "internal_error", "Erro ao exportar registros.");
  }
});

adminRouter.get("/dashboard/export.html", async (request, response) => {
  const validationError =
    validateRecordsQuery(request.query, false) ?? validateRecordsAggregation(request.query);

  if (validationError) {
    return validationError(response);
  }

  const sourceSlug = typeof request.query.source === "string" ? request.query.source : "";

  if (!sourceSlug) {
    return sendError(response, 400, "invalid_query", "Selecione uma fonte para exportar.");
  }

  try {
    const filters = parseFilters(request.query);
    const sourceSummary = await getSourceSummary(sourceSlug);

    if (!sourceSummary) {
      return sendError(response, 404, "not_found", "Fonte não permitida ou inexistente.");
    }

    const [yearly, bySex, byAgeGroup, byRaceColor] = await Promise.all([
      getYearlyEvolution(sourceSlug, filters),
      getChartBySex(sourceSlug, filters),
      getChartByAgeGroup(sourceSlug, filters),
      getChartByRaceColor(sourceSlug, filters)
    ]);

    const html = toDashboardHtml({
      generatedAt: new Date(),
      city: ALLOWED_CITY,
      source: sourceSummary.source,
      filters,
      summary: sourceSummary.summary,
      charts: {
        yearly,
        bySex,
        byAgeGroup,
        byRaceColor
      }
    });

    await recordAdminAudit({
      request,
      action: "admin_export_dashboard",
      status: "SUCCESS",
      metadata: {
        filters,
        source: sourceSlug
      }
    });

    response.setHeader("content-type", "text/html; charset=utf-8");
    response.setHeader(
      "content-disposition",
      `attachment; filename="${dashboardExportFilename(sourceSlug)}"`
    );

    return response.send(html);
  } catch (error) {
    console.error(error);
    await recordAdminAudit({
      request,
      action: "admin_export_dashboard",
      status: "FAILED",
      metadata: {
        source: sourceSlug,
        reason: "export_error",
        message: error instanceof Error ? error.message : "Erro desconhecido."
      }
    });
    return sendError(response, 500, "internal_error", "Erro ao exportar dashboard.");
  }
});

adminRouter.post("/sync/:sourceSlug", async (request, response) => {
  const source = getSourceBySlug(request.params.sourceSlug);

  if (!source) {
    return sendError(response, 404, "not_found", "Fonte não permitida ou inexistente.");
  }

  try {
    const result = await syncSource(source.slug, "admin_api");
    await recordAdminAudit({
      request,
      action: "admin_sync_source",
      status: result.syncJob.status === "FAILED" ? "FAILED" : "SUCCESS",
      metadata: {
        source: source.slug,
        syncJobId: result.syncJob.id,
        syncStatus: result.syncJob.status,
        recordsImported: result.syncJob.recordsImported
      }
    });
    return response.json(result);
  } catch (error) {
    if (error instanceof UnsupportedCollectorError) {
      return sendError(
        response,
        501,
        "not_implemented",
        "Não há coletor implementado para esta fonte.",
        { city: ALLOWED_CITY, source }
      );
    }

    if (error instanceof SourceNotAllowedError) {
      return sendError(response, 404, "not_found", "Fonte não permitida ou inexistente.");
    }

    if (error instanceof SyncAlreadyRunningError) {
      await recordAdminAudit({
        request,
        action: "admin_sync_source",
        status: "FAILED",
        metadata: {
          source: source.slug,
          reason: "sync_already_running",
          code: "sync_already_running",
          message: error.message
        }
      });
      return sendError(response, 409, "sync_already_running", error.message);
    }

    console.error(error);
    await recordAdminAudit({
      request,
      action: "admin_sync_source",
      status: "FAILED",
      metadata: {
        source: source.slug,
        reason: "sync_error",
        message: error instanceof Error ? error.message : "Erro desconhecido."
      }
    });
    return sendError(response, 500, "internal_error", "Erro ao executar sincronização.");
  }
});

adminRouter.post("/sync-all", async (request, response) => {
  const results = [];

  for (const source of syncableSources) {
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
      await recordAdminAudit({
        request,
        action: "admin_sync_all",
        status: "FAILED",
        metadata: {
          reason: "sync_error",
          source: source.slug,
          message: error instanceof Error ? error.message : "Erro desconhecido."
        }
      });
      return sendError(response, 500, "internal_error", "Erro ao executar sincronização geral.");
    }
  }

  await recordAdminAudit({
    request,
    action: "admin_sync_all",
    status: results.some((result) => "error" in result) ? "FAILED" : "SUCCESS",
    metadata: {
      totalSources: activeSources.length,
      results: results.map((result) => ({
        source: result.source.slug,
        status: "syncJob" in result ? result.syncJob?.status : undefined,
        error: "error" in result ? result.error?.code : undefined
      }))
    }
  });

  return response.json({
    city: ALLOWED_CITY,
    results
  });
});

adminRouter.get("/audit-logs", async (_request, response) => {
  const auditLogs = await getAdminAuditLogs();

  return response.json({
    auditLogs
  });
});

// Indicadores de uma fonte em CSV (A6), na mesma regra de exportação só pelo admin.
const INDICATOR_STATUS_LABELS: Record<string, string> = {
  ok: "",
  sem_populacao: "sem população cadastrada",
  nao_se_aplica: "não se aplica",
  sem_dados: "sem dados"
};

adminRouter.get("/indicators/export.csv", async (request, response) => {
  const source = typeof request.query.source === "string" ? getPublicSourceBySlug(request.query.source) : undefined;

  if (!source) {
    return sendError(response, 404, "not_found", "Fonte não permitida ou inexistente.");
  }

  const indicators = await getSourceIndicators(source.slug);
  const lines = ["indicador;unidade;ano;valor;numerador;denominador;situacao;provisorio"];

  for (const indicator of indicators) {
    for (const point of indicator.series) {
      const decimal = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));
      lines.push(
        [
          indicator.label,
          indicator.unit,
          point.year,
          decimal(point.value),
          decimal(point.numerator),
          decimal(point.denominator),
          INDICATOR_STATUS_LABELS[point.status] ?? point.status,
          point.provisional ? "sim" : "nao"
        ].join(";")
      );
    }
  }

  await recordAdminAudit({
    request,
    action: "admin_export_indicators",
    status: "SUCCESS",
    metadata: { source: source.slug, indicators: indicators.length }
  });

  response.setHeader("content-type", "text/csv; charset=utf-8");
  response.setHeader("content-disposition", `attachment; filename="indicadores-${source.slug}.csv"`);
  return response.send(`\uFEFF${lines.join("\n")}\n`);
});

// População por ano (A4): consulta, pré-visualização da planilha e substituição da tabela.
adminRouter.get("/population", async (_request, response) => {
  return response.json({ city: ALLOWED_CITY, population: await getPopulation() });
});

adminRouter.get("/population/template.csv", async (_request, response) => {
  response.setHeader("content-type", "text/csv; charset=utf-8");
  response.setHeader("content-disposition", 'attachment; filename="populacao-parnaiba.csv"');
  return response.send(toPopulationCsv(toPopulationRows(await getPopulation())));
});

function readPopulationBody(body: unknown) {
  const csv = typeof (body as { csv?: unknown })?.csv === "string" ? (body as { csv: string }).csv : "";
  const rawNote = (body as { sourceNote?: unknown })?.sourceNote;
  const sourceNote = typeof rawNote === "string" && rawNote.trim() ? rawNote.trim().slice(0, 200) : null;
  return { csv, sourceNote };
}

adminRouter.post("/population/preview", async (request, response) => {
  const { csv } = readPopulationBody(request.body);
  const parsed = parsePopulationCsv(csv);
  const current = toPopulationRows(await getPopulation());
  return response.json({ ...parsed, diff: diffPopulation(current, parsed.rows) });
});

adminRouter.put("/population", async (request, response) => {
  const { csv, sourceNote } = readPopulationBody(request.body);
  const parsed = parsePopulationCsv(csv);

  if (parsed.errors.length > 0) {
    return sendError(response, 400, "invalid_body", "A planilha tem erros; nada foi gravado.", { errors: parsed.errors });
  }

  try {
    const diff = diffPopulation(toPopulationRows(await getPopulation()), parsed.rows);
    await replacePopulation(parsed.rows, sourceNote, getAdminActor());
    await recordAdminAudit({
      request,
      action: "admin_population_upload",
      status: "SUCCESS",
      metadata: {
        years: parsed.rows.length,
        firstYear: parsed.rows[0]?.year ?? null,
        lastYear: parsed.rows[parsed.rows.length - 1]?.year ?? null,
        added: diff.added,
        changed: diff.changed,
        removed: diff.removed,
        sourceNote
      }
    });
    return response.json({ population: await getPopulation(), diff });
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao gravar a população.");
  }
});

adminRouter.delete("/population", async (request, response) => {
  const removed = await clearPopulation();
  await recordAdminAudit({ request, action: "admin_population_clear", status: "SUCCESS", metadata: { removed } });
  return response.json({ removed });
});

// Situação de cada fonte: falhas seguidas, último sucesso e avisos (O5).
adminRouter.get("/source-health", async (_request, response) => {
  try {
    return response.json({ sources: await getSourcesHealth() });
  } catch (error) {
    console.error(error);
    return sendError(response, 500, "internal_error", "Erro ao carregar a situação das fontes.");
  }
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
