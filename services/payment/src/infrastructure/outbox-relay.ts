import type { EventPublisher } from '@ecommerce/messaging';
import { createOutboxMetrics } from '@ecommerce/observability';
import type { Logger } from 'pino';
import type { PrismaClient } from '../generated/prisma/client.js';

const maxAttempts = 8;
const leaseMs = 30_000;

interface ClaimedOutboxEvent {
  id: string;
  topic: string;
  aggregateId: string;
  payload: unknown;
  attempts: number;
  createdAt: Date;
}

export function startOutboxRelay(
  prisma: PrismaClient,
  publisher: EventPublisher,
  logger: Logger,
  intervalMs: number,
) {
  const metrics = createOutboxMetrics('payment-service');
  const run = async () => {
    const events = await prisma.$queryRaw<ClaimedOutboxEvent[]>`
      WITH candidates AS (
        SELECT "id"
        FROM "OutboxEvent"
        WHERE "attempts" < ${maxAttempts}
          AND "availableAt" <= NOW()
          AND "status" IN ('PENDING', 'PROCESSING')
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 25
      )
      UPDATE "OutboxEvent" AS event
      SET "status" = 'PROCESSING',
          "attempts" = event."attempts" + 1,
          "availableAt" = NOW() + (${leaseMs} * INTERVAL '1 millisecond')
      FROM candidates
      WHERE event."id" = candidates."id"
      RETURNING event."id", event."topic", event."aggregateId", event."payload",
                event."attempts", event."createdAt"
    `;
    for (const event of events) {
      metrics.age.record(Date.now() - event.createdAt.getTime(), { topic: event.topic });
      try {
        await publisher.publish(event.topic, event.aggregateId, event.payload as never);
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'PUBLISHED', publishedAt: new Date() },
        });
      } catch (error) {
        const exhausted = event.attempts >= maxAttempts;
        const retryDelayMs = Math.min(60_000, 1_000 * 2 ** (event.attempts - 1));
        logger.error(
          { error, outboxEventId: event.id, attempts: event.attempts, exhausted },
          'Outbox publication failed',
        );
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: exhausted ? 'FAILED' : 'PENDING',
            availableAt: new Date(Date.now() + retryDelayMs),
          },
        });
        if (exhausted) metrics.exhausted.add(1, { topic: event.topic });
      }
    }
  };
  const execute = () =>
    void run().catch((error: unknown) => logger.error({ error }, 'Outbox relay cycle failed'));
  const timer = setInterval(execute, intervalMs);
  timer.unref();
  execute();
  return () => clearInterval(timer);
}
