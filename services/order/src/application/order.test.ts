import { describe, expect, it, vi } from 'vitest';
import type { Order } from '../domain/order.js';
import { OrderApplication } from './order.js';
import type { CartClient, OrderRepository } from './ports.js';

const address = {
  recipientName: 'Demo Buyer',
  line1: '123 Example Street',
  city: 'Sao Paulo',
  state: 'SP',
  postalCode: '01000-000',
  country: 'BR' as const,
};

const order: Order = {
  id: crypto.randomUUID(),
  displayId: 'ORD-1000',
  userId: 'buyer',
  recipientEmail: 'buyer@example.com',
  status: 'CHECKOUT_REQUESTED',
  cartId: crypto.randomUUID(),
  cartVersion: 2,
  shippingAddress: address,
  totalAmount: 0,
  currency: 'BRL',
  items: [{ productId: crypto.randomUUID(), quantity: 1 }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createRepository(): OrderRepository {
  return {
    createCheckout: vi.fn().mockResolvedValue(order),
    findById: vi.fn().mockResolvedValue(order),
    findOwned: vi.fn().mockResolvedValue(order),
    listOwned: vi.fn().mockResolvedValue({ items: [order] }),
    applyReservation: vi.fn(),
    attachPayment: vi.fn(),
    setStatus: vi.fn(),
    confirm: vi.fn(),
    fail: vi.fn(),
    hasProcessed: vi.fn().mockResolvedValue(false),
    recordProcessed: vi.fn(),
    isReady: vi.fn().mockResolvedValue(true),
  };
}

describe('OrderApplication', () => {
  it('creates checkout from a server-side cart snapshot', async () => {
    const repository = createRepository();
    const cartClient: CartClient = {
      getSnapshot: vi.fn().mockResolvedValue({
        id: order.cartId,
        userId: 'buyer',
        version: 2,
        items: order.items,
      }),
    };
    const application = new OrderApplication(repository, cartClient);

    await expect(
      application.checkout({
        userId: 'buyer',
        recipientEmail: 'buyer@example.com',
        idempotencyKey: 'checkout-key',
        shippingAddress: address,
        correlationId: 'correlation',
      }),
    ).resolves.toEqual(order);
    const createCheckout = vi.mocked(repository.createCheckout);
    expect(createCheckout).toHaveBeenCalledOnce();
    expect(createCheckout.mock.calls[0]?.[0].cart.version).toBe(2);
  });

  it('rejects an empty cart before creating an order', async () => {
    const repository = createRepository();
    const cartClient: CartClient = {
      getSnapshot: vi
        .fn()
        .mockResolvedValue({ id: 'cart', userId: 'buyer', version: 1, items: [] }),
    };
    const application = new OrderApplication(repository, cartClient);

    await expect(
      application.checkout({
        userId: 'buyer',
        recipientEmail: 'buyer@example.com',
        idempotencyKey: 'checkout-key',
        shippingAddress: address,
        correlationId: 'correlation',
      }),
    ).rejects.toMatchObject({ code: 'EMPTY_CART' });
    expect(repository.createCheckout).not.toHaveBeenCalled();
  });

  it('restricts order reads to their owner and delegates pagination', async () => {
    const repository = createRepository();
    const application = new OrderApplication(repository, {} as CartClient);

    await expect(application.get(order.id, 'buyer')).resolves.toEqual(order);
    await expect(application.list('buyer', undefined, 10)).resolves.toEqual({ items: [order] });

    vi.mocked(repository.findOwned).mockResolvedValue(null);
    await expect(application.get(order.id, 'another-buyer')).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
    });
  });
});
