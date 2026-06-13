import type { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/api-response";

export function requireAdminAuth(request: Request, response: Response, next: NextFunction) {
  const configuredToken = process.env.ADMIN_TOKEN;

  if (!configuredToken) {
    return sendError(
      response,
      503,
      "admin_not_configured",
      "ADMIN_TOKEN nao foi configurado no backend."
    );
  }

  const authorization = request.header("authorization");
  const expectedAuthorization = `Bearer ${configuredToken}`;

  if (authorization !== expectedAuthorization) {
    return sendError(response, 401, "unauthorized", "Token administrativo invalido ou ausente.");
  }

  return next();
}

