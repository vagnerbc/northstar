import { z } from 'zod';
import { orderStatusSchema } from './events.js';

export const uuidSchema = z.uuid();
export const cursorQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const productSchema = z.object({
  id: uuidSchema,
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string(),
  priceAmount: z.number().int().nonnegative(),
  currency: z.literal('BRL'),
  availableQuantity: z.number().int().nonnegative(),
});
export const cartItemSchema = z.object({
  productId: uuidSchema,
  quantity: z.number().int().min(1).max(99),
});
export const cartSchema = z.object({
  id: uuidSchema,
  userId: z.string(),
  version: z.number().int(),
  items: z.array(cartItemSchema),
  updatedAt: z.iso.datetime(),
});
export const shippingAddressSchema = z.object({
  recipientName: z.string().min(2).max(120),
  line1: z.string().min(3).max(160),
  line2: z.string().max(160).optional(),
  city: z.string().min(2).max(100),
  state: z.string().length(2),
  postalCode: z.string().regex(/^\d{5}-?\d{3}$/),
  country: z.literal('BR'),
});
export const orderSchema = z.object({
  id: uuidSchema,
  displayId: z.string(),
  status: orderStatusSchema,
  paymentId: uuidSchema.optional(),
  totalAmount: z.number().int(),
  currency: z.literal('BRL'),
  failureReason: z.string().optional(),
  shippingAddress: shippingAddressSchema,
  items: z.array(
    z.object({
      productId: uuidSchema,
      quantity: z.number().int(),
      name: z.string().optional(),
      unitPriceAmount: z.number().int().optional(),
    }),
  ),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const checkoutBodySchema = z.object({ shippingAddress: shippingAddressSchema });
export const checkoutAcceptedSchema = z.object({
  orderId: uuidSchema,
  status: orderStatusSchema,
  statusUrl: z.string(),
});
export const paymentSessionSchema = z.object({
  paymentId: uuidSchema,
  provider: z.enum(['stripe', 'fake']),
  clientSecret: z.string(),
  status: z.string(),
});
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string().optional(),
  correlationId: z.string().optional(),
});

export const httpSchemas = {
  Product: productSchema,
  ProductPage: z.object({ items: z.array(productSchema), nextCursor: z.string().optional() }),
  CartItem: cartItemSchema,
  Cart: cartSchema,
  ShippingAddress: shippingAddressSchema,
  Order: orderSchema,
  OrderPage: z.object({ items: z.array(orderSchema), nextCursor: z.string().optional() }),
  CheckoutBody: checkoutBodySchema,
  CheckoutAccepted: checkoutAcceptedSchema,
  PaymentSession: paymentSessionSchema,
  Problem: problemSchema,
} as const;
