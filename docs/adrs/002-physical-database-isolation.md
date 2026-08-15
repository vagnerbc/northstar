# ADR 002: Physical database isolation

Status: Accepted · 2026-08-14

## Decision

Give every domain service and Keycloak an independent PostgreSQL server locally and an independent RDS instance in the AWS reference. A service receives only its own credential and never imports another service's Prisma client.

## Consequences

Cross-domain changes require explicit HTTP commands or events, making consistency and failure visible. Local and AWS resource cost is higher; the trade is intentional for the study objective.
