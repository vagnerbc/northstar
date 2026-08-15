import { baseServiceConfigSchema, loadConfig } from '@ecommerce/config';
import { z } from 'zod';

const schema = baseServiceConfigSchema.extend({
  SERVICE_NAME: z.literal('cart-service').default('cart-service'),
  PORT: z.coerce.number().int().positive().default(3002),
  AUTH_DISABLED: z.stringbool().default(false),
  USER_AUTH_AUDIENCE: z.string().default('web-app'),
  INTERNAL_AUTH_AUDIENCE: z.string().default('cart-service'),
  CATALOG_BASE_URL: z.string().url().default('http://catalog-inventory-service:3001'),
});

export const config = loadConfig(schema);
