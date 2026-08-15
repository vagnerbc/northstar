import { createLogger } from '@ecommerce/logger';
import { KafkaEventBus } from '@ecommerce/messaging';
import { startObservability, stopObservability } from '@ecommerce/observability';
import { PaymentApplication } from './application/payment.js';
import { config } from './infrastructure/config.js';

await startObservability({
  serviceName: config.SERVICE_NAME,
  serviceVersion: '0.1.0',
  ...(config.OTEL_EXPORTER_OTLP_ENDPOINT ? { endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT } : {}),
});
const [
  { createApp },
  { prisma },
  { PrismaPaymentRepository },
  { FakePaymentProvider, StripePaymentProvider },
  { startOutboxRelay },
] = await Promise.all([
  import('./app.js'),
  import('./infrastructure/prisma.js'),
  import('./infrastructure/prisma-payment-repository.js'),
  import('./infrastructure/providers.js'),
  import('./infrastructure/outbox-relay.js'),
]);
const logger = createLogger({
  service: config.SERVICE_NAME,
  environment: config.NODE_ENV,
  level: config.LOG_LEVEL,
});
const repository = new PrismaPaymentRepository(prisma);
const provider =
  config.PAYMENT_PROVIDER === 'fake'
    ? new FakePaymentProvider()
    : new StripePaymentProvider(config.STRIPE_SECRET_KEY!, config.STRIPE_WEBHOOK_SECRET!);
const eventBus = new KafkaEventBus({
  clientId: config.SERVICE_NAME,
  brokers: config.KAFKA_BROKERS.split(','),
});
await eventBus.connect();
const stopRelay = startOutboxRelay(prisma, eventBus, logger, config.OUTBOX_INTERVAL_MS);
const server = createApp(new PaymentApplication(repository, provider), repository).listen(
  config.PORT,
  '0.0.0.0',
  () => logger.info({ port: config.PORT }, 'Payment service is listening'),
);

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  stopRelay();
  server.close();
  await eventBus.disconnect();
  await prisma.$disconnect();
  await stopObservability();
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
