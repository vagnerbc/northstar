# Cart service

Owns one authenticated cart per Keycloak subject, item quantities, and a monotonic cart version. Public operations read the cart and add/update/delete items. The protected snapshot endpoint is available only to an internal token carrying `cart:read` and is not routed by Kong.

The service validates products through the catalog boundary. It consumes `order.confirmed.v1` with an inbox: only the checked-out snapshot quantities are removed, so quantities added after checkout remain. Data: `Cart`, `CartItem`, and `InboxEvent`.

Run or test with `pnpm --filter @ecommerce/cart-service <dev|test>`.
