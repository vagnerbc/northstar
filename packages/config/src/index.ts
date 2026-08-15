import { z } from 'zod';

export const runtimeEnvironmentSchema = z.enum(['development', 'test', 'production']);

export const baseServiceConfigSchema = z.object({
  NODE_ENV: runtimeEnvironmentSchema.default('development'),
  SERVICE_NAME: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().url(),
  KAFKA_BROKERS: z.string().default('kafka:9092'),
  KAFKA_AUTH_MODE: z.enum(['plaintext', 'aws-iam']).default('plaintext'),
  AWS_REGION: z.string().default('us-east-1'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  KEYCLOAK_ISSUER: z.string().url().default('http://keycloak:8080/realms/ecommerce'),
  KEYCLOAK_JWKS_URL: z.string().url().optional(),
});

export type BaseServiceConfig = z.infer<typeof baseServiceConfigSchema>;

export function loadConfig<TSchema extends z.ZodType>(schema: TSchema): z.output<TSchema> {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const details = z.prettifyError(parsed.error);
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return parsed.data;
}

export function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
