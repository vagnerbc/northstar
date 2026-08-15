import { baseServiceConfigSchema, loadConfig } from '@ecommerce/config';
import { z } from 'zod';

const schema = baseServiceConfigSchema.extend({
  SERVICE_NAME: z.literal('payment-service').default('payment-service'),
  PORT: z.coerce.number().int().positive().default(3004),
  AUTH_DISABLED: z.stringbool().default(false),
  USER_AUTH_AUDIENCE: z.string().default('web-app'),
  INTERNAL_AUTH_AUDIENCE: z.string().default('payment-service'),
  PAYMENT_PROVIDER: z.enum(['stripe', 'fake']).default('stripe'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  OUTBOX_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
});

export const config = loadConfig(schema);

if (config.PAYMENT_PROVIDER === 'fake' && config.NODE_ENV !== 'test') {
  throw new Error('The fake payment provider is restricted to NODE_ENV=test.');
}
if (
  config.PAYMENT_PROVIDER === 'stripe' &&
  (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET)
) {
  throw new Error('Stripe mode requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.');
}
