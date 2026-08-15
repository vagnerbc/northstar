import { correlationMiddleware, createHealthRouter, problemDetailsHandler } from '@ecommerce/http';
import express, { type Express } from 'express';
import { CartApplication } from './application/cart.js';
import type { CartRepository, ProductCatalog } from './application/ports.js';
import { createCartRouter } from './interfaces/http/routes.js';

export function createApp(repository: CartRepository, catalog: ProductCatalog): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(correlationMiddleware);
  app.use(express.json({ limit: '128kb' }));
  app.use(createHealthRouter(() => repository.isReady()));
  app.use(createCartRouter(new CartApplication(repository, catalog), repository));
  app.use(problemDetailsHandler);
  return app;
}
