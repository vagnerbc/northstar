import { trace } from '@opentelemetry/api';
import { requestContext } from '@ecommerce/http';
import pino, { type Logger } from 'pino';

export interface LoggerOptions {
  service: string;
  environment: string;
  level: string;
}

export function createLogger(options: LoggerOptions): Logger {
  return pino({
    level: options.level,
    base: { service: options.service, environment: options.environment },
    redact: {
      paths: [
        'req.headers.authorization',
        'authorization',
        'token',
        'accessToken',
        'clientSecret',
        'email',
        '*.email',
        'recipientEmail',
        '*.recipientEmail',
        'shippingAddress',
        '*.shippingAddress',
        'stripePayload',
      ],
      censor: '[REDACTED]',
    },
    mixin() {
      const span = trace.getActiveSpan()?.spanContext();
      const context = requestContext.getStore();
      return {
        correlationId: context?.correlationId,
        traceId: span?.traceId,
        spanId: span?.spanId,
      };
    },
  });
}
