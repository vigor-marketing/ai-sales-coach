import type { Response } from 'express';

export interface ApiErrorBody {
  code: string;
  message: string;
  traceId: string;
  details?: unknown;
}

export function getTraceId(res: Response): string {
  return (res.locals.traceId as string | undefined) || 'unknown';
}

export function sendApiError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response<ApiErrorBody> {
  const body: ApiErrorBody = { code, message, traceId: getTraceId(res) };
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
}
