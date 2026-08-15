# Runbook: failed checkout compensation

`MANUAL_REVIEW` means a refund/cancel or inventory release exhausted retries. It does not mean compensation did not partially happen.

1. Find `checkout-{orderId}` in Temporal and inspect activity results without resetting history.
2. Verify Stripe directly by PaymentIntent ID: captured, canceled, refunded, or pending. Verify the inventory reservation directly through read-only database/operator tooling.
3. Select only the missing idempotent action. Refund before releasing inventory when money was captured.
4. Run the protected operator retry mechanism from a short-lived, audited service task. Never update order/payment rows manually.
5. Verify Stripe, inventory, order status, outbox, and notification state. Record provider IDs, correlation/trace IDs, operator, and timestamps.

If provider and local state disagree, provider state is authoritative for money. Keep the order in manual review until reconciliation is complete.
