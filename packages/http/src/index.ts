import { AsyncLocalStorage } from 'node:async_hooks';
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

export interface RequestContext {
  correlationId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export class AppError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const correlationMiddleware: RequestHandler = (request, response, next) => {
  const incoming = request.header('x-correlation-id');
  const correlationId =
    incoming && z.uuid().safeParse(incoming).success ? incoming : crypto.randomUUID();
  response.setHeader('x-correlation-id', correlationId);
  requestContext.run({ correlationId }, next);
};

export function getCorrelationId(): string {
  return requestContext.getStore()?.correlationId ?? crypto.randomUUID();
}

export function validate<TSchema extends z.ZodType>(
  schema: TSchema,
  source: 'body' | 'params' | 'query' = 'body',
): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source]);
    if (!result.success) {
      next(new AppError('The request is invalid.', 400, 'VALIDATION_ERROR', result.error.issues));
      return;
    }
    request[source] = result.data;
    next();
  };
}

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export const problemDetailsHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const appError =
    error instanceof AppError
      ? error
      : new AppError('Internal server error.', 500, 'INTERNAL_ERROR');
  response
    .status(appError.status)
    .type('application/problem+json')
    .json({
      type: `https://ecommerce.local/problems/${appError.code.toLowerCase()}`,
      title: appError.message,
      status: appError.status,
      code: appError.code,
      detail: appError.status < 500 ? appError.message : undefined,
      instance: request.originalUrl,
      correlationId: getCorrelationId(),
      errors: appError.details,
    });
};

export function createHealthRouter(readiness: () => Promise<boolean>): Router {
  const router = Router();
  router.get('/health/live', (_request, response) => response.json({ status: 'ok' }));
  router.get(
    '/health/ready',
    asyncHandler(async (_request, response) => {
      const ready = await readiness();
      response.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready' });
    }),
  );
  return router;
}
