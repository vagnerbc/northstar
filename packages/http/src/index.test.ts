import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import {
  AppError,
  asyncHandler,
  correlationMiddleware,
  getCorrelationId,
  problemDetailsHandler,
  requestContext,
  validate,
} from './index.js';

describe('AppError', () => {
  it('retains its machine-readable code', () => {
    expect(new AppError('Missing', 404, 'NOT_FOUND').code).toBe('NOT_FOUND');
  });

  it('keeps valid incoming correlation IDs in asynchronous request context', () => {
    const correlationId = crypto.randomUUID();
    const request = { header: vi.fn().mockReturnValue(correlationId) } as unknown as Request;
    const setHeader = vi.fn();
    const response = { setHeader } as unknown as Response;
    const next = vi.fn(() => expect(getCorrelationId()).toBe(correlationId));

    correlationMiddleware(request, response, next);

    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', correlationId);
    expect(next).toHaveBeenCalledOnce();
  });

  it('replaces malformed correlation IDs and has a fallback outside request context', () => {
    const request = { header: vi.fn().mockReturnValue('not-a-uuid') } as unknown as Request;
    const setHeader = vi.fn();
    const response = { setHeader } as unknown as Response;

    correlationMiddleware(request, response, vi.fn());
    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', expect.any(String));
    expect(z.uuid().safeParse(getCorrelationId()).success).toBe(true);
  });

  it('validates and replaces request input with parsed values', () => {
    const middleware = validate(z.object({ quantity: z.coerce.number().int() }));
    const request = { body: { quantity: '2' } } as unknown as Request;
    const next = vi.fn();

    middleware(request, {} as Response, next);
    expect(request.body).toEqual({ quantity: 2 });
    expect(next).toHaveBeenCalledWith();
  });

  it('replaces getter-only Express 5 query input with parsed values', () => {
    const middleware = validate(z.object({ limit: z.coerce.number().int() }), 'query');
    const request = {} as Request;
    Object.defineProperty(request, 'query', {
      configurable: true,
      get: () => ({ limit: '20' }),
    });
    const next = vi.fn();

    middleware(request, {} as Response, next);

    expect(request.query).toEqual({ limit: 20 });
    expect(next).toHaveBeenCalledWith();
  });

  it('turns validation failures into a typed application error', () => {
    const middleware = validate(z.object({ quantity: z.number().positive() }));
    const next = vi.fn();

    middleware({ body: { quantity: 0 } } as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR', status: 400 }),
    );
  });

  it('forwards rejected async handlers to Express', async () => {
    const failure = new Error('handler failed');
    const next = vi.fn();
    asyncHandler(async () => Promise.reject(failure))(
      {} as Request,
      {} as Response,
      next as NextFunction,
    );

    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(failure));
  });

  it('renders safe RFC Problem Details for expected and unexpected errors', () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const request = { originalUrl: '/api/v1/orders' } as Request;

    requestContext.run({ correlationId: 'correlation' }, () => {
      problemDetailsHandler(
        new AppError('Missing', 404, 'NOT_FOUND', ['detail']),
        request,
        response,
        vi.fn(),
      );
    });
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NOT_FOUND',
        detail: 'Missing',
        correlationId: 'correlation',
      }),
    );

    problemDetailsHandler(new Error('secret'), request, response, vi.fn());
    expect(response.json).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR', detail: undefined }),
    );
  });
});
