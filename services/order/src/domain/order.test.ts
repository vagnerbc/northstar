import { describe, expect, it } from 'vitest';
import { compensationSteps, toCheckoutItems } from './order.js';

describe('checkout compensation', () => {
  it('refunds before releasing inventory after capture', () => {
    expect(compensationSteps({ reserved: true, paymentCreated: true, captured: true })).toEqual([
      'REFUND_PAYMENT',
      'RELEASE_INVENTORY',
    ]);
  });
  it('cancels an uncaptured payment before releasing inventory', () => {
    expect(compensationSteps({ reserved: true, paymentCreated: true, captured: false })).toEqual([
      'CANCEL_PAYMENT',
      'RELEASE_INVENTORY',
    ]);
  });

  it('does nothing when no external side effect was created', () => {
    expect(compensationSteps({ reserved: false, paymentCreated: false, captured: false })).toEqual(
      [],
    );
  });

  it('creates a self-contained checkout item snapshot with safe defaults', () => {
    expect(
      toCheckoutItems({
        id: 'order',
        displayId: 'ORD-1',
        userId: 'buyer',
        recipientEmail: 'buyer@example.com',
        status: 'CHECKOUT_REQUESTED',
        cartId: 'cart',
        cartVersion: 1,
        shippingAddress: {
          recipientName: 'Buyer',
          line1: 'Street',
          city: 'City',
          state: 'SP',
          postalCode: '00000-000',
          country: 'BR',
        },
        totalAmount: 0,
        currency: 'BRL',
        items: [{ productId: 'product', quantity: 2 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toEqual([
      {
        productId: 'product',
        name: 'Product product',
        quantity: 2,
        unitPrice: { amount: 0, currency: 'BRL' },
      },
    ]);
  });
});
