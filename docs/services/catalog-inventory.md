# Catalog and inventory service

Owns seeded product content, integer-BRL-centavo prices, stock balances, and expiring order reservations. Public reads are `GET /api/v1/products` and `GET /api/v1/products/{id}`. Protected commands reserve, commit, or release by deterministic order ID.

The reservation transaction locks inventory rows and rejects insufficient stock without partial reservation. Its response is canonical: product names, current unit prices, quantities, currency, and expiry become immutable order snapshots. Repeating a command returns the existing business result.

Data: `Product`, `InventoryItem`, `InventoryReservation`, `InventoryReservationItem`, and `OutboxEvent`. Produces `inventory.reserved.v1`, `inventory.committed.v1`, and `inventory.released.v1`. Run with `pnpm --filter @ecommerce/catalog-inventory-service dev`; test with the same filter and `test`.
