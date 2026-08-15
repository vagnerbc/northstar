# ADR 003: Hybrid HTTP commands and Kafka events

Status: Accepted · 2026-08-14

## Decision

Use protected HTTP for workflow commands that need an immediate business result, such as inventory reservation. Use Kafka for state facts and asynchronous reactions. Partition checkout events by order ID and provide at-least-once delivery.

## Consequences

Temporal receives explicit activity results while notification, cart cleanup, and workflow signals remain decoupled. Consumers must persist inbox deduplication and tolerate duplicates and reordering across topics.
