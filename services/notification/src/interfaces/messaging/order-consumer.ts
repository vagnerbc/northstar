import { eventSchemas } from '@ecommerce/contracts';
import { v7 as uuidv7 } from 'uuid';
import type { NotificationApplication } from '../../application/notification.js';
import { renderOrderEmail } from '../../application/templates.js';

export function createOrderNotificationHandler(application: NotificationApplication) {
  return async (input: unknown): Promise<void> => {
    const type = (input as { eventType?: string }).eventType;
    if (type !== 'order.confirmed.v1' && type !== 'order.checkout_failed.v1') return;
    const event = eventSchemas[type].parse(input);
    const kind = type === 'order.confirmed.v1' ? 'ORDER_CONFIRMED' : 'CHECKOUT_FAILED';
    const content = renderOrderEmail(kind, event.data);
    await application.deliver({
      id: uuidv7(),
      eventId: event.eventId,
      orderId: event.data.orderId,
      kind,
      recipientEmail: event.data.recipientEmail,
      subject: content.subject,
      textBody: content.text,
      htmlBody: content.html,
    });
  };
}
