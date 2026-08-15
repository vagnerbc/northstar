import { baseServiceConfigSchema, loadConfig } from '@ecommerce/config';
import { z } from 'zod';

const schema = baseServiceConfigSchema.extend({
  SERVICE_NAME: z.literal('catalog-inventory-service').default('catalog-inventory-service'),
  PORT: z.coerce.number().int().positive().default(3001),
  AUTH_DISABLED: z.stringbool().default(false),
  INTERNAL_AUTH_AUDIENCE: z.string().default('catalog-inventory-service'),
  RESERVATION_TTL_MS: z.coerce.number().int().positive().default(900_000),
  OUTBOX_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
});

export const config = loadConfig(schema);
