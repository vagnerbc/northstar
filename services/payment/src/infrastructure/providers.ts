import Stripe from 'stripe';
import { v7 as uuidv7 } from 'uuid';
import type { PaymentProvider } from '../application/ports.js';
import type { ProviderPayment, ProviderWebhookEvent } from '../domain/payment.js';

export class StripePaymentProvider implements PaymentProvider {
  public readonly name = 'stripe' as const;
  private readonly stripe: Stripe;

  public constructor(
    secretKey: string,
    private readonly webhookSecret: string,
  ) {
    this.stripe = new Stripe(secretKey);
  }

  public async create(input: Parameters<PaymentProvider['create']>[0]): Promise<ProviderPayment> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amount,
        currency: 'brl',
        capture_method: 'manual',
        payment_method_types: ['card'],
        metadata: { orderId: input.orderId, userId: input.userId },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    if (!intent.client_secret) throw new Error('Stripe did not return a client secret.');
    return {
      providerPaymentId: intent.id,
      clientSecret: intent.client_secret,
      state: 'REQUIRES_ACTION',
    };
  }

  public async capture(
    providerPaymentId: string,
    idempotencyKey: string,
  ): Promise<ProviderPayment> {
    const intent = await this.stripe.paymentIntents.capture(
      providerPaymentId,
      {},
      { idempotencyKey },
    );
    return mapIntent(intent);
  }

  public async cancel(providerPaymentId: string, idempotencyKey: string): Promise<ProviderPayment> {
    const intent = await this.stripe.paymentIntents.cancel(
      providerPaymentId,
      {},
      { idempotencyKey },
    );
    return mapIntent(intent);
  }

  public async refund(providerPaymentId: string, idempotencyKey: string): Promise<ProviderPayment> {
    await this.stripe.refunds.create({ payment_intent: providerPaymentId }, { idempotencyKey });
    const intent = await this.stripe.paymentIntents.retrieve(providerPaymentId);
    return { ...mapIntent(intent), state: 'REFUNDED' };
  }

  public parseWebhook(payload: Buffer, signature: string): ProviderWebhookEvent {
    const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    if (!event.type.startsWith('payment_intent.'))
      throw new Error(`Unsupported Stripe event ${event.type}`);
    const intent = event.data.object as Stripe.PaymentIntent;
    if (event.type === 'payment_intent.amount_capturable_updated') {
      return { id: event.id, type: 'AUTHORIZED', providerPaymentId: intent.id };
    }
    if (event.type === 'payment_intent.succeeded') {
      return { id: event.id, type: 'CAPTURED', providerPaymentId: intent.id };
    }
    if (event.type === 'payment_intent.payment_failed') {
      return {
        id: event.id,
        type: 'FAILED',
        providerPaymentId: intent.id,
        ...(intent.last_payment_error?.code ? { failureCode: intent.last_payment_error.code } : {}),
      };
    }
    throw new Error(`Unsupported Stripe event ${event.type}`);
  }
}

export class FakePaymentProvider implements PaymentProvider {
  public readonly name = 'fake' as const;
  public async create(): Promise<ProviderPayment> {
    const id = `fake_pi_${uuidv7()}`;
    return { providerPaymentId: id, clientSecret: `fake_secret_${id}`, state: 'REQUIRES_ACTION' };
  }
  public async capture(providerPaymentId: string): Promise<ProviderPayment> {
    return {
      providerPaymentId,
      clientSecret: `fake_secret_${providerPaymentId}`,
      state: 'CAPTURED',
    };
  }
  public async cancel(providerPaymentId: string): Promise<ProviderPayment> {
    return {
      providerPaymentId,
      clientSecret: `fake_secret_${providerPaymentId}`,
      state: 'CANCELED',
    };
  }
  public async refund(providerPaymentId: string): Promise<ProviderPayment> {
    return {
      providerPaymentId,
      clientSecret: `fake_secret_${providerPaymentId}`,
      state: 'REFUNDED',
    };
  }
  public parseWebhook(): ProviderWebhookEvent {
    throw new Error('Fake provider does not accept webhooks.');
  }
}

function mapIntent(intent: Stripe.PaymentIntent): ProviderPayment {
  const state =
    intent.status === 'succeeded'
      ? 'CAPTURED'
      : intent.status === 'canceled'
        ? 'CANCELED'
        : intent.status === 'requires_capture'
          ? 'AUTHORIZED'
          : 'REQUIRES_ACTION';
  return {
    providerPaymentId: intent.id,
    clientSecret: intent.client_secret ?? '',
    state,
  };
}
