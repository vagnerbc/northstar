import { correlationMiddleware, createHealthRouter, problemDetailsHandler } from '@ecommerce/http';
import express, { type Express } from 'express';
import { OrderApplication } from './application/order.js';
import type { CartClient, OrderRepository } from './application/ports.js';
import { createOrderRouter } from './interfaces/http/routes.js';

export function createApp(repository: OrderRepository, cartClient: CartClient): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(correlationMiddleware);
  app.use(express.json({ limit: '256kb' }));
  app.use(createHealthRouter(() => repository.isReady()));
  app.use(createOrderRouter(new OrderApplication(repository, cartClient)));
  app.use(problemDetailsHandler);
  return app;
}
