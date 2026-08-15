import { AppError } from '@ecommerce/http';
import { v7 as uuidv7 } from 'uuid';
import type { Payment } from '../domain/payment.js';
import type { PaymentProvider, PaymentRepository } from './ports.js';

export class PaymentApplication {
  public constructor(
    private readonly repository: PaymentRepository,
    private readonly provider: PaymentProvider,
  ) {}

  public async create(input: {
    orderId: string;
    userId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<Payment> {
    const existing = await this.repository.findByOrderId(input.orderId);
    if (existing) return existing;
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new AppError(
        'Payment amount must be a positive integer.',
        400,
        'INVALID_PAYMENT_AMOUNT',
      );
    }
    const provided = await this.provider.create(input);
    return this.repository.create({
      id: uuidv7(),
      orderId: input.orderId,
      userId: input.userId,
      provider: this.provider.name,
      providerPaymentId: provided.providerPaymentId,
      clientSecret: provided.clientSecret,
      amount: input.amount,
      currency: 'BRL',
      status: provided.state,
    });
  }

  public async session(paymentId: string, userId: string) {
    const payment = await this.requirePayment(paymentId);
    if (payment.userId !== userId)
      throw new AppError('Payment was not found.', 404, 'PAYMENT_NOT_FOUND');
    if (!payment.clientSecret)
      throw new AppError('Payment session is unavailable.', 409, 'PAYMENT_SESSION_UNAVAILABLE');
    return {
      paymentId: payment.id,
      provider: payment.provider,
      clientSecret: payment.clientSecret,
      status: payment.status,
    };
  }

  public async capture(paymentId: string, idempotencyKey: string, correlationId: string) {
    const payment = await this.requirePayment(paymentId);
    if (payment.status === 'CAPTURED') return payment;
    if (payment.status !== 'AUTHORIZED')
      throw new AppError('Payment is not authorized.', 409, 'PAYMENT_NOT_AUTHORIZED');
    const result = await this.provider.capture(payment.providerPaymentId, idempotencyKey);
    if (this.provider.name === 'fake' && result.state === 'CAPTURED') {
      const updated = await this.repository.updateStatus(payment.id, 'CAPTURED');
      await this.repository.emitState(updated, 'payment.captured.v1', correlationId);
      return updated;
    }
    return payment;
  }

  public async cancel(paymentId: string, idempotencyKey: string) {
    const payment = await this.requirePayment(paymentId);
    if (payment.status === 'CANCELED') return payment;
    await this.provider.cancel(payment.providerPaymentId, idempotencyKey);
    return this.repository.updateStatus(payment.id, 'CANCELED');
  }

  public async refund(paymentId: string, idempotencyKey: string) {
    const payment = await this.requirePayment(paymentId);
    if (payment.status === 'REFUNDED') return payment;
    if (payment.status !== 'CAPTURED')
      throw new AppError('Only captured payments can be refunded.', 409, 'PAYMENT_NOT_CAPTURED');
    try {
      await this.provider.refund(payment.providerPaymentId, idempotencyKey);
      return await this.repository.updateStatus(payment.id, 'REFUNDED');
    } catch (error) {
      await this.repository.updateStatus(payment.id, 'REFUND_FAILED');
      throw error;
    }
  }

  public async webhook(payload: Buffer, signature: string, correlationId: string) {
    const event = this.provider.parseWebhook(payload, signature);
    return this.repository.applyWebhook(event, correlationId);
  }

  public async fakeAuthorize(paymentId: string, correlationId: string) {
    if (this.provider.name !== 'fake')
      throw new AppError('Route is unavailable.', 404, 'NOT_FOUND');
    const payment = await this.requirePayment(paymentId);
    const updated = await this.repository.updateStatus(payment.id, 'AUTHORIZED');
    await this.repository.emitState(updated, 'payment.authorized.v1', correlationId);
    return updated;
  }

  private async requirePayment(paymentId: string) {
    const payment = await this.repository.findById(paymentId);
    if (!payment) throw new AppError('Payment was not found.', 404, 'PAYMENT_NOT_FOUND');
    return payment;
  }
}
