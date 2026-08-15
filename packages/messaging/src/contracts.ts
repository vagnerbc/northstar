import type { EventEnvelope } from '@ecommerce/contracts';

export interface EventPublisher {
  publish(topic: string, key: string, event: EventEnvelope<unknown>): Promise<void>;
}

export interface MessageContext {
  topic: string;
  partition: number;
  offset: string;
}

export interface KafkaEventBusOptions {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: { mechanism: 'plain'; username: string; password: string };
  maxHandlerAttempts?: number;
  retryDelayMs?: number;
}
