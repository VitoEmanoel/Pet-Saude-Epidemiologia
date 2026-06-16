import type { NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sendError } from "../utils/api-response";

const ADMIN_SESSION_COOKIE = "painel_admin_session";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function requireAdminAuth(request: Request, response: Response, next: NextFunction) {
  if (!getAdminCredential()) {
    return sendAdminNotConfigured(response);
  }

  if (hasValidBearerToken(request) || hasValidSessionCookie(request)) {
    return next();
  }

  return sendError(response, 401, "unauthorized", "Sessao administrativa invalida ou ausente.");
}

export function assertAdminCredentialConfigured(response: Response) {
  if (getAdminCredential()) {
    return true;
  }

  sendAdminNotConfigured(response);
  return false;
}

export function isValidAdminPassword(password: unknown) {
  const configuredCredential = getAdminCredential();

  return (
    typeof password === "string" &&
    typeof configuredCredential === "string" &&
    safeEqual(password, configuredCredential)
  );
}

export function setAdminSessionCookie(response: Response) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
  const payload = Buffer.from(JSON.stringify({ sub: "admin", exp: expiresAt })).toString(
    "base64url"
  );
  const signature = sign(payload);

  response.cookie(ADMIN_SESSION_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
    path: "/api/admin",
    sameSite: "lax",
    secure: process.env.ADMIN_COOKIE_SECURE === "true"
  });
}

export function clearAdminSessionCookie(response: Response) {
  response.clearCookie(ADMIN_SESSION_COOKIE, {
    path: "/api/admin",
    sameSite: "lax",
    secure: process.env.ADMIN_COOKIE_SECURE === "true"
  });
}

function hasValidBearerToken(request: Request) {
  const configuredToken = process.env.ADMIN_TOKEN;

  if (!configuredToken) {
    return false;
  }

  const authorization = request.header("authorization");
  const expectedAuthorization = `Bearer ${configuredToken}`;

  return authorization === expectedAuthorization;
}

function hasValidSessionCookie(request: Request) {
  const rawCookie = request.header("cookie") ?? "";
  const cookieValue = parseCookie(rawCookie, ADMIN_SESSION_COOKIE);

  if (!cookieValue) {
    return false;
  }

  const [payload, signature] = cookieValue.split(".");

  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
      exp?: number;
    };

    return decoded.sub === "admin" && typeof decoded.exp === "number" && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function parseCookie(rawCookie: string, name: string) {
  for (const item of rawCookie.split(";")) {
    const [rawName, ...valueParts] = item.trim().split("=");

    if (rawName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

function sign(payload: string) {
  const secret = getAdminSessionSecret();
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function getAdminCredential() {
  return process.env.ADMIN_PASSWORD ?? process.env.ADMIN_TOKEN;
}

function getAdminSessionSecret() {
  const fallbackSecret = getAdminCredential();

  if (!fallbackSecret) {
    throw new Error("Credencial administrativa nao configurada.");
  }

  return process.env.ADMIN_SESSION_SECRET ?? fallbackSecret;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function sendAdminNotConfigured(response: Response) {
  return sendError(
    response,
    503,
    "admin_not_configured",
    "ADMIN_PASSWORD ou ADMIN_TOKEN nao foi configurado no backend."
  );
}
