import type { Response } from "express";

export type ApiErrorCode =
  | "not_found"
  | "invalid_query"
  | "invalid_body"
  | "payload_too_large"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "admin_not_configured"
  | "sync_already_running"
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
