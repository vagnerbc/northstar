import { topics, type EventEnvelope } from '@ecommerce/contracts';
import { AppError } from '@ecommerce/http';
import { createEvent } from '@ecommerce/messaging';
import { createInventoryMetrics } from '@ecommerce/observability';
import { v7 as uuidv7 } from 'uuid';
import type { InventoryReservation, Product, ReservedItem } from '../domain/product.js';
import type { CatalogRepository, ProductPage } from '../application/ports.js';
import type { PrismaClient } from '../generated/prisma/client.js';

type Client = PrismaClient;
const inventoryMetrics = createInventoryMetrics();

export class PrismaCatalogRepository implements CatalogRepository {
  public constructor(private readonly prisma: Client) {}

  public async list(cursor: string | undefined, limit: number): Promise<ProductPage> {
    const records = await this.prisma.product.findMany({
      where: { active: true },
      include: { inventory: true },
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = records.length > limit;
    const page = records.slice(0, limit);
    const items = page.map(mapProduct);
    const next = hasMore ? page.at(-1)?.id : undefined;
    return { items, ...(next ? { nextCursor: next } : {}) };
  }

  public async findById(productId: string): Promise<Product | null> {
    const record = await this.prisma.product.findFirst({
      where: { id: productId, active: true },
      include: { inventory: true },
    });
    return record ? mapProduct(record) : null;
  }

  public async reserve(
    input: Parameters<CatalogRepository['reserve']>[0],
  ): Promise<InventoryReservation> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.inventoryReservation.findUnique({
        where: { orderId: input.orderId },
        include: { items: { include: { product: true } } },
      });
      if (existing) return mapReservation(existing);

      const reservationId = uuidv7();
      const reservedItems: ReservedItem[] = [];
      for (const item of input.items) {
        const rows = await transaction.$queryRaw<
          Array<{ id: string; name: string; priceAmount: number; currency: string }>
        >`
          UPDATE "InventoryItem" AS inventory
          SET "reserved" = inventory."reserved" + ${item.quantity}, "updatedAt" = NOW()
          FROM "Product" AS product
          WHERE inventory."productId" = ${item.productId}::uuid
            AND product."id" = inventory."productId"
            AND product."active" = true
            AND inventory."onHand" - inventory."reserved" >= ${item.quantity}
          RETURNING product."id", product."name", product."priceAmount", product."currency"
        `;
        const row = rows[0];
        if (!row)
          throw new AppError(
            'One or more products have insufficient stock.',
            409,
            'INSUFFICIENT_STOCK',
          );
        reservedItems.push({
          productId: row.id,
          name: row.name,
          quantity: item.quantity,
          unitPriceAmount: row.priceAmount,
          currency: 'BRL',
        });
      }

      await transaction.inventoryReservation.create({
        data: {
          id: reservationId,
          orderId: input.orderId,
          expiresAt: input.expiresAt,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
      });
      const event = createEvent({
        type: 'inventory.reserved.v1',
        producer: 'catalog-inventory-service',
        aggregateId: input.orderId,
        correlationId: input.correlationId,
        data: { orderId: input.orderId, reservationId, items: input.items },
      });
      await createOutbox(transaction, topics.inventory, event);
      return {
        id: reservationId,
        orderId: input.orderId,
        status: 'ACTIVE',
        expiresAt: input.expiresAt,
        items: reservedItems,
      };
    });
  }

  public async commit(orderId: string, correlationId: string): Promise<InventoryReservation> {
    return this.transition(orderId, 'COMMITTED', correlationId);
  }

  public async release(orderId: string, correlationId: string): Promise<InventoryReservation> {
    return this.transition(orderId, 'RELEASED', correlationId);
  }

  private async transition(
    orderId: string,
    target: 'COMMITTED' | 'RELEASED',
    correlationId: string,
  ): Promise<InventoryReservation> {
    return this.prisma.$transaction(async (transaction) => {
      const reservation = await transaction.inventoryReservation.findUnique({
        where: { orderId },
        include: { items: { include: { product: true } } },
      });
      if (!reservation)
        throw new AppError('Inventory reservation was not found.', 404, 'RESERVATION_NOT_FOUND');
      if (reservation.status === target) return mapReservation(reservation);
      if (reservation.status !== 'ACTIVE') {
        throw new AppError(
          `Reservation cannot transition from ${reservation.status}.`,
          409,
          'INVALID_RESERVATION_STATE',
        );
      }

      for (const item of reservation.items) {
        await transaction.inventoryItem.update({
          where: { productId: item.productId },
          data:
            target === 'COMMITTED'
              ? { reserved: { decrement: item.quantity }, onHand: { decrement: item.quantity } }
              : { reserved: { decrement: item.quantity } },
        });
      }
      const updated = await transaction.inventoryReservation.update({
        where: { orderId },
        data: { status: target },
        include: { items: { include: { product: true } } },
      });
      const eventType = target === 'COMMITTED' ? 'inventory.committed.v1' : 'inventory.released.v1';
      const event = createEvent({
        type: eventType,
        producer: 'catalog-inventory-service',
        aggregateId: orderId,
        correlationId,
        data: {
          orderId,
          reservationId: reservation.id,
          items: reservation.items.map(({ productId, quantity }) => ({ productId, quantity })),
        },
      });
      await createOutbox(transaction, topics.inventory, event);
      if (target === 'RELEASED') inventoryMetrics.released.add(1);
      return mapReservation(updated);
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

function mapProduct(record: {
  id: string;
  sku: string;
  name: string;
  description: string;
  imageUrl: string;
  priceAmount: number;
  currency: string;
  inventory: { onHand: number; reserved: number } | null;
}): Product {
  return {
    id: record.id,
    sku: record.sku,
    name: record.name,
    description: record.description,
    imageUrl: record.imageUrl,
    priceAmount: record.priceAmount,
    currency: 'BRL',
    availableQuantity: Math.max(
      0,
      (record.inventory?.onHand ?? 0) - (record.inventory?.reserved ?? 0),
    ),
  };
}

function mapReservation(record: {
  id: string;
  orderId: string;
  status: 'ACTIVE' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  expiresAt: Date;
  items: Array<{
    quantity: number;
    productId: string;
    product: { name: string; priceAmount: number };
  }>;
}): InventoryReservation {
  return {
    id: record.id,
    orderId: record.orderId,
    status: record.status,
    expiresAt: record.expiresAt,
    items: record.items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      quantity: item.quantity,
      unitPriceAmount: item.product.priceAmount,
      currency: 'BRL',
    })),
  };
}

async function createOutbox(
  transaction: Pick<PrismaClient, 'outboxEvent'>,
  topic: string,
  event: EventEnvelope<unknown>,
) {
  await transaction.outboxEvent.create({
    data: {
      id: event.eventId,
      topic,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      payload: JSON.parse(JSON.stringify(event)) as object,
    },
  });
}
