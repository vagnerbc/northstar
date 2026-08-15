import type { InventoryReservationResult, Order } from '../domain/order.js';

export interface CheckoutWorkflowInput {
  orderId: string;
  correlationId: string;
  paymentWindowMs: number;
  captureWindowMs: number;
}

export interface CheckoutActivities {
  loadOrder(orderId: string): Promise<Order>;
  reserveInventory(order: Order, correlationId: string): Promise<InventoryReservationResult>;
  applyReservation(orderId: string, reservation: InventoryReservationResult): Promise<Order>;
  createPayment(order: Order, correlationId: string): Promise<{ paymentId: string }>;
  markStatus(orderId: string, status: Order['status']): Promise<void>;
  capturePayment(orderId: string, paymentId: string, correlationId: string): Promise<void>;
  cancelPayment(orderId: string, paymentId: string, correlationId: string): Promise<void>;
  refundPayment(orderId: string, paymentId: string, correlationId: string): Promise<void>;
  commitInventory(orderId: string, correlationId: string): Promise<void>;
  releaseInventory(orderId: string, correlationId: string): Promise<void>;
  confirmOrder(orderId: string, correlationId: string): Promise<void>;
  failOrder(
    orderId: string,
    reason: string,
    manualReview: boolean,
    correlationId: string,
  ): Promise<void>;
}
