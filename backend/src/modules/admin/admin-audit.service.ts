import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";

// Quem fez a ação: o usuário administrador configurado. Tentativas sem login (senha errada,
// bloqueio) usam UNIDENTIFIED_ACTOR; o usuário digitado fica em metadata.username.
export const UNIDENTIFIED_ACTOR = "nao_identificado";

export function getAdminActor() {
  return process.env.ADMIN_USERNAME?.trim() || "admin";
}

type AdminAuditInput = {
  request: Request;
  actor?: string;
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
  actor = getAdminActor(),
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
        ${actor.slice(0, 100)},
        ${action},
        ${status},
        ${request.ip ?? null},
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
    LIMIT 500
  `;
}

