import { AppError } from '@ecommerce/http';
import type { ShippingAddress } from '../domain/order.js';
import type { CartClient, OrderRepository } from './ports.js';

export class OrderApplication {
  public constructor(
    private readonly repository: OrderRepository,
    private readonly cartClient: CartClient,
  ) {}

  public async checkout(input: {
    userId: string;
    recipientEmail: string;
    idempotencyKey: string;
    shippingAddress: ShippingAddress;
    correlationId: string;
  }) {
    const cart = await this.cartClient.getSnapshot(input.userId, input.correlationId);
    if (cart.items.length === 0) throw new AppError('The cart is empty.', 409, 'EMPTY_CART');
    return this.repository.createCheckout({ ...input, cart });
  }

  public async get(orderId: string, userId: string) {
    const order = await this.repository.findOwned(orderId, userId);
    if (!order) throw new AppError('Order was not found.', 404, 'ORDER_NOT_FOUND');
    return order;
  }

  public list(userId: string, cursor: string | undefined, limit: number) {
    return this.repository.listOwned(userId, cursor, limit);
  }
}
