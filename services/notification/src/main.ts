import { topics } from '@ecommerce/contracts';
import { correlationMiddleware, createHealthRouter, problemDetailsHandler } from '@ecommerce/http';
import { createLogger } from '@ecommerce/logger';
import { KafkaEventBus } from '@ecommerce/messaging';
import { startObservability, stopObservability } from '@ecommerce/observability';
import express from 'express';
import { NotificationApplication } from './application/notification.js';
import { config } from './infrastructure/config.js';

await startObservability({
  serviceName: config.SERVICE_NAME,
  serviceVersion: '0.1.0',
  ...(config.OTEL_EXPORTER_OTLP_ENDPOINT ? { endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT } : {}),
});
const [
  { prisma },
  { PrismaNotificationRepository },
  { SmtpEmailProvider, SesEmailProvider },
  { createOrderNotificationHandler },
] = await Promise.all([
  import('./infrastructure/prisma.js'),
  import('./infrastructure/prisma-notification-repository.js'),
  import('./infrastructure/email-providers.js'),
  import('./interfaces/messaging/order-consumer.js'),
]);
const logger = createLogger({
  service: config.SERVICE_NAME,
  environment: config.NODE_ENV,
  level: config.LOG_LEVEL,
});
const repository = new PrismaNotificationRepository(prisma);
const provider =
  config.EMAIL_PROVIDER === 'ses'
    ? new SesEmailProvider(config.AWS_REGION, config.EMAIL_FROM)
    : new SmtpEmailProvider(config.SMTP_HOST, config.SMTP_PORT, config.EMAIL_FROM);
const eventBus = new KafkaEventBus({
  clientId: config.SERVICE_NAME,
  brokers: config.KAFKA_BROKERS.split(','),
});
await eventBus.connect();
const consumer = await eventBus.subscribe(
  'notification-order-events-v1',
  [topics.orders],
  createOrderNotificationHandler(new NotificationApplication(repository, provider)),
);
const app = express();
app.use(correlationMiddleware);
app.use(createHealthRouter(() => repository.isReady()));
app.use(problemDetailsHandler);
const server = app.listen(config.PORT, '0.0.0.0', () =>
  logger.info({ port: config.PORT }, 'Notification service is listening'),
);
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  server.close();
  await consumer.disconnect();
  await eventBus.disconnect();
  await prisma.$disconnect();
  await stopObservability();
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
