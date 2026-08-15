import { createHmac } from 'node:crypto';
import { KafkaContainer } from '@testcontainers/kafka';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

export function createPostgresTestContainer(database: string) {
  return new PostgreSqlContainer('postgres:18.4-bookworm')
    .withDatabase(database)
    .withUsername('test')
    .withPassword('test');
}

export function createKafkaTestContainer() {
  return new KafkaContainer('confluentinc/cp-kafka:8.1.0');
}

export function createStripeSignature(
  payload: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1_000),
): string {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}
