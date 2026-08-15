# Runbook: database migrations

Each service owns migrations under its own `prisma/migrations`. Local startup runs `prisma migrate deploy`; catalog seeding is idempotent.

Production changes follow expand/contract:

1. Expand with nullable columns, new tables/indexes, or dual-read support compatible with the current image.
2. Run the one-off ECS migration task and require exit code zero.
3. Deploy immutable SHA images and wait for circuit-breaker health.
4. Backfill in bounded, observable batches if required.
5. Remove old reads/writes in a later release, then contract in a still later migration.

Never run `migrate dev`, reset, or destructive seed commands against shared environments. Back up and test restore procedures before risky changes. Roll application images back only to versions compatible with the expanded schema.
