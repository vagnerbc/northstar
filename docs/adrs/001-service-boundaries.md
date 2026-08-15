# ADR 001: Initial service boundaries

Status: Accepted · 2026-08-14

## Decision

Use five domain services: catalog-inventory, cart, order, payment, and notification. Keep product and inventory together because this scope has one sales channel and no independent inventory planning. Keep the Temporal worker in the order bounded context but deploy it separately. Keycloak owns users, so no user service exists.

Shared packages contain technical behavior only. Domain types, Prisma clients, and business policies stay private to their service.

## Consequences

The system demonstrates ownership and distributed failure without manufacturing tiny services. Product/inventory can be split later only when independent scaling, teams, or business rules justify the operational cost.
