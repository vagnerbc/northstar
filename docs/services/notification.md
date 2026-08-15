# Notification service

Consumes self-contained terminal order events and sends confirmation or checkout-failure email. Templates need no synchronous lookup, which prevents another service outage from blocking notification processing. A unique event ID makes delivery idempotent, while every attempt and last error is persisted.

Local delivery uses SMTP to Mailpit. AWS delivery uses SES v2 with the ECS task role. Data: `Notification` delivery attempts and template metadata; the service emits no domain event in v1. Its only HTTP surface is private liveness/readiness.

Run/test with `pnpm --filter @ecommerce/notification-service <dev|test>`.
