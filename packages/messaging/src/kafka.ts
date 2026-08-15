import { KafkaJS } from '@confluentinc/kafka-javascript';
import type { EventEnvelope } from '@ecommerce/contracts';
import { context, metrics, propagation, SpanStatusCode, trace } from '@opentelemetry/api';
import { generateAuthToken } from 'aws-msk-iam-sasl-signer-js';
import type { EventPublisher, KafkaEventBusOptions, MessageContext } from './contracts.js';

const tracer = trace.getTracer('@ecommerce/messaging');
const meter = metrics.getMeter('@ecommerce/messaging');
const handlerDuration = meter.createHistogram('messaging.consumer.duration', { unit: 'ms' });
const handlerFailures = meter.createCounter('messaging.consumer.failures');
const deadLetters = meter.createCounter('messaging.consumer.dlq');

export class KafkaEventBus implements EventPublisher {
  private readonly kafka: KafkaJS.Kafka;
  private readonly maxHandlerAttempts: number;
  private readonly retryDelayMs: number;
  private producer: KafkaJS.Producer | undefined;

  public constructor(options: KafkaEventBusOptions) {
    this.maxHandlerAttempts = options.maxHandlerAttempts ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 100;
    const awsIam = process.env.KAFKA_AUTH_MODE === 'aws-iam';
    this.kafka = new KafkaJS.Kafka({
      kafkaJS: {
        clientId: options.clientId,
        brokers: options.brokers,
        ...(awsIam
          ? {
              ssl: true,
              sasl: {
                mechanism: 'oauthbearer' as const,
                // MSK validates this short-lived SigV4 token against the ECS task role.
                oauthBearerProvider: async () => ({
                  value: (
                    await generateAuthToken({ region: process.env.AWS_REGION ?? 'us-east-1' })
                  ).token,
                  principal: 'aws',
                  lifetime: Date.now() + 14 * 60 * 1_000,
                }),
              },
            }
          : {
              ...(options.ssl === undefined ? {} : { ssl: options.ssl }),
              ...(options.sasl ? { sasl: options.sasl } : {}),
            }),
        logLevel: KafkaJS.logLevel.WARN,
      },
    });
  }

  public async connect(): Promise<void> {
    const producer = this.kafka.producer();
    await producer.connect();
    this.producer = producer;
  }

  public async publish(topic: string, key: string, event: EventEnvelope<unknown>): Promise<void> {
    if (!this.producer) throw new Error('Kafka producer is not connected.');
    await tracer.startActiveSpan(`kafka publish ${topic}`, async (span) => {
      try {
        span.setAttributes({
          'messaging.system': 'kafka',
          'messaging.destination.name': topic,
          'messaging.operation.name': 'publish',
          'messaging.message.id': event.eventId,
          'ecommerce.correlation_id': event.correlationId,
        });
        await this.producer!.send({
          topic,
          messages: [{ key, value: JSON.stringify(event) }],
        });
      } catch (error) {
        span.recordException(asError(error));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  public async subscribe(
    groupId: string,
    topics: string[],
    handler: (event: unknown, messageContext: MessageContext) => Promise<void>,
  ): Promise<KafkaJS.Consumer> {
    const consumer = this.kafka.consumer({ kafkaJS: { groupId } });
    await consumer.connect();
    for (const topic of topics) await consumer.subscribe({ topic });
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const rawValue = message.value.toString();
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawValue) as unknown;
        } catch (error) {
          await this.sendToDeadLetter(
            topic,
            message.key?.toString() ?? 'malformed',
            rawValue,
            error,
          );
          return;
        }

        const envelope = parsed as Partial<EventEnvelope<unknown>>;
        const extractedContext = envelope.traceparent
          ? propagation.extract(context.active(), { traceparent: envelope.traceparent })
          : context.active();
        await context.with(extractedContext, () =>
          tracer.startActiveSpan(`kafka process ${topic}`, async (span) => {
            const startedAt = performance.now();
            span.setAttributes({
              'messaging.system': 'kafka',
              'messaging.destination.name': topic,
              'messaging.operation.name': 'process',
              'messaging.kafka.message.offset': message.offset,
              'messaging.kafka.destination.partition': partition,
              ...(envelope.eventId ? { 'messaging.message.id': envelope.eventId } : {}),
              ...(envelope.correlationId
                ? { 'ecommerce.correlation_id': envelope.correlationId }
                : {}),
            });
            try {
              await this.handleWithRetries(handler, parsed, {
                topic,
                partition,
                offset: message.offset,
              });
            } catch (error) {
              span.recordException(asError(error));
              span.setStatus({ code: SpanStatusCode.ERROR });
              handlerFailures.add(1, { topic, groupId });
              await this.sendToDeadLetter(
                topic,
                message.key?.toString() ?? envelope.aggregateId ?? 'unknown',
                rawValue,
                error,
              );
            } finally {
              handlerDuration.record(performance.now() - startedAt, { topic, groupId });
              span.end();
            }
          }),
        );
      },
    });
    return consumer;
  }

  public async disconnect(): Promise<void> {
    await this.producer?.disconnect();
    this.producer = undefined;
  }

  private async handleWithRetries(
    handler: (event: unknown, messageContext: MessageContext) => Promise<void>,
    event: unknown,
    messageContext: MessageContext,
  ): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxHandlerAttempts; attempt += 1) {
      try {
        await handler(event, messageContext);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxHandlerAttempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelayMs * 2 ** (attempt - 1)),
          );
        }
      }
    }
    throw lastError;
  }

  private async sendToDeadLetter(
    sourceTopic: string,
    key: string,
    rawValue: string,
    error: unknown,
  ): Promise<void> {
    if (!this.producer) throw new Error('Kafka producer is not connected.');
    const topic = `${sourceTopic}.dlq`;
    await this.producer.send({
      topic,
      messages: [
        {
          key,
          value: rawValue,
          headers: {
            'x-source-topic': sourceTopic,
            'x-error-message': asError(error).message.slice(0, 1_000),
          },
        },
      ],
    });
    deadLetters.add(1, { sourceTopic, topic });
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
