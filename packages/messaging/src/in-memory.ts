import type { EventEnvelope } from '@ecommerce/contracts';
import type { EventPublisher } from './contracts.js';

export class InMemoryEventBus implements EventPublisher {
  public readonly published: Array<{ topic: string; key: string; event: EventEnvelope<unknown> }> =
    [];

  public async publish(topic: string, key: string, event: EventEnvelope<unknown>): Promise<void> {
    this.published.push({ topic, key, event });
  }
}
