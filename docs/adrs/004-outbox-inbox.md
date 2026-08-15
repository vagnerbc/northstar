# ADR 004: Transactional outbox and inbox

Status: Accepted · 2026-08-14

## Decision

Persist state changes and outgoing event envelopes in one PostgreSQL transaction. A relay locks unpublished rows with `SKIP LOCKED`, publishes them, and records success or bounded failure metadata. Consumers record event IDs in an inbox before acknowledging effects.

## Consequences

Database and Kafka cannot diverge at the write boundary, but delivery is deliberately at least once. Idempotency is a business requirement, not a broker feature. Oldest unpublished age, retry count, and DLQ traffic are operational signals.
