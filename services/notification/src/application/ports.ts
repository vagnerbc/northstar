import type { EmailContent, NotificationMessage } from '../domain/notification.js';

export interface NotificationRepository {
  createIfAbsent(message: Omit<NotificationMessage, 'status'>): Promise<NotificationMessage>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  isReady(): Promise<boolean>;
}

export interface EmailProvider {
  send(message: EmailContent): Promise<void>;
}
