import { createHmac } from 'node:crypto';
import { KafkaContainer } from '@testcontainers/kafka';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StartedKafkaContainer } from '@testcontainers/kafka';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const describeWithDocker = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeWithDocker('disposable infrastructure', () => {
  let postgres: StartedPostgreSqlContainer;
  let kafka: StartedKafkaContainer;
  beforeAll(async () => {
    [postgres, kafka] = await Promise.all([
      new PostgreSqlContainer('postgres:18.4-bookworm').withDatabase('integration').start(),
      new KafkaContainer('confluentinc/cp-kafka:8.1.0').start(),
    ]);
  });
  afterAll(async () => Promise.all([postgres.stop(), kafka.stop()]));

  it('starts physically separate PostgreSQL and Kafka endpoints', () => {
    // Both PostgreSQL URI schemes are accepted by libpq-compatible clients.
    expect(postgres.getConnectionUri()).toMatch(/^postgres(?:ql)?:\/\//);
    expect(kafka.getHost()).toBeTruthy();
    expect(kafka.getMappedPort(9093)).toBeGreaterThan(0);
  });
});

describe('Stripe fixture signing', () => {
  it('produces the documented timestamped HMAC structure', () => {
    const digest = createHmac('sha256', 'whsec_test').update('100.{"id":"evt_1"}').digest('hex');
    expect(`t=100,v1=${digest}`).toMatch(/^t=100,v1=[a-f0-9]{64}$/);
  });
});
