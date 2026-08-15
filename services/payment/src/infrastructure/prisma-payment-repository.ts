import { topics } from '@ecommerce/contracts';
import { createEvent } from '@ecommerce/messaging';
import type { PaymentRepository } from '../application/ports.js';
import type { Payment, PaymentStatus, ProviderWebhookEvent } from '../domain/payment.js';
import type { PrismaClient } from '../generated/prisma/client.js';

export class PrismaPaymentRepository implements PaymentRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findByOrderId(orderId: string): Promise<Payment | null> {
    const value = await this.prisma.payment.findUnique({ where: { orderId } });
    return value ? mapPayment(value) : null;
  }
  public async findById(paymentId: string): Promise<Payment | null> {
    const value = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    return value ? mapPayment(value) : null;
  }
  public async create(input: Parameters<PaymentRepository['create']>[0]): Promise<Payment> {
    return mapPayment(await this.prisma.payment.create({ data: input }));
  }
  public async updateStatus(
    paymentId: string,
    status: PaymentStatus,
    failureCode?: string,
  ): Promise<Payment> {
    return mapPayment(
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status, ...(failureCode ? { failureCode } : {}) },
      }),
    );
  }

  public async applyWebhook(
    event: ProviderWebhookEvent,
    correlationId: string,
  ): Promise<Payment | null> {
    return this.prisma.$transaction(async (transaction) => {
      if (await transaction.webhookReceipt.findUnique({ where: { providerEventId: event.id } }))
        return null;
      const record = await transaction.payment.findUnique({
        where: { providerPaymentId: event.providerPaymentId },
      });
      if (!record) return null;
      const status: PaymentStatus =
        event.type === 'AUTHORIZED'
          ? 'AUTHORIZED'
          : event.type === 'CAPTURED'
            ? 'CAPTURED'
            : 'FAILED';
      const payment = mapPayment(
        await transaction.payment.update({
          where: { id: record.id },
          data: { status, ...(event.failureCode ? { failureCode: event.failureCode } : {}) },
        }),
      );
      await transaction.webhookReceipt.create({
        data: { providerEventId: event.id, eventType: event.type },
      });
      const eventType =
        event.type === 'AUTHORIZED'
          ? 'payment.authorized.v1'
          : event.type === 'CAPTURED'
            ? 'payment.captured.v1'
            : 'payment.failed.v1';
      await writePaymentEvent(transaction, payment, eventType, correlationId);
      return payment;
    });
  }

  public async emitState(
    payment: Payment,
    eventType: Parameters<PaymentRepository['emitState']>[1],
    correlationId: string,
  ): Promise<void> {
    await this.prisma.$transaction((transaction) =>
      writePaymentEvent(transaction, payment, eventType, correlationId),
    );
  }

  public async isReady(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

async function writePaymentEvent(
  transaction: Pick<PrismaClient, 'outboxEvent'>,
  payment: Payment,
  eventType: 'payment.authorized.v1' | 'payment.captured.v1' | 'payment.failed.v1',
  correlationId: string,
) {
  const event = createEvent({
    type: eventType,
    producer: 'payment-service',
    aggregateId: payment.orderId,
    correlationId,
    data: {
      orderId: payment.orderId,
      paymentId: payment.id,
      providerPaymentId: payment.providerPaymentId,
      amount: { amount: payment.amount, currency: 'BRL' as const },
      ...(payment.failureCode ? { failureCode: payment.failureCode } : {}),
    },
  });
  await transaction.outboxEvent.create({
    data: {
      id: event.eventId,
      topic: topics.payments,
      eventType,
      aggregateId: payment.orderId,
      payload: JSON.parse(JSON.stringify(event)) as object,
    },
  });
}

function mapPayment(value: {
  id: string;
  orderId: string;
  userId: string;
  provider: string;
  providerPaymentId: string;
  clientSecret: string | null;
  amount: number;
  status: PaymentStatus;
  failureCode: string | null;
}): Payment {
  return {
    id: value.id,
    orderId: value.orderId,
    userId: value.userId,
    provider: value.provider === 'fake' ? 'fake' : 'stripe',
    providerPaymentId: value.providerPaymentId,
    ...(value.clientSecret ? { clientSecret: value.clientSecret } : {}),
    amount: value.amount,
    currency: 'BRL',
    status: value.status,
    ...(value.failureCode ? { failureCode: value.failureCode } : {}),
  };
}
