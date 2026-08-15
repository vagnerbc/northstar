import { v7 as uuidv7 } from 'uuid';
import type { CartRepository } from '../application/ports.js';
import type { Cart } from '../domain/cart.js';
import type { PrismaClient } from '../generated/prisma/client.js';

export class PrismaCartRepository implements CartRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getOrCreate(userId: string): Promise<Cart> {
    const record = await this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { id: uuidv7(), userId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    return mapCart(record);
  }

  public async add(userId: string, productId: string, quantity: number): Promise<Cart> {
    const cart = await this.getOrCreate(userId);
    await this.prisma.$transaction([
      this.prisma.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        update: { quantity: { increment: quantity } },
        create: { cartId: cart.id, productId, quantity },
      }),
      this.prisma.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } }),
    ]);
    return this.getOrCreate(userId);
  }

  public async setQuantity(userId: string, productId: string, quantity: number): Promise<Cart> {
    const cart = await this.getOrCreate(userId);
    await this.prisma.$transaction([
      this.prisma.cartItem.update({
        where: { cartId_productId: { cartId: cart.id, productId } },
        data: { quantity },
      }),
      this.prisma.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } }),
    ]);
    return this.getOrCreate(userId);
  }

  public async remove(userId: string, productId: string): Promise<Cart> {
    const cart = await this.getOrCreate(userId);
    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } }),
      this.prisma.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } }),
    ]);
    return this.getOrCreate(userId);
  }

  public async removePurchased(
    input: Parameters<CartRepository['removePurchased']>[0],
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      if (await transaction.inboxEvent.findUnique({ where: { eventId: input.eventId } })) return;
      const cart = await transaction.cart.findUnique({
        where: { userId: input.userId },
        include: { items: true },
      });
      if (cart) {
        for (const purchased of input.items) {
          const current = cart.items.find((item) => item.productId === purchased.productId);
          if (!current) continue;
          const remaining = current.quantity - purchased.quantity;
          if (remaining > 0) {
            await transaction.cartItem.update({
              where: { cartId_productId: { cartId: cart.id, productId: purchased.productId } },
              data: { quantity: remaining },
            });
          } else {
            await transaction.cartItem.delete({
              where: { cartId_productId: { cartId: cart.id, productId: purchased.productId } },
            });
          }
        }
        await transaction.cart.update({
          where: { id: cart.id },
          data: { version: { increment: 1 } },
        });
      }
      await transaction.inboxEvent.create({
        data: { eventId: input.eventId, eventType: input.eventType },
      });
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

function mapCart(record: {
  id: string;
  userId: string;
  version: number;
  updatedAt: Date;
  items: Array<{ productId: string; quantity: number }>;
}): Cart {
  return {
    id: record.id,
    userId: record.userId,
    version: record.version,
    updatedAt: record.updatedAt,
    items: record.items.map(({ productId, quantity }) => ({ productId, quantity })),
  };
}
