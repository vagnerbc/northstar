import { eventSchemas } from '@ecommerce/contracts';
import { WorkflowExecutionAlreadyStartedError, type WorkflowClient } from '@temporalio/client';
import type { OrderRepository } from '../../application/ports.js';
import { config } from '../../infrastructure/config.js';
import {
  checkoutWorkflow,
  paymentAuthorizedSignal,
  paymentCapturedSignal,
  paymentFailedSignal,
} from '../../temporal/workflows.js';

export function createCheckoutEventHandler(client: WorkflowClient, repository: OrderRepository) {
  return async (input: unknown): Promise<void> => {
    const metadata = input as { eventId?: string; eventType?: string };
    if (
      !metadata.eventId ||
      !metadata.eventType ||
      (await repository.hasProcessed(metadata.eventId))
    )
      return;
    if (metadata.eventType === 'checkout.requested.v1') {
      const event = eventSchemas['checkout.requested.v1'].parse(input);
      try {
        await client.start(checkoutWorkflow, {
          workflowId: `checkout-${event.data.orderId}`,
          taskQueue: 'checkout-v1',
          args: [
            {
              orderId: event.data.orderId,
              correlationId: event.correlationId,
              paymentWindowMs: config.PAYMENT_WINDOW_MS,
              captureWindowMs: config.PAYMENT_CAPTURE_WINDOW_MS,
            },
          ],
        });
      } catch (error) {
        if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error;
      }
      await repository.recordProcessed(event.eventId, event.eventType);
      return;
    }
    if (metadata.eventType?.startsWith('payment.')) {
      const type = metadata.eventType as
        'payment.authorized.v1' | 'payment.captured.v1' | 'payment.failed.v1';
      if (!['payment.authorized.v1', 'payment.captured.v1', 'payment.failed.v1'].includes(type))
        return;
      const event = eventSchemas[type].parse(input);
      const handle = client.getHandle(`checkout-${event.data.orderId}`);
      if (type === 'payment.authorized.v1') await handle.signal(paymentAuthorizedSignal);
      if (type === 'payment.captured.v1') await handle.signal(paymentCapturedSignal);
      if (type === 'payment.failed.v1')
        await handle.signal(paymentFailedSignal, event.data.failureCode);
      await repository.recordProcessed(event.eventId, event.eventType);
    }
  };
}
