# Runbook: observability troubleshooting

Start `pnpm dev:full`. Generate one request and copy its `X-Correlation-ID` response header.

- Grafana Explore / Loki: `{service="order-service"} | json | correlationId="..."`.
- Grafana Explore / Tempo: search by trace ID from a matching Pino log.
- Prometheus: confirm `up`, then inspect service HTTP metrics, Kafka lag, and Kong request metrics.
- Dashboard: inspect outbox age/exhaustion, Kafka DLQ, checkout outcomes/manual review, inventory releases, and Stripe webhook failures before drilling into a trace.
- Collector: inspect `docker compose logs otel-collector`; refusal from services during lite mode is expected because the optional profile is absent.
- Alloy/Loki: ensure Docker socket access and check `alloy` and `loki` logs.

If one trace breaks at Kafka, confirm the event envelope contains `traceparent` and consumers create a linked/continued span. If correlation is absent at the edge, inspect Kong's correlation plugin and CORS exposed headers. Logs must stay structured JSON; multiline console logs are unsupported.
