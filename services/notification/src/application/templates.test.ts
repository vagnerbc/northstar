import { describe, expect, it } from 'vitest';
import { renderOrderEmail } from './templates.js';

describe('notification templates', () => {
  it('renders a confirmation without exposing markup from product names', () => {
    const content = renderOrderEmail('ORDER_CONFIRMED', {
      orderId: crypto.randomUUID(),
      displayId: 'ORD-123',
      userId: 'buyer',
      recipientEmail: 'buyer@example.com',
      items: [
        {
          productId: crypto.randomUUID(),
          name: '<script>alert(1)</script>',
          quantity: 1,
          unitPrice: { amount: 1000, currency: 'BRL' },
        },
      ],
      total: { amount: 1000, currency: 'BRL' },
    });
    expect(content.html).not.toContain('<script>');
    expect(content.subject).toContain('ORD-123');
  });

  it('renders a failure email with escaped provider-neutral text', () => {
    const content = renderOrderEmail('CHECKOUT_FAILED', {
      orderId: crypto.randomUUID(),
      displayId: 'ORD-FAILED',
      userId: 'buyer',
      recipientEmail: 'buyer@example.com',
      items: [],
      total: { amount: 0, currency: 'BRL' },
      failureReason: '<temporary failure>',
    });

    expect(content.subject).toContain('could not be completed');
    expect(content.text).toContain('<temporary failure>');
    expect(content.html).toContain('&lt;temporary failure&gt;');
    expect(content.html).not.toContain('<temporary failure>');
  });
});
