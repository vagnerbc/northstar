import { eventSchemas } from '@ecommerce/contracts';
import type { CartRepository } from '../../application/ports.js';

export function createOrderEventHandler(repository: CartRepository) {
  return async (input: unknown): Promise<void> => {
    const metadata = input as { eventType?: string };
    if (metadata.eventType !== 'order.confirmed.v1') return;
    const event = eventSchemas['order.confirmed.v1'].parse(input);
    await repository.removePurchased({
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.data.userId,
      items: event.data.items.map(({ productId, quantity }) => ({ productId, quantity })),
    });
  };
}
