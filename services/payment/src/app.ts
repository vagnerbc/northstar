import { correlationMiddleware, createHealthRouter, problemDetailsHandler } from '@ecommerce/http';
import { createPaymentMetrics } from '@ecommerce/observability';
import express, { type Express } from 'express';
import type { PaymentApplication } from './application/payment.js';
import type { PaymentRepository } from './application/ports.js';
import { createPaymentRouter } from './interfaces/http/routes.js';

const paymentMetrics = createPaymentMetrics();

export function createApp(application: PaymentApplication, repository: PaymentRepository): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(correlationMiddleware);
  app.post(
    '/api/v1/payments/webhooks/stripe',
    express.raw({ type: 'application/json', limit: '512kb' }),
    async (request, response, next) => {
      try {
        const signature = request.header('stripe-signature');
        if (!signature) throw new Error('Stripe-Signature is required.');
        await application.webhook(
          request.body as Buffer,
          signature,
          request.header('x-correlation-id')!,
        );
        paymentMetrics.webhookReceived.add(1);
        response.json({ received: true });
      } catch (error) {
        paymentMetrics.webhookFailures.add(1);
        next(error);
      }
    },
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(createHealthRouter(() => repository.isReady()));
  app.use(createPaymentRouter(application));
  app.use(problemDetailsHandler);
  return app;
}
