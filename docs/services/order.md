# Order service and checkout worker

The API owns checkout idempotency, owned order views, order/item/address snapshots, terminal failure reason, inbox, and outbox. `POST /api/v1/orders/checkout` accepts only an address and requires `Idempotency-Key`; it reads the caller's cart itself and returns `202` with a status URL.

The separately deployed worker starts `checkout-{orderId}` from `checkout.requested.v1`, receives authoritative payment signals, and calls idempotent protected activities. Workflow state progresses through requested, reserved, awaiting payment, authorized, captured, confirmed, compensating, failed, or manual review. Test timers are configurable; production defaults preserve a 15-minute window.

Data: `Order`, immutable `OrderItem`, `InboxEvent`, and `OutboxEvent`. Produces self-contained `order.confirmed.v1` and `order.checkout_failed.v1`. Run API with `dev` and worker with `dev:worker` under the order package.
