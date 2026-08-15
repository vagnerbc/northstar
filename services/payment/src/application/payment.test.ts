import { describe, expect, it, vi } from 'vitest';
import type { Payment, PaymentStatus } from '../domain/payment.js';
import { PaymentApplication } from './payment.js';
import type { PaymentProvider, PaymentRepository } from './ports.js';

function payment(status: PaymentStatus = 'REQUIRES_ACTION'): Payment {
  return {
    id: crypto.randomUUID(),
    orderId: crypto.randomUUID(),
    userId: 'buyer',
    provider: 'fake',
    providerPaymentId: `provider-${crypto.randomUUID()}`,
    clientSecret: 'fake_secret',
    amount: 12_900,
    currency: 'BRL',
    status,
  };
}

function createRepository(initial: Payment | null = null): PaymentRepository {
  return {
    findByOrderId: vi.fn().mockResolvedValue(initial),
    findById: vi.fn().mockResolvedValue(initial),
    create: vi.fn().mockImplementation(async (value: Payment) => value),
    updateStatus: vi
      .fn()
      .mockImplementation(async (_id: string, status: PaymentStatus) => ({ ...initial!, status })),
    applyWebhook: vi.fn().mockResolvedValue(initial),
    emitState: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockResolvedValue(true),
  };
}

function createProvider(name: 'stripe' | 'fake' = 'fake'): PaymentProvider {
  return {
    name,
    create: vi.fn().mockResolvedValue({
      providerPaymentId: 'provider-payment',
      clientSecret: 'client-secret',
      state: 'REQUIRES_ACTION',
    }),
    capture: vi.fn().mockResolvedValue({
      providerPaymentId: 'provider-payment',
      clientSecret: 'client-secret',
      state: 'CAPTURED',
    }),
    cancel: vi.fn().mockResolvedValue({
      providerPaymentId: 'provider-payment',
      clientSecret: 'client-secret',
      state: 'CANCELED',
    }),
    refund: vi.fn().mockResolvedValue({
      providerPaymentId: 'provider-payment',
      clientSecret: 'client-secret',
      state: 'REFUNDED',
    }),
    parseWebhook: vi.fn().mockReturnValue({
      id: 'event-1',
      type: 'AUTHORIZED',
      providerPaymentId: 'provider-payment',
    }),
  };
}

describe('PaymentApplication', () => {
  it('rejects a non-positive or fractional amount before creating an intent', async () => {
    const repository = createRepository();
    const provider = createProvider();
    const application = new PaymentApplication(repository, provider);

    for (const amount of [0, -1, 10.5]) {
      await expect(
        application.create({
          orderId: crypto.randomUUID(),
          userId: 'buyer',
          amount,
          idempotencyKey: 'test',
        }),
      ).rejects.toMatchObject({ code: 'INVALID_PAYMENT_AMOUNT' });
    }
    expect(provider.create).not.toHaveBeenCalled();
  });

  it('returns an existing payment for an idempotent create command', async () => {
    const existing = payment();
    const repository = createRepository(existing);
    const provider = createProvider();
    const application = new PaymentApplication(repository, provider);

    await expect(
      application.create({
        orderId: existing.orderId,
        userId: existing.userId,
        amount: existing.amount,
        idempotencyKey: 'same-command',
      }),
    ).resolves.toEqual(existing);
    expect(provider.create).not.toHaveBeenCalled();
  });

  it('creates a BRL payment and persists only provider-safe fields', async () => {
    const repository = createRepository();
    const application = new PaymentApplication(repository, createProvider('stripe'));

    const result = await application.create({
      orderId: 'order-1',
      userId: 'buyer',
      amount: 12_900,
      idempotencyKey: 'payment-key',
    });

    expect(result).toMatchObject({
      orderId: 'order-1',
      provider: 'stripe',
      amount: 12_900,
      currency: 'BRL',
      status: 'REQUIRES_ACTION',
    });
    expect(repository.create).toHaveBeenCalledOnce();
  });

  it('returns only an owned payment session with a client secret', async () => {
    const current = payment();
    const repository = createRepository(current);
    const application = new PaymentApplication(repository, createProvider());

    await expect(application.session(current.id, current.userId)).resolves.toMatchObject({
      paymentId: current.id,
      clientSecret: current.clientSecret,
    });
    await expect(application.session(current.id, 'intruder')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
    });

    const { clientSecret: _clientSecret, ...withoutClientSecret } = current;
    vi.mocked(repository.findById).mockResolvedValue(withoutClientSecret);
    await expect(application.session(current.id, current.userId)).rejects.toMatchObject({
      code: 'PAYMENT_SESSION_UNAVAILABLE',
    });
  });

  it('captures fake authorized payments and emits the authoritative event', async () => {
    const authorized = payment('AUTHORIZED');
    const repository = createRepository(authorized);
    const application = new PaymentApplication(repository, createProvider());

    await expect(
      application.capture(authorized.id, 'capture-key', 'correlation'),
    ).resolves.toMatchObject({ status: 'CAPTURED' });
    expect(repository.emitState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CAPTURED' }),
      'payment.captured.v1',
      'correlation',
    );
  });

  it('waits for Stripe webhook confirmation and rejects invalid capture states', async () => {
    const authorized = payment('AUTHORIZED');
    const repository = createRepository(authorized);
    const application = new PaymentApplication(repository, createProvider('stripe'));

    await expect(application.capture(authorized.id, 'capture-key', 'correlation')).resolves.toEqual(
      authorized,
    );

    vi.mocked(repository.findById).mockResolvedValue(payment('REQUIRES_ACTION'));
    await expect(application.capture(authorized.id, 'key', 'correlation')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_AUTHORIZED',
    });

    const captured = payment('CAPTURED');
    vi.mocked(repository.findById).mockResolvedValue(captured);
    await expect(application.capture(captured.id, 'key', 'correlation')).resolves.toEqual(captured);
  });

  it('cancels an active payment and treats an existing cancellation as idempotent', async () => {
    const current = payment();
    const repository = createRepository(current);
    const provider = createProvider();
    const application = new PaymentApplication(repository, provider);

    await expect(application.cancel(current.id, 'cancel-key')).resolves.toMatchObject({
      status: 'CANCELED',
    });

    const canceled = payment('CANCELED');
    vi.mocked(repository.findById).mockResolvedValue(canceled);
    await expect(application.cancel(canceled.id, 'cancel-key')).resolves.toEqual(canceled);
  });

  it('refunds only captured payments and records provider failures', async () => {
    const captured = payment('CAPTURED');
    const repository = createRepository(captured);
    const provider = createProvider();
    const application = new PaymentApplication(repository, provider);

    await expect(application.refund(captured.id, 'refund-key')).resolves.toMatchObject({
      status: 'REFUNDED',
    });

    const refunded = payment('REFUNDED');
    vi.mocked(repository.findById).mockResolvedValue(refunded);
    await expect(application.refund(refunded.id, 'refund-key')).resolves.toEqual(refunded);

    vi.mocked(repository.findById).mockResolvedValue(payment('AUTHORIZED'));
    await expect(application.refund(captured.id, 'refund-key')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_CAPTURED',
    });

    vi.mocked(repository.findById).mockResolvedValue(captured);
    vi.mocked(provider.refund).mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(application.refund(captured.id, 'refund-key')).rejects.toThrow(
      'provider unavailable',
    );
    expect(repository.updateStatus).toHaveBeenCalledWith(captured.id, 'REFUND_FAILED');
  });

  it('validates fake authorization, webhook delegation and missing records', async () => {
    const current = payment();
    const repository = createRepository(current);
    const fakeApplication = new PaymentApplication(repository, createProvider());

    await expect(fakeApplication.fakeAuthorize(current.id, 'correlation')).resolves.toMatchObject({
      status: 'AUTHORIZED',
    });
    expect(repository.emitState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'AUTHORIZED' }),
      'payment.authorized.v1',
      'correlation',
    );

    await fakeApplication.webhook(Buffer.from('{}'), 'signature', 'correlation');
    expect(repository.applyWebhook).toHaveBeenCalledOnce();

    const stripeApplication = new PaymentApplication(repository, createProvider('stripe'));
    await expect(stripeApplication.fakeAuthorize(current.id, 'correlation')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    vi.mocked(repository.findById).mockResolvedValue(null);
    await expect(fakeApplication.session(current.id, 'buyer')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
    });
  });
});
