# ADR 006: Keycloak identity and Kong gateway

Status: Accepted · 2026-08-14

## Decision

Use Keycloak Authorization Code with PKCE for the public React client and client credentials with explicit scopes/audiences for order activities. Kong handles public routing, CORS, limits, correlation IDs, Prometheus, and gateway traces. Each service validates JWT signature, issuer, audience, scope, and resource ownership.

## Consequences

Compromising or misconfiguring the gateway does not silently bypass service authorization. Kong Admin and internal command endpoints are never publicly routed.
