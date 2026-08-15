import { topics } from '@ecommerce/contracts';
import { createEvent } from '@ecommerce/messaging';
import { createCheckoutMetrics } from '@ecommerce/observability';
import { v7 as uuidv7 } from 'uuid';
import type { OrderRepository } from '../application/ports.js';
import { toCheckoutItems, type Order, type ShippingAddress } from '../domain/order.js';
import type { OrderStatus, PrismaClient } from '../generated/prisma/client.js';

const checkoutMetrics = createCheckoutMetrics();

export class PrismaOrderRepository implements OrderRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createCheckout(
    input: Parameters<OrderRepository['createCheckout']>[0],
  ): Promise<Order> {
    const existing = await this.prisma.order.findUnique({
      where: {
        userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey },
      },
      include: { items: true },
    });
    if (existing) return mapOrder(existing);
    const id = uuidv7();
    const displayId = `ORD-${id.replaceAll('-', '').slice(-10).toUpperCase()}`;
    return this.prisma.$transaction(async (transaction) => {
      const record = await transaction.order.create({
        data: {
          id,
          displayId,
          userId: input.userId,
          recipientEmail: input.recipientEmail,
          cartId: input.cart.id,
          cartVersion: input.cart.version,
          idempotencyKey: input.idempotencyKey,
          shippingAddress: JSON.parse(JSON.stringify(input.shippingAddress)) as object,
          items: { create: input.cart.items },
        },
        include: { items: true },
      });
      const event = createEvent({
        type: 'checkout.requested.v1',
        producer: 'order-service',
        aggregateId: id,
        correlationId: input.correlationId,
        data: { orderId: id, userId: input.userId },
      });
      await transaction.outboxEvent.create({
        data: {
          id: event.eventId,
          topic: topics.orders,
          eventType: event.eventType,
          aggregateId: id,
          payload: JSON.parse(JSON.stringify(event)) as object,
        },
      });
      return mapOrder(record);
    });
  }

  public async findById(orderId: string): Promise<Order | null> {
    const value = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    return value ? mapOrder(value) : null;
  }
  public async findOwned(orderId: string, userId: string): Promise<Order | null> {
    const value = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });
    return value ? mapOrder(value) : null;
  }
  public async listOwned(userId: string, cursor: string | undefined, limit: number) {
    const records = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { id: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = records.slice(0, limit);
    const next = records.length > limit ? page.at(-1)?.id : undefined;
    return { items: page.map(mapOrder), ...(next ? { nextCursor: next } : {}) };
  }

  public async applyReservation(
    orderId: string,
    reservationId: string,
    items: Parameters<OrderRepository['applyReservation']>[2],
  ): Promise<Order> {
    return this.prisma.$transaction(async (transaction) => {
      for (const item of items) {
        await transaction.orderItem.update({
          where: { orderId_productId: { orderId, productId: item.productId } },
          data: { name: item.name, unitPriceAmount: item.unitPriceAmount },
        });
      }
      const totalAmount = items.reduce(
        (sum, item) => sum + item.unitPriceAmount * item.quantity,
        0,
      );
      return mapOrder(
        await transaction.order.update({
          where: { id: orderId },
          data: { reservationId, totalAmount, status: 'INVENTORY_RESERVED' },
          include: { items: true },
        }),
      );
    });
  }
  public async attachPayment(orderId: string, paymentId: string): Promise<Order> {
    return mapOrder(
      await this.prisma.order.update({
        where: { id: orderId },
        data: { paymentId, status: 'AWAITING_PAYMENT' },
        include: { items: true },
      }),
    );
  }
  public async setStatus(orderId: string, status: Order['status']): Promise<Order> {
    return mapOrder(
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status },
        include: { items: true },
      }),
    );
  }
  public confirm(orderId: string, correlationId: string): Promise<Order> {
    return this.finish(orderId, 'CONFIRMED', undefined, correlationId);
  }
  public fail(
    orderId: string,
    reason: string,
    manualReview: boolean,
    correlationId: string,
  ): Promise<Order> {
    return this.finish(orderId, manualReview ? 'MANUAL_REVIEW' : 'FAILED', reason, correlationId);
  }

  private async finish(
    orderId: string,
    status: 'CONFIRMED' | 'FAILED' | 'MANUAL_REVIEW',
    reason: string | undefined,
    correlationId: string,
  ) {
    const order = await this.prisma.$transaction(async (transaction) => {
      const order = mapOrder(
        await transaction.order.update({
          where: { id: orderId },
          data: { status, ...(reason ? { failureReason: reason } : {}) },
          include: { items: true },
        }),
      );
      const eventType = status === 'CONFIRMED' ? 'order.confirmed.v1' : 'order.checkout_failed.v1';
      const event = createEvent({
        type: eventType,
        producer: 'order-service',
        aggregateId: orderId,
        correlationId,
        data: {
          orderId,
          displayId: order.displayId,
          userId: order.userId,
          recipientEmail: order.recipientEmail,
          items: toCheckoutItems(order),
          total: { amount: order.totalAmount, currency: 'BRL' as const },
          ...(reason ? { failureReason: reason } : {}),
        },
      });
      await transaction.outboxEvent.create({
        data: {
          id: event.eventId,
          topic: topics.orders,
          eventType,
          aggregateId: orderId,
          payload: JSON.parse(JSON.stringify(event)) as object,
        },
      });
      return order;
    });
    checkoutMetrics.completed.add(1, { status });
    checkoutMetrics.duration.record(Date.now() - order.createdAt.getTime(), { status });
    if (status === 'MANUAL_REVIEW') checkoutMetrics.manualReview.add(1);
    return order;
  }

  public async hasProcessed(eventId: string): Promise<boolean> {
    return Boolean(await this.prisma.inboxEvent.findUnique({ where: { eventId } }));
  }
  public async recordProcessed(eventId: string, eventType: string): Promise<void> {
    await this.prisma.inboxEvent.upsert({
      where: { eventId },
      update: {},
      create: { eventId, eventType },
    });
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

type OrderRecord = {
  id: string;
  displayId: string;
  userId: string;
  recipientEmail: string;
  status: OrderStatus;
  cartId: string;
  cartVersion: number;
  shippingAddress: unknown;
  reservationId: string | null;
  paymentId: string | null;
  totalAmount: number;
  currency: string;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    productId: string;
    quantity: number;
    name: string | null;
    unitPriceAmount: number | null;
  }>;
};

function mapOrder(value: OrderRecord): Order {
  return {
    id: value.id,
    displayId: value.displayId,
    userId: value.userId,
    recipientEmail: value.recipientEmail,
    status: value.status,
    cartId: value.cartId,
    cartVersion: value.cartVersion,
    shippingAddress: value.shippingAddress as ShippingAddress,
    ...(value.reservationId ? { reservationId: value.reservationId } : {}),
    ...(value.paymentId ? { paymentId: value.paymentId } : {}),
    totalAmount: value.totalAmount,
    currency: 'BRL',
    ...(value.failureReason ? { failureReason: value.failureReason } : {}),
    items: value.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      ...(item.name ? { name: item.name } : {}),
      ...(item.unitPriceAmount === null ? {} : { unitPriceAmount: item.unitPriceAmount }),
    })),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
