# Testing strategy

The default `pnpm test` command runs fast unit tests across workspaces. Domain and application tests cover invariants, use-case decisions, idempotency behavior, compensation ordering, event envelopes, templates, request context, and frontend formatting/state helpers.

`RUN_INTEGRATION_TESTS=true pnpm test:integration` starts disposable PostgreSQL and Kafka containers through Testcontainers. Integration fixtures include signed Stripe webhook HMACs. These tests are serialized because they exercise real infrastructure.

`pnpm test:e2e` creates the isolated `ecommerce-e2e` Compose project, applies real migrations, uses real PostgreSQL/Kafka/Temporal/Mailpit, disables JWT validation only in that test project, and enables the fake payment adapter only with `NODE_ENV=test`. Playwright covers public browsing and a complete durable checkout. The runner removes its own volumes in `finally`, including after failure.

Coverage configuration targets domain, application, and shared technical code while excluding generated code and infrastructure adapters. It enforces 80 percent for domain/application code and 70 percent overall. The CI pipeline also checks formatting, ESLint, strict types, generation drift, production builds, Compose syntax, Terraform formatting/validation/TFLint, Trivy, and browser E2E.

Manual Stripe testing remains necessary because CI must not call a real payment provider. Follow the Stripe runbook and use test cards only.
