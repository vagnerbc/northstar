# Implementation status

Last updated: 2026-08-15

## Completed

- pnpm/Turborepo monorepo with strict TypeScript and technical-only shared packages.
- Five Clean Architecture domain services plus independently runnable order API and Temporal worker.
- Prisma 7 schemas/migrations, six physically separate local PostgreSQL containers, catalog seed, explicit persistence mapping.
- Public/owned APIs, Keycloak PKCE/service credentials, audience/scope checks, Kong DB-less routes and plugins.
- Versioned Zod event registry, generated OpenAPI/AsyncAPI, Orval client, correlation IDs, RFC Problem Details, outbox/inbox, bounded Kafka consumer retries, and DLQ forwarding.
- Inventory reservation and Stripe manual-capture Saga, pre/post-capture compensation, timers, deterministic workflow ID and manual-review state.
- Stripe signed webhook receipts, test-only fake provider, SMTP/SES notification adapters, quantity-aware cart cleanup.
- Responsive React/Chakra buyer UI with TanStack Query, Stripe Elements, polling, error references, unit and Playwright tests.
- Strict Mode-safe Keycloak initialization prevents duplicate check-sso redirects during development and strips stale authentication fragments from login and registration return URLs.
- Docker-first lite/full/E2E configurations, KRaft Kafka, Temporal dev server, Mailpit, Grafana/Prometheus/Tempo/Loki/Alloy, exporters and starter dashboard/alerts.
- Idempotent local Kafka topic initialization, non-root Temporal SQLite persistence, cross-platform Compose Watch hot reload, shared Docker build caching, and automatic E2E failure diagnostics.
- GitHub PR CI, protected OIDC deployment workflow, Terraform bootstrap/modules/dev composition, runbooks, ADRs, threat model, and cost warning.
- Local generated artifacts, formatting, lint, strict type-check, unit tests, coverage thresholds, and production builds pass.

## Verification on 2026-08-15

- `pnpm check` passed formatting, ESLint, strict type-check, all workspace unit tests, and all production builds.
- The risk-focused suite passed 50 tests and reached 96% statements, 92.85% branches, 94% functions, and 96.25% lines.
- Testcontainers started disposable PostgreSQL and Kafka instances; both infrastructure and Stripe-signing integration tests passed.
- The isolated Docker stack passed every health check and both Chromium scenarios passed: seeded catalog browsing and the complete durable fake-payment checkout through Kong, Kafka, Temporal, inventory, orders, and payment.
- The exact `pnpm dev:lite` workflow reached Compose Watch mode and every service became healthy on Docker Desktop. Browser verification covered the storefront, seeded catalog, product detail, and the protected add-to-cart redirect to the Keycloak login page; a regression test verifies one-time Keycloak initialization under React Strict Mode.
- Lite, full-observability, and isolated-E2E Compose configurations passed `docker compose config`; E2E cleanup left no temporary containers.
- Terraform 1.13.4 formatted and validated both the state bootstrap and the `dev` composition with AWS provider 6.60.0.

## Deliberate limitations and next hardening work

- The local dashboard and alerts cover HTTP RED, Kafka lag/DLQ, outbox age/exhaustion, checkout outcomes/manual review, inventory release, Stripe webhooks, PostgreSQL, Keycloak, and Kong. Extend them with Temporal server internals and per-database saturation after validating exporter labels against a long-running full stack.
- Kafka instrumentation preserves correlation/trace causality, creates explicit producer/consumer spans and metrics, retries handlers with bounded exponential backoff, and forwards poison messages to domain DLQ topics. Validate exporter labels and retry tuning under load before production use.
- Temporal unit coverage includes compensation policy; add the full official time-skipping/replay matrix (duplicate early signals, timeout, worker restart, capture/refund failure) before treating this as production-ready.
- The integration suite proves disposable infrastructure and fixture signing. Add repository-level migration/HTTP tests for every service and backward-compatibility fixture history as contracts evolve.
- The example AWS stack has not been applied by this implementation. Validate quotas, current image availability, Keycloak realm bootstrap behavior, MSK IAM policies, DNS/TLS/custom domains, backups, WAF, and costs in an owned sandbox account.
- The DLQ replay runbook uses Kafka CLI operations; an audited replay application and operator compensation retry UI remain production hardening work.
- Browser bundle code-splitting can reduce the initial Chakra/Stripe JavaScript chunk.

## Context for future sessions

Business scope is buyer-only BRL commerce: seeded products, authenticated cart, shipping-address checkout, manual-capture card payment, success/failure email, and owned order history. Product and inventory stay together, identity stays in Keycloak, and orchestration stays in order. Do not introduce a service registry, Schema Registry, Kubernetes, admin UI, guest cart, tax, freight, coupons, fulfillment, returns, or multi-currency without a new decision record.

Use additive event fields within v1; breaking event changes require a new event version. Use expand/contract database migrations. Preserve existing workflow determinism with Temporal patch/version rules. Never weaken service authorization because Kong already checked a request.
