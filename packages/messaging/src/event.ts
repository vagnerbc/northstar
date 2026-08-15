import type { EventEnvelope, EventType } from '@ecommerce/contracts';
import { v7 as uuidv7 } from 'uuid';

export function createEvent<TData>(input: {
  type: EventType;
  producer: string;
  aggregateId: string;
  correlationId: string;
  causationId?: string;
  traceparent?: string;
  data: TData;
}): EventEnvelope<TData> {
  return {
    eventId: uuidv7(),
    eventType: input.type,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    producer: input.producer,
    aggregateId: input.aggregateId,
    correlationId: input.correlationId,
    ...(input.causationId ? { causationId: input.causationId } : {}),
    ...(input.traceparent ? { traceparent: input.traceparent } : {}),
    data: input.data,
  };
}
