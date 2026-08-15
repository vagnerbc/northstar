import { topics } from '@ecommerce/contracts';
import { createLogger } from '@ecommerce/logger';
import { KafkaEventBus } from '@ecommerce/messaging';
import { startObservability, stopObservability } from '@ecommerce/observability';
import { Connection, WorkflowClient } from '@temporalio/client';
import { NativeConnection, Worker } from '@temporalio/worker';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { config } from './infrastructure/config.js';

await startObservability({
  serviceName: 'checkout-worker',
  serviceVersion: '0.1.0',
  ...(config.OTEL_EXPORTER_OTLP_ENDPOINT ? { endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT } : {}),
});
const [
  { prisma },
  { PrismaOrderRepository },
  { createActivities },
  { createCheckoutEventHandler },
] = await Promise.all([
  import('./infrastructure/prisma.js'),
  import('./infrastructure/prisma-order-repository.js'),
  import('./temporal/activities.js'),
  import('./interfaces/messaging/checkout-handler.js'),
]);
const logger = createLogger({
  service: 'checkout-worker',
  environment: config.NODE_ENV,
  level: config.LOG_LEVEL,
});
const temporalOptions = config.TEMPORAL_API_KEY
  ? { address: config.TEMPORAL_ADDRESS, tls: true, apiKey: config.TEMPORAL_API_KEY }
  : { address: config.TEMPORAL_ADDRESS };
const [clientConnection, workerConnection] = await Promise.all([
  Connection.connect(temporalOptions),
  NativeConnection.connect(temporalOptions),
]);
const client = new WorkflowClient({
  connection: clientConnection,
  namespace: config.TEMPORAL_NAMESPACE,
});
const repository = new PrismaOrderRepository(prisma);
const adjacentWorkflowPath = fileURLToPath(new URL('./temporal/workflows.ts', import.meta.url));
// Development runs beside the source file; the production bundle retains source for Temporal's deterministic bundler.
const workflowsPath = existsSync(adjacentWorkflowPath)
  ? adjacentWorkflowPath
  : fileURLToPath(new URL('../src/temporal/workflows.ts', import.meta.url));
const worker = await Worker.create({
  connection: workerConnection,
  namespace: config.TEMPORAL_NAMESPACE,
  taskQueue: 'checkout-v1',
  workflowsPath,
  activities: createActivities(repository),
});
const eventBus = new KafkaEventBus({
  clientId: 'checkout-worker',
  brokers: config.KAFKA_BROKERS.split(','),
});
await eventBus.connect();
const consumer = await eventBus.subscribe(
  'checkout-worker-v1',
  [topics.orders, topics.payments],
  createCheckoutEventHandler(client, repository),
);
logger.info('Checkout worker is running');
const healthServer = createServer((request, response) => {
  if (request.url === '/health/live' || request.url === '/health/ready') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: request.url.endsWith('ready') ? 'ready' : 'ok' }));
    return;
  }
  response.writeHead(404).end();
}).listen(config.WORKER_PORT, '0.0.0.0');
const runPromise = worker.run();
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  worker.shutdown();
  healthServer.close();
  await runPromise;
  await consumer.disconnect();
  await eventBus.disconnect();
  await clientConnection.close();
  await workerConnection.close();
  await prisma.$disconnect();
  await stopObservability();
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
