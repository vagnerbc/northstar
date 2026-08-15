import { createAuthMiddleware } from '@ecommerce/auth';
import { asyncHandler, getCorrelationId, validate } from '@ecommerce/http';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { PaymentApplication } from '../../application/payment.js';
import { config } from '../../infrastructure/config.js';

const paymentParams = z.object({ paymentId: z.uuid() });
const createBody = z.object({
  orderId: z.uuid(),
  userId: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.literal('BRL'),
});

function userAuth(): RequestHandler {
  if (config.AUTH_DISABLED)
    return (request, _response, next) => {
      request.auth = { sub: request.header('x-test-user-id') ?? 'local-demo-user' };
      next();
    };
  return createAuthMiddleware({
    issuer: config.KEYCLOAK_ISSUER,
    ...(config.KEYCLOAK_JWKS_URL ? { jwksUrl: config.KEYCLOAK_JWKS_URL } : {}),
    audience: config.USER_AUTH_AUDIENCE,
  });
}
function internalAuth(): RequestHandler {
  if (config.AUTH_DISABLED) return (_request, _response, next) => next();
  return createAuthMiddleware({
    issuer: config.KEYCLOAK_ISSUER,
    ...(config.KEYCLOAK_JWKS_URL ? { jwksUrl: config.KEYCLOAK_JWKS_URL } : {}),
    audience: config.INTERNAL_AUTH_AUDIENCE,
    requiredScopes: ['payment:write'],
  });
}

export function createPaymentRouter(application: PaymentApplication): Router {
  const router = Router();
  router.get(
    '/api/v1/payments/:paymentId/session',
    userAuth(),
    validate(paymentParams, 'params'),
    asyncHandler(async (request, response) => {
      const { paymentId } = request.params as { paymentId: string };
      response.json(await application.session(paymentId, request.auth!.sub));
    }),
  );
  if (config.PAYMENT_PROVIDER === 'fake' && config.NODE_ENV === 'test') {
    router.post(
      '/api/v1/payments/:paymentId/fake/authorize',
      userAuth(),
      validate(paymentParams, 'params'),
      asyncHandler(async (request, response) => {
        const { paymentId } = request.params as { paymentId: string };
        response.json(await application.fakeAuthorize(paymentId, getCorrelationId()));
      }),
    );
  }

  router.use('/internal/v1/payments', internalAuth());
  router.post(
    '/internal/v1/payments',
    validate(createBody),
    asyncHandler(async (request, response) => {
      const key = request.header('idempotency-key');
      if (!key) throw new Error('Idempotency-Key is required for internal payment creation.');
      const body = request.body as z.infer<typeof createBody>;
      response.status(201).json(await application.create({ ...body, idempotencyKey: key }));
    }),
  );
  for (const operation of ['capture', 'cancel', 'refund'] as const) {
    router.post(
      `/internal/v1/payments/:paymentId/${operation}`,
      validate(paymentParams, 'params'),
      asyncHandler(async (request, response) => {
        const key = request.header('idempotency-key');
        if (!key) throw new Error('Idempotency-Key is required.');
        const { paymentId } = request.params as { paymentId: string };
        if (operation === 'capture') {
          response.json(await application.capture(paymentId, key, getCorrelationId()));
        } else if (operation === 'cancel') {
          response.json(await application.cancel(paymentId, key));
        } else {
          response.json(await application.refund(paymentId, key));
        }
      }),
    );
  }
  return router;
}
