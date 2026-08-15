import { describe, expect, it } from 'vitest';
import { createEvent, InMemoryEventBus } from './index.js';

describe('in-memory event bus', () => {
  it('retains a versioned event envelope', async () => {
    const bus = new InMemoryEventBus();
    const aggregateId = crypto.randomUUID();
    const event = createEvent({
      type: 'checkout.requested.v1',
      producer: 'order-service',
      aggregateId,
      correlationId: crypto.randomUUID(),
      data: { orderId: aggregateId, userId: 'buyer' },
    });
    await bus.publish('order.events.v1', aggregateId, event);
    expect(bus.published).toEqual([{ topic: 'order.events.v1', key: aggregateId, event }]);
    expect(event).toMatchObject({
      eventVersion: 1,
      aggregateId,
    });
    expect(typeof event.correlationId).toBe('string');
  });

  it('includes optional causation and W3C trace context only when supplied', () => {
    const aggregateId = crypto.randomUUID();
    const event = createEvent({
      type: 'checkout.requested.v1',
      producer: 'order-service',
      aggregateId,
      correlationId: crypto.randomUUID(),
      causationId: crypto.randomUUID(),
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      data: { orderId: aggregateId, userId: 'buyer' },
    });

    expect(event.causationId).toBeDefined();
    expect(event.traceparent).toMatch(/^00-/);
  });
});
