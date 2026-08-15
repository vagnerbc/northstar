import { baseServiceConfigSchema, loadConfig } from '@ecommerce/config';
import { z } from 'zod';

const schema = baseServiceConfigSchema.extend({
  SERVICE_NAME: z.literal('order-service').default('order-service'),
  PORT: z.coerce.number().int().positive().default(3003),
  WORKER_PORT: z.coerce.number().int().positive().default(3006),
  AUTH_DISABLED: z.stringbool().default(false),
  USER_AUTH_AUDIENCE: z.string().default('web-app'),
  CART_BASE_URL: z.string().url().default('http://cart-service:3002'),
  INVENTORY_BASE_URL: z.string().url().default('http://catalog-inventory-service:3001'),
  PAYMENT_BASE_URL: z.string().url().default('http://payment-service:3004'),
  SERVICE_CLIENT_ID: z.string().default('order-service'),
  SERVICE_CLIENT_SECRET: z.string().default('local-order-secret'),
  SERVICE_CLIENT_SCOPE: z.string().default('cart:read inventory:write payment:write'),
  KEYCLOAK_TOKEN_URL: z.string().url().optional(),
  TEMPORAL_ADDRESS: z.string().default('temporal:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),
  TEMPORAL_API_KEY: z.string().optional(),
  PAYMENT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  PAYMENT_CAPTURE_WINDOW_MS: z.coerce.number().int().positive().default(120_000),
  OUTBOX_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
});

export const config = loadConfig(schema);
