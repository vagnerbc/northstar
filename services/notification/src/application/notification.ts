import type { EmailProvider, NotificationRepository } from './ports.js';
import type { NotificationMessage } from '../domain/notification.js';

export class NotificationApplication {
  public constructor(
    private readonly repository: NotificationRepository,
    private readonly provider: EmailProvider,
  ) {}

  public async deliver(message: Omit<NotificationMessage, 'status'>): Promise<void> {
    const notification = await this.repository.createIfAbsent(message);
    if (notification.status === 'SENT') return;
    try {
      await this.provider.send({
        to: notification.recipientEmail,
        subject: notification.subject,
        text: notification.textBody,
        html: notification.htmlBody,
      });
      await this.repository.markSent(notification.id);
    } catch (error) {
      await this.repository.markFailed(
        notification.id,
        error instanceof Error ? error.message : 'Unknown email error',
      );
      throw error;
    }
  }
}
