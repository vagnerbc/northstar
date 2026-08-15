import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Generation does not connect to PostgreSQL, so a non-secret local fallback keeps CI deterministic.
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://catalog:catalog@localhost:5431/catalog',
  },
});
