# Runbook: Stripe test-mode checkout

1. Create a Stripe test-mode account and copy only test keys into `.env`.
2. Start `pnpm dev:lite`.
3. Run `pnpm dev:stripe`. Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`, then restart payment-service and stripe-cli.
4. Sign in as the demo buyer and reach the Payment Element. Use a Stripe test card such as `4242 4242 4242 4242`, any future expiry, and any CVC.
5. Confirm that Stripe emits `payment_intent.amount_capturable_updated`, then `payment_intent.succeeded` after capture. Follow the order in Temporal UI and the email in Mailpit.

If signature verification fails, confirm the CLI is forwarding to `/api/v1/payments/webhooks/stripe`, that no proxy mutated the body, and that the secret is from the current `listen` process. Do not use Dashboard endpoint secrets for a CLI endpoint. Never paste secrets into logs or issues.
