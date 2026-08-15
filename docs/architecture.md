# Architecture

## Context

```mermaid
C4Context
  title Northstar system context
  Person(buyer, "Buyer", "Browses products and completes card checkout")
  System(northstar, "Northstar", "Event-driven e-commerce study system")
  System_Ext(stripe, "Stripe", "Authorizes, captures and refunds card payments")
  System_Ext(email, "Mailpit / Amazon SES", "Delivers transactional email")
  System_Ext(temporal, "Temporal", "Durable checkout execution")
  Rel(buyer, northstar, "Uses", "HTTPS")
  Rel(northstar, stripe, "Creates PaymentIntents and receives signed webhooks", "HTTPS")
  Rel(northstar, email, "Sends order notifications", "SMTP / HTTPS")
  Rel(northstar, temporal, "Runs checkout workflows", "gRPC")
```

## Containers

```mermaid
C4Container
  title Northstar containers
  Person(buyer, "Buyer")
  Container(web, "Web", "React, Vite, Chakra", "Buyer UI; Keycloak Authorization Code + PKCE")
  Container(gateway, "Kong", "Kong OSS DB-less", "Public routing, correlation, limits and edge telemetry")
  Container(keycloak, "Keycloak", "OIDC", "Identity, buyer role and service credentials")
  Container(catalog, "Catalog + Inventory", "Express, Prisma", "Products, stock and reservations")
  Container(cart, "Cart", "Express, Prisma", "Authenticated mutable carts")
  Container(order, "Order API", "Express, Prisma", "Checkout request and owned order views")
  Container(worker, "Checkout worker", "Temporal TypeScript SDK", "Saga orchestration and compensation")
  Container(payment, "Payment", "Express, Prisma, Stripe", "Payment state and webhooks")
  Container(notification, "Notification", "Kafka consumer", "Idempotent email delivery")
  Container(kafka, "Kafka", "KRaft / MSK Serverless", "At-least-once domain event transport")
  Rel(buyer, web, "Uses")
  Rel(web, keycloak, "Authenticates", "OIDC/PKCE")
  Rel(web, gateway, "Calls", "JSON/HTTPS")
  Rel(gateway, catalog, "Routes public reads")
  Rel(gateway, cart, "Routes owned cart calls")
  Rel(gateway, order, "Routes owned order calls")
  Rel(gateway, payment, "Routes session and webhook calls")
  Rel(order, kafka, "Publishes checkout request", "Outbox")
  Rel(kafka, worker, "Starts/signals workflow")
  Rel(worker, cart, "Reads cart snapshot", "Protected HTTP")
  Rel(worker, catalog, "Reserves/commits/releases", "Protected HTTP")
  Rel(worker, payment, "Creates/captures/cancels/refunds", "Protected HTTP")
  Rel(payment, kafka, "Publishes authoritative state", "Outbox")
  Rel(kafka, notification, "Delivers terminal order events")
```

Every domain service has its own PostgreSQL instance, Prisma schema, migrations, connection credentials, outbox where it produces events, and inbox where it consumes them. Keycloak has a sixth PostgreSQL instance. Cross-database queries are forbidden.

## Checkout sequence

```mermaid
sequenceDiagram
  autonumber
  actor Buyer
  participant Web
  participant Kong
  participant Order
  participant Kafka
  participant Worker as Temporal worker
  participant Cart
  participant Inventory
  participant Payment
  participant Stripe
  participant Notify

  Buyer->>Web: Submit shipping address
  Web->>Kong: POST /orders/checkout + Idempotency-Key
  Kong->>Order: Authenticated request + correlation/trace context
  Order->>Cart: Protected cart snapshot
  Order->>Order: Commit order + checkout.requested outbox
  Order-->>Web: 202 orderId + statusUrl
  Order->>Kafka: checkout.requested.v1
  Kafka->>Worker: Start checkout-{orderId}
  Worker->>Inventory: Reserve snapshot (idempotent)
  Inventory-->>Worker: Names, prices, expiry
  Worker->>Payment: Create manual-capture PaymentIntent
  Payment->>Stripe: capture_method=manual
  Worker->>Order: AWAITING_PAYMENT
  Web->>Payment: GET owned payment session
  Buyer->>Stripe: Confirm Payment Element
  Stripe->>Payment: Signed amount_capturable_updated webhook
  Payment->>Kafka: payment.authorized.v1
  Kafka->>Worker: Signal authorization
  Worker->>Payment: Capture (idempotent)
  Stripe->>Payment: Signed succeeded webhook
  Payment->>Kafka: payment.captured.v1
  Kafka->>Worker: Signal capture
  Worker->>Inventory: Commit reservation
  Worker->>Order: Confirm + order.confirmed outbox
  Kafka->>Cart: Remove snapshot quantities only
  Kafka->>Notify: Send confirmation email
  Web->>Order: Poll every 2 seconds until terminal
```

Signals may arrive before the workflow starts waiting; Temporal retains them in workflow history. Workflow code performs no I/O, time reads, randomness, or non-deterministic library calls. Activities own all I/O and have bounded exponential retries plus idempotency keys.

## Failure model

Before capture, compensation cancels any PaymentIntent and releases stock. After capture, it refunds first and then releases stock. A failure of either exhausted compensation moves the order to `MANUAL_REVIEW` and retains identifiers for an operator. Business failures are non-retryable; transient network/provider failures are retryable. Kafka consumers deduplicate by `eventId`, and webhook receipts deduplicate by Stripe event ID.
