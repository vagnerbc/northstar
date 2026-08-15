import type { z } from 'zod';
import type { orderNotificationDataSchema } from '@ecommerce/contracts';

type OrderEventData = z.infer<typeof orderNotificationDataSchema>;

export function renderOrderEmail(
  kind: 'ORDER_CONFIRMED' | 'CHECKOUT_FAILED',
  data: OrderEventData,
) {
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'BRL',
  }).format(data.total.amount / 100);
  const itemLines = data.items.map((item) => `${item.quantity} × ${item.name}`).join('\n');
  if (kind === 'ORDER_CONFIRMED') {
    return {
      subject: `Order ${data.displayId} confirmed`,
      text: `Your order has been confirmed.\n\n${itemLines}\n\nTotal: ${formattedTotal}`,
      html: `<h1>Order confirmed</h1><p>Your order <strong>${escapeHtml(data.displayId)}</strong> has been confirmed.</p><pre>${escapeHtml(itemLines)}</pre><p>Total: <strong>${formattedTotal}</strong></p>`,
    };
  }
  return {
    subject: `Checkout ${data.displayId} could not be completed`,
    text: `We could not complete your checkout. Reference: ${data.displayId}. Reason: ${data.failureReason ?? 'Checkout failed'}.`,
    html: `<h1>Checkout not completed</h1><p>Reference: <strong>${escapeHtml(data.displayId)}</strong></p><p>${escapeHtml(data.failureReason ?? 'Checkout failed')}</p>`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
