import type { Payment, ProviderPayment, ProviderWebhookEvent } from '../domain/payment.js';

export interface PaymentProvider {
  readonly name: 'stripe' | 'fake';
  create(input: {
    orderId: string;
    userId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<ProviderPayment>;
  capture(providerPaymentId: string, idempotencyKey: string): Promise<ProviderPayment>;
  cancel(providerPaymentId: string, idempotencyKey: string): Promise<ProviderPayment>;
  refund(providerPaymentId: string, idempotencyKey: string): Promise<ProviderPayment>;
  parseWebhook(payload: Buffer, signature: string): ProviderWebhookEvent;
}

export interface PaymentRepository {
  findByOrderId(orderId: string): Promise<Payment | null>;
  findById(paymentId: string): Promise<Payment | null>;
  create(input: Omit<Payment, 'status'> & { status: Payment['status'] }): Promise<Payment>;
  updateStatus(
    paymentId: string,
    status: Payment['status'],
    failureCode?: string,
  ): Promise<Payment>;
  applyWebhook(event: ProviderWebhookEvent, correlationId: string): Promise<Payment | null>;
  emitState(
    payment: Payment,
    eventType: 'payment.authorized.v1' | 'payment.captured.v1' | 'payment.failed.v1',
    correlationId: string,
  ): Promise<void>;
  isReady(): Promise<boolean>;
}
