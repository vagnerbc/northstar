import { z } from 'zod';
import { eventEnvelopeSchema } from './event-envelope.js';

export const orderStatusSchema = z.enum([
  'CHECKOUT_REQUESTED',
  'INVENTORY_RESERVED',
  'AWAITING_PAYMENT',
  'PAYMENT_AUTHORIZED',
  'PAYMENT_CAPTURED',
  'CONFIRMED',
  'COMPENSATING',
  'FAILED',
  'MANUAL_REVIEW',
]);

export const moneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.literal('BRL'),
});

export const checkoutItemSchema = z.object({
  productId: z.uuid(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: moneySchema,
});

export const checkoutRequestedDataSchema = z.object({
  orderId: z.uuid(),
  userId: z.string().min(1),
});

export const paymentEventDataSchema = z.object({
  orderId: z.uuid(),
  paymentId: z.uuid(),
  providerPaymentId: z.string().min(1),
  amount: moneySchema,
  failureCode: z.string().optional(),
});

export const orderNotificationDataSchema = z.object({
  orderId: z.uuid(),
  displayId: z.string().min(1),
  userId: z.string().min(1),
  recipientEmail: z.email(),
  items: z.array(checkoutItemSchema),
  total: moneySchema,
  failureReason: z.string().optional(),
});

export const inventoryEventDataSchema = z.object({
  orderId: z.uuid(),
  reservationId: z.uuid(),
  items: z.array(z.object({ productId: z.uuid(), quantity: z.number().int().positive() })),
});

export const eventSchemas = {
  'checkout.requested.v1': eventEnvelopeSchema(checkoutRequestedDataSchema),
  'payment.authorized.v1': eventEnvelopeSchema(paymentEventDataSchema),
  'payment.captured.v1': eventEnvelopeSchema(paymentEventDataSchema),
  'payment.failed.v1': eventEnvelopeSchema(paymentEventDataSchema),
  'payment.refunded.v1': eventEnvelopeSchema(paymentEventDataSchema),
  'order.confirmed.v1': eventEnvelopeSchema(orderNotificationDataSchema),
  'order.checkout_failed.v1': eventEnvelopeSchema(orderNotificationDataSchema),
  'inventory.reserved.v1': eventEnvelopeSchema(inventoryEventDataSchema),
  'inventory.released.v1': eventEnvelopeSchema(inventoryEventDataSchema),
  'inventory.committed.v1': eventEnvelopeSchema(inventoryEventDataSchema),
} as const;

export type EventType = keyof typeof eventSchemas;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type CheckoutItem = z.infer<typeof checkoutItemSchema>;
export type Money = z.infer<typeof moneySchema>;

export const topics = {
  orders: 'order.events.v1',
  ordersDlq: 'order.events.v1.dlq',
  payments: 'payment.events.v1',
  paymentsDlq: 'payment.events.v1.dlq',
  inventory: 'catalog-inventory.events.v1',
  inventoryDlq: 'catalog-inventory.events.v1.dlq',
} as const;

export function parseEvent(type: EventType, input: unknown) {
  return eventSchemas[type].parse(input);
}
