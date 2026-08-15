import { topics } from '@ecommerce/contracts';
import { createLogger } from '@ecommerce/logger';
import { KafkaEventBus } from '@ecommerce/messaging';
import { startObservability, stopObservability } from '@ecommerce/observability';
import { config } from './infrastructure/config.js';

await startObservability({
  serviceName: config.SERVICE_NAME,
  serviceVersion: '0.1.0',
  ...(config.OTEL_EXPORTER_OTLP_ENDPOINT ? { endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT } : {}),
});

const [
  { createApp },
  { prisma },
  { PrismaCartRepository },
  { HttpProductCatalog },
  { createOrderEventHandler },
] = await Promise.all([
  import('./app.js'),
  import('./infrastructure/prisma.js'),
  import('./infrastructure/prisma-cart-repository.js'),
  import('./infrastructure/catalog-client.js'),
  import('./interfaces/messaging/order-consumer.js'),
]);
const logger = createLogger({
  service: config.SERVICE_NAME,
  environment: config.NODE_ENV,
  level: config.LOG_LEVEL,
});
const repository = new PrismaCartRepository(prisma);
const eventBus = new KafkaEventBus({
  clientId: config.SERVICE_NAME,
  brokers: config.KAFKA_BROKERS.split(','),
});
await eventBus.connect();
const consumer = await eventBus.subscribe(
  'cart-order-events-v1',
  [topics.orders],
  createOrderEventHandler(repository),
);
const server = createApp(repository, new HttpProductCatalog(config.CATALOG_BASE_URL)).listen(
  config.PORT,
  '0.0.0.0',
  () => {
    logger.info({ port: config.PORT }, 'Cart service is listening');
  },
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
