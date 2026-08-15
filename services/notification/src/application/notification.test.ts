import { describe, expect, it, vi } from 'vitest';
import type { NotificationMessage } from '../domain/notification.js';
import { NotificationApplication } from './notification.js';
import type { EmailProvider, NotificationRepository } from './ports.js';

const message: Omit<NotificationMessage, 'status'> = {
  id: crypto.randomUUID(),
  eventId: crypto.randomUUID(),
  orderId: crypto.randomUUID(),
  kind: 'ORDER_CONFIRMED',
  recipientEmail: 'buyer@example.com',
  subject: 'Order confirmed',
  textBody: 'Your order is confirmed.',
  htmlBody: '<p>Your order is confirmed.</p>',
};

function createRepository(status: NotificationMessage['status'] = 'PENDING') {
  const repository: NotificationRepository = {
    createIfAbsent: vi.fn().mockResolvedValue({ ...message, status }),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockResolvedValue(true),
  };
  return repository;
}

describe('NotificationApplication', () => {
  it('sends and records a pending notification', async () => {
    const repository = createRepository();
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue(undefined) };

    await new NotificationApplication(repository, provider).deliver(message);

    expect(provider.send).toHaveBeenCalledWith({
      to: message.recipientEmail,
      subject: message.subject,
      text: message.textBody,
      html: message.htmlBody,
    });
    expect(repository.markSent).toHaveBeenCalledWith(message.id);
  });

  it('does not redeliver an event already marked as sent', async () => {
    const repository = createRepository('SENT');
    const provider: EmailProvider = { send: vi.fn() };

    await new NotificationApplication(repository, provider).deliver(message);
    expect(provider.send).not.toHaveBeenCalled();
  });

  it.each([
    [new Error('SMTP unavailable'), 'SMTP unavailable'],
    ['opaque failure', 'Unknown email error'],
  ])('records delivery failures without swallowing them', async (failure, recordedMessage) => {
    const repository = createRepository();
    const provider: EmailProvider = { send: vi.fn().mockRejectedValue(failure) };

    await expect(new NotificationApplication(repository, provider).deliver(message)).rejects.toBe(
      failure,
    );
    expect(repository.markFailed).toHaveBeenCalledWith(message.id, recordedMessage);
  });
});
