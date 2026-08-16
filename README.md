# Northstar Event-Driven E-commerce

Northstar is a deliberately small buyer storefront backed by production-shaped, event-driven microservices. It is a study system: the product, cart, checkout, order-history, payment, and email flows are real, while tax, shipping, administration, returns, and multi-currency are intentionally excluded.

The codebase uses strict TypeScript, Clean Architecture, physical database ownership, transactional outbox/inbox patterns, Kafka at-least-once delivery, and a Temporal checkout Saga. No AWS resource is created by this repository unless a person explicitly runs the protected deployment workflow or Terraform.

## Quick start

Prerequisites:

- Docker Desktop with Compose 2 and at least 12 GB RAM assigned (16 GB is comfortable for the full stack).
- Node.js `24.x` and Corepack. The repository pins pnpm `11.19.0`.
- Stripe test keys only when exercising the real card flow.

```powershell
Copy-Item .env.example .env
corepack enable
pnpm install --frozen-lockfile
pnpm dev:lite
```

The first image build downloads the Node workspace dependencies and can take several minutes. Compose applies every Prisma migration and seeds the catalog automatically. Wait until the service health checks become healthy, then open the storefront.

Compose Watch synchronizes application source files for hot reload. After changing a package manifest, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, or `Dockerfile`, stop the stack and run `pnpm dev:lite` again so the shared development image is rebuilt for every service.

| Resource                                               | URL / endpoint        | Credentials                       |
| ------------------------------------------------------ | --------------------- | --------------------------------- |
| Storefront                                             | http://localhost:5173 | `buyer` / `buyer123`              |
| Kong public API                                        | http://localhost:8000 | Bearer token where required       |
| Keycloak                                               | http://localhost:8080 | user above; admin / `local-admin` |
| Temporal UI                                            | http://localhost:8233 | none                              |
| Mailpit                                                | http://localhost:8025 | none                              |
| Kafka host listener                                    | `localhost:29092`     | plaintext, local only             |
| Catalog, cart, order, payment, notification PostgreSQL | ports `5441`–`5445`   | see `compose.yaml`                |
| Keycloak PostgreSQL                                    | port `5446`           | see `compose.yaml`                |

Useful commands:

```bash
pnpm dev:full       # adds Grafana, Prometheus, Tempo, Loki, Alloy and Kafka UI
pnpm dev:stripe     # forwards signed Stripe webhooks after test keys are configured
pnpm down
pnpm generate       # OpenAPI, AsyncAPI, Prisma clients and Orval client
pnpm check          # format, lint, typecheck, unit tests and builds
pnpm exec playwright install chromium # one-time browser installation for local E2E
pnpm test:e2e       # isolated Compose stack with the test-only fake payment adapter
```

Full-stack tools are available at Grafana `http://localhost:3000` (`admin` / `admin`), Prometheus `http://localhost:9090`, Tempo `http://localhost:3200`, Loki `http://localhost:3100`, and Kafka UI `http://localhost:8088`.

## Stripe test mode

Put test-mode `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `VITE_STRIPE_PUBLISHABLE_KEY` in `.env`. Start the normal stack, run `pnpm dev:stripe`, and replace the webhook secret with the `whsec_...` value printed by Stripe CLI. Never use live keys locally. CI and `pnpm test:e2e` use a deterministic adapter that is rejected unless `NODE_ENV=test`.

## System shape

- `catalog-inventory-service` owns products, stock, and expiring reservations.
- `cart-service` owns authenticated carts and consumes confirmed-order events.
- `order-service` owns orders, checkout idempotency, immutable snapshots, and the outbox.
- `checkout-worker` runs the Temporal Saga and is independently deployable.
- `payment-service` owns Stripe identifiers, signed webhook receipts, capture, cancellation, and refunds.
- `notification-service` consumes self-contained terminal order events and sends Mailpit/SES email.
- Keycloak owns identity; there is no user database or user service.
- Kong is the only public backend entry point. Services still verify issuer, signature, audience, scopes, owner, and input.

There is no standalone service registry. Docker DNS is authoritative locally; ECS Service Connect/Cloud Map supplies stable internal names in AWS. This avoids another control plane without losing discoverability.

See [architecture](docs/architecture.md), [testing](docs/testing.md), [security](docs/security/threat-model.md), [costs](docs/aws-costs.md), [ADRs](docs/adrs), [runbooks](docs/runbooks), and [implementation status](docs/implementation-status.md). Generated contracts live at [OpenAPI](docs/api/openapi.json) and [AsyncAPI](docs/api/asyncapi.json).

## Repository map

```text
apps/web                         React/Vite buyer application
services/*                       Five domain services and the checkout worker
packages/*                       Technical-only shared packages
infra/{kong,keycloak,observability} Local platform configuration
infra/terraform                  AWS bootstrap, modules, and dev composition
tests/{integration,e2e}          Disposable infrastructure and buyer journeys
docs                             Architecture, decisions, operations, and status
```

Domain entities and Prisma types are never shared. Each service maps persistence records into its own domain types at its adapter boundary. Explanatory comments are intentionally concentrated around invariants, idempotency, determinism, payment security, and compensation.

## Data and destructive cleanup

`pnpm down` stops containers and preserves named volumes. To intentionally remove all local study data, run `docker compose --profile observability --profile tools down --volumes` after confirming the Compose project is `ecommerce-study`. The E2E runner uses the fixed, separate project name `ecommerce-e2e` and removes only its own volumes.

## Production reference

Terraform models a costly, realistic AWS dev environment: two-AZ networking, private Fargate services, Service Connect, six RDS instances, MSK Serverless IAM, private S3/CloudFront, an origin-protected ALB, ECR, Secrets Manager, SES, and GitHub OIDC. Temporal Cloud remains external. Read the [AWS runbook](docs/runbooks/aws-deployment.md) and [cost warning](docs/aws-costs.md) before planning it.
