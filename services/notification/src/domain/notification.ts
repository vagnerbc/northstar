export interface NotificationMessage {
  id: string;
  eventId: string;
  orderId: string;
  kind: 'ORDER_CONFIRMED' | 'CHECKOUT_FAILED';
  recipientEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
}

export interface EmailContent {
  to: string;
  subject: string;
  text: string;
  html: string;
}
