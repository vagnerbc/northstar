import { mkdir, writeFile } from 'node:fs/promises';
import { eventSchemas, topics, type EventType } from '../src/index.js';

const topicByType: Record<EventType, string> = {
  'checkout.requested.v1': topics.orders,
  'payment.authorized.v1': topics.payments,
  'payment.captured.v1': topics.payments,
  'payment.failed.v1': topics.payments,
  'payment.refunded.v1': topics.payments,
  'order.confirmed.v1': topics.orders,
  'order.checkout_failed.v1': topics.orders,
  'inventory.reserved.v1': topics.inventory,
  'inventory.released.v1': topics.inventory,
  'inventory.committed.v1': topics.inventory,
};

const channels = Object.fromEntries(
  Object.entries(eventSchemas).map(([eventType, schema]) => [
    eventType,
    {
      address: topicByType[eventType as EventType],
      messages: {
        [eventType]: {
          name: eventType,
          contentType: 'application/json',
          payload: schema.toJSONSchema(),
        },
      },
    },
  ]),
);

const document = {
  asyncapi: '3.0.0',
  info: {
    title: 'E-commerce integration events',
    version: '1.0.0',
    description: 'Generated from the runtime Zod event registry. Do not edit by hand.',
  },
  defaultContentType: 'application/json',
  channels,
};

const serialized = `${JSON.stringify(document, null, 2)}\n`;
const docsDirectory = new URL('../../../docs/api/', import.meta.url);
await mkdir(docsDirectory, { recursive: true });
await Promise.all([
  writeFile(new URL('../asyncapi.json', import.meta.url), serialized),
  writeFile(new URL('asyncapi.json', docsDirectory), serialized),
]);
