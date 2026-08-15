export type PaymentStatus =
  | 'CREATED'
  | 'REQUIRES_ACTION'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'CANCELED'
  | 'FAILED'
  | 'REFUNDED'
  | 'REFUND_FAILED';

export interface Payment {
  id: string;
  orderId: string;
  userId: string;
  provider: 'stripe' | 'fake';
  providerPaymentId: string;
  clientSecret?: string;
  amount: number;
  currency: 'BRL';
  status: PaymentStatus;
  failureCode?: string;
}

export interface ProviderPayment {
  providerPaymentId: string;
  clientSecret: string;
  state: 'REQUIRES_ACTION' | 'AUTHORIZED' | 'CAPTURED' | 'CANCELED' | 'REFUNDED';
}

export interface ProviderWebhookEvent {
  id: string;
  type: 'AUTHORIZED' | 'CAPTURED' | 'FAILED';
  providerPaymentId: string;
  failureCode?: string;
}
