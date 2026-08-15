# Threat model and data-handling rules

## Assets and trust boundaries

Primary assets are buyer identity, access/service tokens, address/email PII, Stripe secrets and provider identifiers, order/payment integrity, inventory availability, and audit/trace data. Trust boundaries exist at the browser, CloudFront/Kong, Keycloak, every service HTTP boundary, Kafka, Temporal activities, PostgreSQL, Stripe webhooks, email providers, and CI/AWS federation.

## Important threats and controls

| Threat                            | Controls                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Account/token theft               | Authorization Code + PKCE, short-lived JWTs, issuer/signature/audience checks, TLS in AWS, no browser token logging                |
| IDOR across buyers                | Order/payment/cart services compare token subject to resource owner and return non-enumerating 404s                                |
| Gateway bypass                    | Private ECS tasks, internal endpoints absent from Kong, services enforce authorization independently                               |
| Forged/replayed Stripe webhook    | Raw-body HMAC verification, configured endpoint secret, persisted Stripe event ID, bounded public rate limit                       |
| Duplicate commands/events         | Required idempotency keys, deterministic workflow/order IDs, unique database constraints, inbox and webhook receipts               |
| Overselling/race                  | Transactional row updates/locks, reservation expiry, commit/release state machine                                                  |
| Payment captured but order failed | Temporal compensation refunds before release; exhausted compensation is manual review and alertable                                |
| Poison event blocks partition     | Bounded retry and DLQ policy; schema validation before effects; documented replay                                                  |
| Secret/PII leakage                | Secrets Manager/env injection, Pino redaction, no raw Stripe/address/token logs, private databases, encrypted AWS storage          |
| Supply-chain/CI compromise        | Exact dependencies/lockfile, immutable image tags, scans, GitHub OIDC, protected environment approval, least-privilege deploy role |

## Data classification

- Restricted: Stripe/API secrets, Keycloak client secrets, Temporal API key, passwords, access/refresh tokens. Never log or commit; rotate on suspected exposure.
- Confidential: address, email, Keycloak subject, full Stripe webhook payload. Store only in the owning database; redact logs and support exports.
- Internal: order/payment/provider IDs, trace and correlation IDs. Useful operationally but do not expose across owners.
- Public: product name, description, price, image, and availability shown by the catalog API.

This project does not handle raw card numbers; Stripe Elements sends them directly to Stripe. It is still not a PCI compliance attestation. Production requires TLS/custom domains, WAF/DDOS review, Keycloak hardening/MFA policy, backup/restore exercises, secret rotation, vulnerability response, audit retention, privacy/legal review, and penetration testing.
