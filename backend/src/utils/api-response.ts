import type { Response } from "express";

export type ApiErrorCode =
  | "not_found"
  | "invalid_query"
  | "unauthorized"
  | "admin_not_configured"
  | "not_implemented"
  | "internal_error";

export function sendError(
  response: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown
) {
  return response.status(status).json({
    error: {
      code,
      message,
      details
    }
  });
}

