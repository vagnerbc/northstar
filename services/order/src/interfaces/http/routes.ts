import { createAuthMiddleware } from '@ecommerce/auth';
import { AppError, asyncHandler, getCorrelationId, validate } from '@ecommerce/http';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { OrderApplication } from '../../application/order.js';
import { config } from '../../infrastructure/config.js';

const orderParams = z.object({ orderId: z.uuid() });
const listQuery = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const addressSchema = z.object({
  recipientName: z.string().min(2).max(120),
  line1: z.string().min(3).max(160),
  line2: z.string().max(160).optional(),
  city: z.string().min(2).max(100),
  state: z.string().length(2),
  postalCode: z.string().regex(/^\d{5}-?\d{3}$/),
  country: z.literal('BR'),
});
const checkoutBody = z.object({ shippingAddress: addressSchema });

function auth(): RequestHandler {
  if (config.AUTH_DISABLED)
    return (request, _response, next) => {
      request.auth = {
        sub: request.header('x-test-user-id') ?? 'local-demo-user',
        email: request.header('x-test-user-email') ?? 'buyer@example.com',
      };
      next();
    };
  return createAuthMiddleware({
    issuer: config.KEYCLOAK_ISSUER,
    ...(config.KEYCLOAK_JWKS_URL ? { jwksUrl: config.KEYCLOAK_JWKS_URL } : {}),
    audience: config.USER_AUTH_AUDIENCE,
  });
}

export function createOrderRouter(application: OrderApplication): Router {
  const router = Router();
  router.use('/api/v1/orders', auth());
  router.post(
    '/api/v1/orders/checkout',
    validate(checkoutBody),
    asyncHandler(async (request, response) => {
      const idempotencyKey = request.header('idempotency-key');
      if (!idempotencyKey || idempotencyKey.length > 128)
        throw new AppError('A valid Idempotency-Key is required.', 400, 'IDEMPOTENCY_KEY_REQUIRED');
      if (!request.auth?.email)
        throw new AppError('The authenticated user must have an email.', 400, 'EMAIL_REQUIRED');
      const { shippingAddress } = request.body as z.infer<typeof checkoutBody>;
      const normalizedAddress = {
        recipientName: shippingAddress.recipientName,
        line1: shippingAddress.line1,
        ...(shippingAddress.line2 ? { line2: shippingAddress.line2 } : {}),
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
      };
      const order = await application.checkout({
        userId: request.auth.sub,
        recipientEmail: request.auth.email,
        idempotencyKey,
        shippingAddress: normalizedAddress,
        correlationId: getCorrelationId(),
      });
      response
        .status(202)
        .location(`/api/v1/orders/${order.id}`)
        .json({ orderId: order.id, status: order.status, statusUrl: `/api/v1/orders/${order.id}` });
    }),
  );
  router.get(
    '/api/v1/orders',
    validate(listQuery, 'query'),
    asyncHandler(async (request, response) => {
      const query = request.query as unknown as z.infer<typeof listQuery>;
      response.json(await application.list(request.auth!.sub, query.cursor, query.limit));
    }),
  );
  router.get(
    '/api/v1/orders/:orderId',
    validate(orderParams, 'params'),
    asyncHandler(async (request, response) => {
      const { orderId } = request.params as { orderId: string };
      response.json(await application.get(orderId, request.auth!.sub));
    }),
  );
  return router;
}
