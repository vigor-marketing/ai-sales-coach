import type { Request, Response, NextFunction } from 'express';
import { getTraceId } from '../utils/apiResponse.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const traceId = getTraceId(res);
  const status = err.message === 'Origin is not allowed by CORS' ? 403 : 500;
  const code = status === 403 ? 'CORS_ORIGIN_DENIED' : 'INTERNAL_ERROR';
  console.error(JSON.stringify({ type: 'error', traceId, message: err.message, stack: err.stack }));
  res.status(status).json({ code, message: status === 403 ? '请求来源未被允许' : '服务器内部错误', traceId });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ code: 'NOT_FOUND', message: '接口不存在', traceId: getTraceId(res) });
}
