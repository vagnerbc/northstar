import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

export function createOutboxMetrics(serviceName: string) {
  const meter = metrics.getMeter(`${serviceName}/outbox`);
  return {
    age: meter.createHistogram('outbox.event.age', {
      description: 'Age of an outbox event when a relay claims it',
      unit: 'ms',
    }),
    exhausted: meter.createCounter('outbox.event.exhausted', {
      description: 'Outbox events that exhausted their publication attempts',
    }),
  };
}

export function createCheckoutMetrics() {
  const meter = metrics.getMeter('order-service/checkout');
  return {
    completed: meter.createCounter('checkout.workflow.completed'),
    duration: meter.createHistogram('checkout.workflow.duration', { unit: 'ms' }),
    manualReview: meter.createCounter('checkout.manual_review'),
  };
}

export function createPaymentMetrics() {
  const meter = metrics.getMeter('payment-service/provider');
  return {
    webhookReceived: meter.createCounter('stripe.webhook.received'),
    webhookFailures: meter.createCounter('stripe.webhook.failures'),
  };
}

export function createInventoryMetrics() {
  const meter = metrics.getMeter('catalog-inventory-service/reservations');
  return { released: meter.createCounter('inventory.reservation.released') };
}

export async function startObservability(options: {
  serviceName: string;
  serviceVersion: string;
  endpoint?: string;
}): Promise<void> {
  if (!options.endpoint || sdk) return;
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion,
    }),
    traceExporter: new OTLPTraceExporter({ url: `${options.endpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${options.endpoint}/v1/metrics` }),
      exportIntervalMillis: 10_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  sdk.start();
}

export async function stopObservability(): Promise<void> {
  await sdk?.shutdown();
  sdk = undefined;
}
