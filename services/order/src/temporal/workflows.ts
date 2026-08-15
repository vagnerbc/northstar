import { condition, defineSignal, proxyActivities, setHandler } from '@temporalio/workflow';
import { compensationSteps } from '../domain/order.js';
import type { CheckoutActivities, CheckoutWorkflowInput } from './types.js';

export const paymentAuthorizedSignal = defineSignal('paymentAuthorized');
export const paymentCapturedSignal = defineSignal('paymentCaptured');
export const paymentFailedSignal = defineSignal<[string | undefined]>('paymentFailed');

const activities = proxyActivities<CheckoutActivities>({
  startToCloseTimeout: '20 seconds',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '10 seconds',
    maximumAttempts: 5,
  },
});

export async function checkoutWorkflow(input: CheckoutWorkflowInput): Promise<void> {
  type PaymentState = 'WAITING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED';
  let paymentState: PaymentState = 'WAITING';
  let paymentFailure: string | undefined;
  setHandler(paymentAuthorizedSignal, () => {
    if (paymentState === 'WAITING') paymentState = 'AUTHORIZED';
  });
  setHandler(paymentCapturedSignal, () => {
    paymentState = 'CAPTURED';
  });
  setHandler(paymentFailedSignal, (reason) => {
    paymentState = 'FAILED';
    paymentFailure = reason;
  });

  let reserved = false;
  let paymentCreated = false;
  let captured = false;
  let paymentId: string | undefined;
  try {
    let order = await activities.loadOrder(input.orderId);
    const reservation = await activities.reserveInventory(order, input.correlationId);
    reserved = true;
    order = await activities.applyReservation(input.orderId, reservation);
    const payment = await activities.createPayment(order, input.correlationId);
    paymentId = payment.paymentId;
    paymentCreated = true;

    const authorized = await condition(() => paymentState !== 'WAITING', input.paymentWindowMs);
    if (!authorized) throw new Error('PAYMENT_TIMEOUT');
    if ((paymentState as PaymentState) === 'FAILED')
      throw new Error(paymentFailure ?? 'PAYMENT_FAILED');
    await activities.markStatus(input.orderId, 'PAYMENT_AUTHORIZED');
    await activities.capturePayment(input.orderId, paymentId, input.correlationId);

    const captureConfirmed = await condition(
      () => paymentState === 'CAPTURED' || paymentState === 'FAILED',
      input.captureWindowMs,
    );
    if (!captureConfirmed) throw new Error('PAYMENT_CAPTURE_TIMEOUT');
    if ((paymentState as PaymentState) === 'FAILED')
      throw new Error(paymentFailure ?? 'PAYMENT_CAPTURE_FAILED');
    captured = true;
    await activities.markStatus(input.orderId, 'PAYMENT_CAPTURED');
    await activities.commitInventory(input.orderId, input.correlationId);
    reserved = false;
    await activities.confirmOrder(input.orderId, input.correlationId);
  } catch (error) {
    await activities.markStatus(input.orderId, 'COMPENSATING');
    let manualReview = false;
    for (const step of compensationSteps({ reserved, paymentCreated, captured })) {
      try {
        if (step === 'REFUND_PAYMENT' && paymentId)
          await activities.refundPayment(input.orderId, paymentId, input.correlationId);
        if (step === 'CANCEL_PAYMENT' && paymentId)
          await activities.cancelPayment(input.orderId, paymentId, input.correlationId);
        if (step === 'RELEASE_INVENTORY')
          await activities.releaseInventory(input.orderId, input.correlationId);
      } catch {
        manualReview = true;
      }
    }
    const reason = error instanceof Error ? error.message : 'CHECKOUT_FAILED';
    await activities.failOrder(input.orderId, reason, manualReview, input.correlationId);
  }
}
