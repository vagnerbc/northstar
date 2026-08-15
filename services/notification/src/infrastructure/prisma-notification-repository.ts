import { v7 as uuidv7 } from 'uuid';
import type { NotificationRepository } from '../application/ports.js';
import type { NotificationMessage } from '../domain/notification.js';
import type { NotificationStatus, PrismaClient } from '../generated/prisma/client.js';

export class PrismaNotificationRepository implements NotificationRepository {
  public constructor(private readonly prisma: PrismaClient) {}
  public async createIfAbsent(
    message: Omit<NotificationMessage, 'status'>,
  ): Promise<NotificationMessage> {
    const value = await this.prisma.notification.upsert({
      where: { eventId: message.eventId },
      update: {},
      create: { ...message, id: message.id || uuidv7() },
    });
    return map(value);
  }
  public async markSent(id: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
    });
  }
  public async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { status: 'FAILED', attempts: { increment: 1 }, lastError: error.slice(0, 1000) },
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

function map(value: {
  id: string;
  eventId: string;
  orderId: string;
  kind: string;
  recipientEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  status: NotificationStatus;
}): NotificationMessage {
  return {
    id: value.id,
    eventId: value.eventId,
    orderId: value.orderId,
    kind: value.kind === 'ORDER_CONFIRMED' ? 'ORDER_CONFIRMED' : 'CHECKOUT_FAILED',
    recipientEmail: value.recipientEmail,
    subject: value.subject,
    textBody: value.textBody,
    htmlBody: value.htmlBody,
    status: value.status,
  };
}
