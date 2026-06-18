import type { NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sendError } from "../utils/api-response";

const ADMIN_SESSION_COOKIE = "painel_admin_session";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;

type LoginAttemptState = {
  count: number;
  resetAt: number;
};

const failedLoginAttempts = new Map<string, LoginAttemptState>();

export function requireAdminAuth(request: Request, response: Response, next: NextFunction) {
  if (!isAdminSecurityConfigured()) {
    return sendAdminNotConfigured(response);
  }

  if (hasValidBearerToken(request) || hasValidSessionCookie(request)) {
    return next();
  }

  return sendError(response, 401, "unauthorized", "Sessao administrativa invalida ou ausente.");
}

export function assertAdminSecurityConfigured(response: Response) {
  if (isAdminSecurityConfigured()) {
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

export function isAllowedAdminOrigin(request: Request) {
  const origin = request.header("origin");

  if (!origin) {
    return true;
  }

  const allowedOrigins = getAllowedAdminOrigins();

  return allowedOrigins.length === 0 || allowedOrigins.includes(origin);
}

export function getAdminLoginRateLimit(request: Request) {
  const key = getLoginAttemptKey(request);
  const state = getOrCreateLoginAttemptState(key);

  if (state.count < ADMIN_LOGIN_MAX_ATTEMPTS) {
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
  const state = getOrCreateLoginAttemptState(key);

  state.count += 1;
  state.resetAt = Date.now() + ADMIN_LOGIN_WINDOW_MS;
  failedLoginAttempts.set(key, state);
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
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET nao foi configurado no backend.");
  }

  return secret;
}

function isAdminSecurityConfigured() {
  return Boolean(getAdminCredential() && process.env.ADMIN_SESSION_SECRET);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
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

function getOrCreateLoginAttemptState(key: string): LoginAttemptState {
  const currentState = failedLoginAttempts.get(key);

  if (currentState && currentState.resetAt > Date.now()) {
    return currentState;
  }

  const freshState = {
    count: 0,
    resetAt: Date.now() + ADMIN_LOGIN_WINDOW_MS
  };

  failedLoginAttempts.set(key, freshState);
  return freshState;
}

function sendAdminNotConfigured(response: Response) {
  return sendError(
    response,
    503,
    "admin_not_configured",
    "ADMIN_PASSWORD, ADMIN_TOKEN ou ADMIN_SESSION_SECRET nao foi configurado no backend."
  );
}

export function resetAdminSecurityState() {
  failedLoginAttempts.clear();
}
