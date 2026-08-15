# ADR 005: Temporal-orchestrated checkout Saga

Status: Accepted · 2026-08-14

## Decision

Use an orchestration Saga with workflow ID `checkout-{orderId}` and task queue `checkout-v1`. The order event consumer starts the workflow; payment events signal it. Activities own I/O, retries, and idempotency. Workflow code remains deterministic and changes require Temporal patch/version markers plus replay tests.

## Consequences

Checkout state survives API and worker restarts and timers require no polling database job. Temporal becomes important infrastructure and workflow histories require careful compatibility management.
