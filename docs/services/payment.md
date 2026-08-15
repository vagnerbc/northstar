# Payment service

Owns the Stripe PaymentIntent mapping, client secret access, provider state, webhook receipts, refund state, and outbox. It creates card-only PaymentIntents with `capture_method=manual`. The session endpoint checks order ownership; internal create/capture/cancel/refund commands require scoped service authentication and idempotency keys.

The Stripe webhook route receives the unmodified byte buffer, requires `Stripe-Signature`, verifies it before parsing, and persists the Stripe event ID for deduplication. Provider webhooks—not synchronous API responses—produce authoritative authorized/captured/failed events.

The fake adapter and authorize route throw during configuration unless `NODE_ENV=test`. Run/test with the payment package filter. Never log client secrets, card data, signatures, or raw webhook bodies.
