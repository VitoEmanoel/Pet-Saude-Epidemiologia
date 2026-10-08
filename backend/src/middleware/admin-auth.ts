import type { NextFunction, Request, Response } from "express";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../database/prisma";
import { ADMIN_PERMISSIONS, effectivePermissions, type AdminPermission, type AdminRole } from "../modules/admin/admin-users.service";
import { sendError } from "../utils/api-response";

const ADMIN_SESSION_COOKIE = "painel_admin_session";
// Com o site fora da raiz do domínio (PUBLIC_BASE_PATH, ex.: "/painel"), o navegador chama
// /painel/api/admin/...: o cookie precisa desse caminho para ser enviado.
const ADMIN_SESSION_COOKIE_PATH = `${(process.env.PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "")}/api/admin`;
const LEGACY_ADMIN_SESSION_COOKIE_PATH = "/";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
// Acima disso, entradas vencidas são descartadas (evita o mapa crescer com IPs variados).
const LOGIN_ATTEMPTS_PRUNE_THRESHOLD = 1000;

type LoginAttemptState = {
  count: number;
  resetAt: number;
};

const failedLoginAttempts = new Map<string, LoginAttemptState>();

/** Quem está usando o admin nesta requisição (7.4), em response.locals.adminUser. */
export type AdminRequestUser = {
  id: number;
  username: string;
  name: string;
  role: AdminRole;
  /** Permissões que valem (administrador: todas). */
  permissions: AdminPermission[];
  mustChangePassword: boolean;
};

// Token de API (ADMIN_ALLOW_BEARER_TOKEN, desligado por padrão): age como administrador.
const BEARER_TOKEN_USER: AdminRequestUser = { id: 0, username: "token_api", name: "Token da API", role: "admin", permissions: [...ADMIN_PERMISSIONS], mustChangePassword: false };

export function getRequestAdminUser(response: Response): AdminRequestUser | null {
  return (response.locals.adminUser as AdminRequestUser | undefined) ?? null;
}

export async function requireAdminAuth(request: Request, response: Response, next: NextFunction) {
  if (!isAdminSecurityConfigured()) {
    return sendAdminNotConfigured(response);
  }

  if (hasValidBearerToken(request)) {
    response.locals.adminUser = BEARER_TOKEN_USER;
    return next();
  }

  try {
    const session = await findActiveSession(request);

    if (session) {
      response.locals.adminSessionId = session.id;
      response.locals.adminUser = session.user;
      return next();
    }
  } catch (error) {
    return next(error);
  }

  return sendError(response, 401, "unauthorized", "Sessão administrativa inválida ou ausente.");
}

export function assertAdminSecurityConfigured(response: Response) {
  if (isAdminSecurityConfigured()) {
    return true;
  }

  sendAdminNotConfigured(response);
  return false;
}

/**
 * Com senha temporária (conta nova ou senha redefinida), a pessoa só consegue trocar a senha,
 * ver quem é e sair: todo o resto responde 403 até a troca.
 */
export function requirePasswordChanged(request: Request, response: Response, next: NextFunction) {
  const user = getRequestAdminUser(response);
  const allowed = ["/auth/me", "/auth/logout", "/account/password"];

  if (user?.mustChangePassword && !allowed.includes(request.path)) {
    return sendError(response, 403, "password_change_required", "Troque a senha temporária antes de continuar.");
  }

  return next();
}

const PERMISSION_LABELS: Record<AdminPermission, string> = {
  exportar: "baixar dados",
  sincronizar: "sincronizar fontes",
  populacao: "enviar a população",
  auditoria: "ver a auditoria"
};

/** Só quem tem a permissão (o administrador escolhe ao criar a conta; administrador tem todas). */
export function requirePermission(permission: AdminPermission) {
  return (_request: Request, response: Response, next: NextFunction) => {
    if (!getRequestAdminUser(response)?.permissions.includes(permission)) {
      return sendError(response, 403, "forbidden", `Sua conta não tem permissão para ${PERMISSION_LABELS[permission]}.`);
    }

    return next();
  };
}

/** Só administradores (gerência de usuários). */
export function requireAdminRole(_request: Request, response: Response, next: NextFunction) {
  if (getRequestAdminUser(response)?.role !== "admin") {
    return sendError(response, 403, "forbidden", "Só administradores podem gerenciar usuários.");
  }

  return next();
}

export function isAllowedAdminOrigin(request: Request) {
  const origin = request.header("origin");

  if (!origin) {
    return true;
  }

  const allowedOrigins = getAllowedAdminOrigins();

  return allowedOrigins.length === 0 || allowedOrigins.includes(origin);
}

// O bloqueio é por IP real do visitante (request.ip, ver TRUST_PROXY): tentativas de
// terceiros não trancam o administrador que acessa de outro endereço.
export function getAdminLoginRateLimit(request: Request) {
  const state = getActiveLoginAttemptState(getLoginAttemptKey(request));

  if (!state || state.count < ADMIN_LOGIN_MAX_ATTEMPTS) {
    return {
      limited: false,
      retryAfterSeconds: 0
    };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((state.resetAt - Date.now()) / 1000));

  return {
    limited: true,
    retryAfterSeconds
  };
}

export function registerFailedAdminLogin(request: Request) {
  const key = getLoginAttemptKey(request);
  const state = getActiveLoginAttemptState(key) ?? { count: 0, resetAt: 0 };

  state.count += 1;
  state.resetAt = Date.now() + ADMIN_LOGIN_WINDOW_MS;
  failedLoginAttempts.set(key, state);

  if (failedLoginAttempts.size > LOGIN_ATTEMPTS_PRUNE_THRESHOLD) {
    pruneExpiredLoginAttempts();
  }
}

export function clearAdminLoginAttempts(request: Request) {
  failedLoginAttempts.delete(getLoginAttemptKey(request));
}

export function setAdminSecurityHeaders(response: Response) {
  response.setHeader("cache-control", "no-store, private, max-age=0, must-revalidate");
  response.setHeader("pragma", "no-cache");
  response.setHeader("expires", "0");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader(
    "content-security-policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  );
}

/**
 * Cria a sessão no banco e envia o cookie assinado com o id dela. Guardar a sessão no servidor
 * permite que o logout a invalide de verdade, mesmo que alguém tenha copiado o cookie (S11).
 */
export async function startAdminSession(response: Response, userId: number) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
  const sessionId = randomBytes(32).toString("base64url");

  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.adminSession.create({ data: { id: sessionId, userId, expiresAt: new Date(expiresAt) } });
  response.locals.adminSessionId = sessionId;

  const payload = Buffer.from(
    JSON.stringify({ sub: "admin", exp: expiresAt, sid: sessionId })
  ).toString("base64url");
  const signature = sign(payload);

  response.cookie(ADMIN_SESSION_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
    path: ADMIN_SESSION_COOKIE_PATH,
    sameSite: "strict",
    secure: isSecureAdminCookieEnabled()
  });
}

/** Revoga no banco a sessão usada nesta requisição (definida por requireAdminAuth). */
export async function revokeAdminSession(response: Response) {
  const sessionId = response.locals.adminSessionId;

  if (typeof sessionId === "string") {
    await prisma.adminSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
}

export function clearAdminSessionCookie(response: Response) {
  for (const path of [ADMIN_SESSION_COOKIE_PATH, LEGACY_ADMIN_SESSION_COOKIE_PATH]) {
    response.clearCookie(ADMIN_SESSION_COOKIE, {
      path,
      sameSite: "strict",
      secure: isSecureAdminCookieEnabled()
    });
  }
}

function hasValidBearerToken(request: Request) {
  if (process.env.ADMIN_ALLOW_BEARER_TOKEN !== "true") {
    return false;
  }

  const configuredToken = process.env.ADMIN_TOKEN;

  if (!configuredToken) {
    return false;
  }

  const authorization = request.header("authorization");
  const expectedAuthorization = `Bearer ${configuredToken}`;

  return safeEqual(authorization ?? "", expectedAuthorization);
}

async function findActiveSession(request: Request): Promise<{ id: string; user: AdminRequestUser } | null> {
  const rawCookie = request.header("cookie") ?? "";
  const sessionIds = parseCookieValues(rawCookie, ADMIN_SESSION_COOKIE)
    .map(getSignedSessionId)
    .filter((sessionId): sessionId is string => sessionId !== null);

  if (sessionIds.length === 0) {
    return null;
  }

  // Sessão válida de uma conta ativa (sessões de antes do 7.4, sem conta, não valem mais).
  const session = await prisma.adminSession.findFirst({
    where: { id: { in: sessionIds }, revokedAt: null, expiresAt: { gt: new Date() }, user: { active: true } },
    select: { id: true, user: { select: { id: true, username: true, name: true, role: true, permissions: true, mustChangePassword: true } } }
  });

  return session?.user
    ? { id: session.id, user: { ...session.user, role: session.user.role as AdminRole, permissions: effectivePermissions(session.user) } }
    : null;
}

/** Id da sessão de um cookie com assinatura válida e não expirado; null se não for. */
function getSignedSessionId(cookieValue: string) {
  const [payload, signature] = cookieValue.split(".");

  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
      exp?: number;
      sid?: string;
    };

    const isValid =
      decoded.sub === "admin" &&
      typeof decoded.exp === "number" &&
      decoded.exp > Date.now() &&
      typeof decoded.sid === "string";

    return isValid ? (decoded.sid as string) : null;
  } catch {
    return null;
  }
}

function parseCookieValues(rawCookie: string, name: string) {
  const values: string[] = [];

  for (const item of rawCookie.split(";")) {
    const [rawName, ...valueParts] = item.trim().split("=");

    if (rawName === name) {
      values.push(decodeURIComponent(valueParts.join("=")));
    }
  }

  return values;
}

function sign(payload: string) {
  const secret = getAdminSessionSecret();
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

function getAdminSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET não foi configurado no backend.");
  }

  return secret;
}

function isAdminSecurityConfigured() {
  return Boolean(getAdminCredentials() && process.env.ADMIN_SESSION_SECRET);
}

/** Aviso para o log quando o site está em HTTPS mas o cookie do admin não tem `Secure` (S9). */
export function getAdminCookieSecurityWarning() {
  const usesHttps = getAllowedAdminOrigins().some((origin) => origin.startsWith("https://"));

  if (usesHttps && !isSecureAdminCookieEnabled()) {
    return "CORS_ORIGIN usa HTTPS, mas ADMIN_COOKIE_SECURE não é true: defina ADMIN_COOKIE_SECURE=true.";
  }

  return null;
}

/**
 * Avisos de configuração fraca quando o sistema parece publicado (origem que não é localhost),
 * para quem sobe sem o start.sh, que já recusa esses casos (S15).
 */
export function getWeakConfigWarnings() {
  const isPublished = getAllowedAdminOrigins().some(
    (origin) => !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(origin)
  );

  if (!isPublished) {
    return [];
  }

  const warnings: string[] = [];
  const databasePassword = (() => {
    try {
      return decodeURIComponent(new URL(process.env.DATABASE_URL ?? "").password);
    } catch {
      return "";
    }
  })();

  if (databasePassword === "postgres" || databasePassword.length < 12) {
    warnings.push("senha do banco padrao ou com menos de 12 caracteres (POSTGRES_PASSWORD).");
  }

  if ((process.env.ADMIN_PASSWORD ?? "").length < 12) {
    warnings.push("ADMIN_PASSWORD com menos de 12 caracteres.");
  }

  if ((process.env.ADMIN_SESSION_SECRET ?? "").length < 32) {
    warnings.push("ADMIN_SESSION_SECRET com menos de 32 caracteres.");
  }

  return warnings;
}

function isSecureAdminCookieEnabled() {
  return process.env.ADMIN_COOKIE_SECURE === "true";
}

/**
 * Compara em tempo constante. Os dois lados viram hashes SHA-256 (sempre 32 bytes), então
 * nem o tamanho do valor esperado vaza pelo tempo de resposta (S16).
 */
function safeEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();

  return timingSafeEqual(leftHash, rightHash);
}

function getAllowedAdminOrigins() {
  const rawOrigins = process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? "";

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function getLoginAttemptKey(request: Request) {
  return request.ip || request.socket.remoteAddress || "unknown";
}

function getActiveLoginAttemptState(key: string): LoginAttemptState | undefined {
  const state = failedLoginAttempts.get(key);

  if (state && state.resetAt > Date.now()) {
    return state;
  }

  failedLoginAttempts.delete(key);
  return undefined;
}

function pruneExpiredLoginAttempts() {
  const now = Date.now();

  for (const [key, state] of failedLoginAttempts) {
    if (state.resetAt <= now) {
      failedLoginAttempts.delete(key);
    }
  }
}

function sendAdminNotConfigured(response: Response) {
  return sendError(
    response,
    503,
    "admin_not_configured",
    "ADMIN_USERNAME, ADMIN_PASSWORD ou ADMIN_SESSION_SECRET não foi configurado no backend."
  );
}

export function resetAdminSecurityState() {
  failedLoginAttempts.clear();
}
