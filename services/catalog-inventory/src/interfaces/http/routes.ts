import { createAuthMiddleware } from '@ecommerce/auth';
import { asyncHandler, getCorrelationId, validate } from '@ecommerce/http';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { CatalogApplication } from '../../application/catalog.js';
import { config } from '../../infrastructure/config.js';

const idParams = z.object({ productId: z.uuid() });
const orderParams = z.object({ orderId: z.uuid() });
const listQuery = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const reserveBody = z.object({
  items: z
    .array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(99) }))
    .min(1),
});

export function createCatalogRouter(application: CatalogApplication): Router {
  const router = Router();
  router.get(
    '/api/v1/products',
    validate(listQuery, 'query'),
    asyncHandler(async (request, response) => {
      const query = request.query as unknown as z.infer<typeof listQuery>;
      response.json(await application.list(query.cursor, query.limit));
    }),
  );
  router.get(
    '/api/v1/products/:productId',
    validate(idParams, 'params'),
    asyncHandler(async (request, response) => {
      const { productId } = request.params as { productId: string };
      response.json(await application.get(productId));
    }),
  );

  const internalAuth: RequestHandler = config.AUTH_DISABLED
    ? (_request, _response, next) => next()
    : createAuthMiddleware({
        issuer: config.KEYCLOAK_ISSUER,
        ...(config.KEYCLOAK_JWKS_URL ? { jwksUrl: config.KEYCLOAK_JWKS_URL } : {}),
        audience: config.INTERNAL_AUTH_AUDIENCE,
        requiredScopes: ['inventory:write'],
      });
  router.use('/internal/v1/inventory', internalAuth);
  router.post(
    '/internal/v1/inventory/reservations/:orderId',
    validate(orderParams, 'params'),
    validate(reserveBody),
    asyncHandler(async (request, response) => {
      const body = request.body as z.infer<typeof reserveBody>;
      const { orderId } = request.params as { orderId: string };
      const result = await application.reserve(orderId, body.items, getCorrelationId());
      response.status(201).json(result);
    }),
  );
  router.post(
    '/internal/v1/inventory/reservations/:orderId/commit',
    validate(orderParams, 'params'),
    asyncHandler(async (request, response) => {
      const { orderId } = request.params as { orderId: string };
      response.json(await application.commit(orderId, getCorrelationId()));
    }),
  );
  router.post(
    '/internal/v1/inventory/reservations/:orderId/release',
    validate(orderParams, 'params'),
    asyncHandler(async (request, response) => {
      const { orderId } = request.params as { orderId: string };
      response.json(await application.release(orderId, getCorrelationId()));
    }),
  );
  return router;
}
