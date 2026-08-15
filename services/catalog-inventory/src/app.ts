import { correlationMiddleware, createHealthRouter, problemDetailsHandler } from '@ecommerce/http';
import express, { type Express } from 'express';
import type { CatalogRepository } from './application/ports.js';
import { CatalogApplication } from './application/catalog.js';
import { config } from './infrastructure/config.js';
import { createCatalogRouter } from './interfaces/http/routes.js';

export function createApp(repository: CatalogRepository): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(correlationMiddleware);
  app.use(express.json({ limit: '256kb' }));
  app.use(createHealthRouter(() => repository.isReady()));
  app.use(createCatalogRouter(new CatalogApplication(repository, config.RESERVATION_TTL_MS)));
  app.use(problemDetailsHandler);
  return app;
}
