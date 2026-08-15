# ADR 007: OpenTelemetry and Grafana stack

Status: Accepted · 2026-08-14

## Decision

Initialize OpenTelemetry before application composition and export Node traces and metrics by OTLP. Keep Pino JSON logs on stdout, collect Docker logs with Alloy, and use Tempo, Prometheus, Loki, and Grafana locally. Propagate W3C trace context and `X-Correlation-ID`; do not enable browser OTel in v1.

## Consequences

Server-side requests can be followed across Kong, HTTP, Kafka, activities, and persistence without adopting an unstable JavaScript log signal. The response correlation reference remains useful when sampling breaks a complete trace.
