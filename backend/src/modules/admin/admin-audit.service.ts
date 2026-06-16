import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";

type AdminAuditInput = {
  request: Request;
  action: string;
  status: "SUCCESS" | "FAILED";
  metadata?: Prisma.InputJsonValue;
};

type AdminAuditLogRow = {
  id: number;
  actor: string;
  action: string;
  status: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

export async function recordAdminAudit({
  request,
  action,
  status,
  metadata
}: AdminAuditInput) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    const metadataSql =
      metadata === undefined ? Prisma.sql`NULL` : Prisma.sql`CAST(${JSON.stringify(metadata)} AS JSONB)`;

    await prisma.$executeRaw`
      INSERT INTO admin_audit_logs (actor, action, status, ip_address, user_agent, metadata)
      VALUES (
        'admin',
        ${action},
        ${status},
        ${getRequestIp(request)},
        ${request.header("user-agent")},
        ${metadataSql}
      )
    `;
  } catch (error) {
    console.error("Falha ao registrar auditoria administrativa.", error);
  }
}

export function getAdminAuditLogs() {
  return prisma.$queryRaw<AdminAuditLogRow[]>`
    SELECT
      id,
      actor,
      action,
      status,
      ip_address AS "ipAddress",
      user_agent AS "userAgent",
      metadata,
      created_at AS "createdAt"
    FROM admin_audit_logs
    ORDER BY created_at DESC
    LIMIT 100
  `;
}

function getRequestIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || request.ip;
  }

  return request.ip;
}
