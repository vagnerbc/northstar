import type { Order, OrderItemDraft, ShippingAddress } from '../domain/order.js';

export interface CartSnapshot {
  id: string;
  userId: string;
  version: number;
  items: Array<{ productId: string; quantity: number }>;
}

export interface OrderPage {
  items: Order[];
  nextCursor?: string;
}

export interface OrderRepository {
  createCheckout(input: {
    userId: string;
    recipientEmail: string;
    idempotencyKey: string;
    shippingAddress: ShippingAddress;
    cart: CartSnapshot;
    correlationId: string;
  }): Promise<Order>;
  findById(orderId: string): Promise<Order | null>;
  findOwned(orderId: string, userId: string): Promise<Order | null>;
  listOwned(userId: string, cursor: string | undefined, limit: number): Promise<OrderPage>;
  applyReservation(
    orderId: string,
    reservationId: string,
    items: Required<OrderItemDraft>[],
  ): Promise<Order>;
  attachPayment(orderId: string, paymentId: string): Promise<Order>;
  setStatus(orderId: string, status: Order['status']): Promise<Order>;
  confirm(orderId: string, correlationId: string): Promise<Order>;
  fail(
    orderId: string,
    reason: string,
    manualReview: boolean,
    correlationId: string,
  ): Promise<Order>;
  hasProcessed(eventId: string): Promise<boolean>;
  recordProcessed(eventId: string, eventType: string): Promise<void>;
  isReady(): Promise<boolean>;
}

export interface CartClient {
  getSnapshot(userId: string, correlationId: string): Promise<CartSnapshot>;
}
