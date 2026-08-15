import { describe, expect, it } from 'vitest';
import { checkoutBodySchema, cursorQuerySchema, httpSchemas } from './http-contracts.js';
import { eventSchemas, parseEvent } from './events.js';

describe('event contracts', () => {
  it('rejects an event without correlation metadata', () => {
    const result = eventSchemas['checkout.requested.v1'].safeParse({
      eventId: crypto.randomUUID(),
      eventType: 'checkout.requested.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producer: 'order-service',
      aggregateId: crypto.randomUUID(),
      data: { orderId: crypto.randomUUID(), userId: 'buyer' },
    });

    expect(result.success).toBe(false);
  });

  it('parses a valid event through the versioned registry', () => {
    const orderId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    const input = {
      eventId: crypto.randomUUID(),
      eventType: 'checkout.requested.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producer: 'order-service',
      aggregateId: orderId,
      correlationId,
      data: { orderId, userId: 'buyer' },
    };

    expect(parseEvent('checkout.requested.v1', input)).toEqual(input);
  });

  it('applies HTTP contract defaults and business validation', () => {
    expect(cursorQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(cursorQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(
      checkoutBodySchema.safeParse({
        shippingAddress: {
          recipientName: 'Demo Buyer',
          line1: '123 Example Street',
          city: 'Sao Paulo',
          state: 'SP',
          postalCode: '01000-000',
          country: 'BR',
        },
      }).success,
    ).toBe(true);
    expect(
      httpSchemas.CartItem.safeParse({ productId: crypto.randomUUID(), quantity: 100 }).success,
    ).toBe(false);
  });
});
