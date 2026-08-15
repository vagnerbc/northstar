import { createAuthMiddleware } from '@ecommerce/auth';
import { asyncHandler, validate } from '@ecommerce/http';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { CartApplication } from '../../application/cart.js';
import type { CartRepository } from '../../application/ports.js';
import { config } from '../../infrastructure/config.js';

const itemBody = z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(99) });
const quantityBody = z.object({ quantity: z.number().int().min(1).max(99) });
const productParams = z.object({ productId: z.uuid() });
const userParams = z.object({ userId: z.string().min(1) });

function auth(requiredScopes?: string[]): RequestHandler {
  if (config.AUTH_DISABLED) {
    return (request, _response, next) => {
      request.auth = {
        sub: request.header('x-test-user-id') ?? 'local-demo-user',
        email: 'buyer@example.com',
      };
      next();
    };
  }
  return createAuthMiddleware({
    issuer: config.KEYCLOAK_ISSUER,
    ...(config.KEYCLOAK_JWKS_URL ? { jwksUrl: config.KEYCLOAK_JWKS_URL } : {}),
    audience: requiredScopes ? config.INTERNAL_AUTH_AUDIENCE : config.USER_AUTH_AUDIENCE,
    ...(requiredScopes ? { requiredScopes } : {}),
  });
}

export function createCartRouter(application: CartApplication, repository: CartRepository): Router {
  const router = Router();
  router.use('/api/v1/cart', auth());
  router.get(
    '/api/v1/cart',
    asyncHandler(async (request, response) =>
      response.json(await application.get(request.auth!.sub)),
    ),
  );
  router.post(
    '/api/v1/cart/items',
    validate(itemBody),
    asyncHandler(async (request, response) => {
      const body = request.body as z.infer<typeof itemBody>;
      response
        .status(201)
        .json(await application.add(request.auth!.sub, body.productId, body.quantity));
    }),
  );
  router.patch(
    '/api/v1/cart/items/:productId',
    validate(productParams, 'params'),
    validate(quantityBody),
    asyncHandler(async (request, response) => {
      const { productId } = request.params as { productId: string };
      const { quantity } = request.body as z.infer<typeof quantityBody>;
      response.json(await application.setQuantity(request.auth!.sub, productId, quantity));
    }),
  );
  router.delete(
    '/api/v1/cart/items/:productId',
    validate(productParams, 'params'),
    asyncHandler(async (request, response) => {
      const { productId } = request.params as { productId: string };
      response.json(await application.remove(request.auth!.sub, productId));
    }),
  );

  router.get(
    '/internal/v1/carts/:userId',
    auth(['cart:read']),
    validate(userParams, 'params'),
    asyncHandler(async (request, response) => {
      const { userId } = request.params as { userId: string };
      response.json(await repository.getOrCreate(userId));
    }),
  );
  return router;
}
