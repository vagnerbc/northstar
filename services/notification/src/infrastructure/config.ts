import { baseServiceConfigSchema, loadConfig } from '@ecommerce/config';
import { z } from 'zod';

const schema = baseServiceConfigSchema.extend({
  SERVICE_NAME: z.literal('notification-service').default('notification-service'),
  PORT: z.coerce.number().int().positive().default(3005),
  EMAIL_PROVIDER: z.enum(['smtp', 'ses']).default('smtp'),
  EMAIL_FROM: z.email().default('orders@ecommerce.local'),
  SMTP_HOST: z.string().default('mailpit'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  AWS_REGION: z.string().default('us-east-1'),
});
export const config = loadConfig(schema);
