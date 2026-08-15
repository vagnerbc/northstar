# ADR 008: AWS reference platform

Status: Accepted · 2026-08-14

## Decision

Use CloudFront with private S3 for the SPA, an origin-protected ALB for dynamic traffic, private ECS Fargate with Service Connect, six encrypted RDS instances, MSK Serverless IAM, ECR, Secrets Manager, SES, and GitHub OIDC. Treat Temporal Cloud as external. Keep baseline ECS CloudWatch logs and expose OTLP settings for a later managed observability decision.

## Consequences

The design resembles a separated production environment and is expensive when left running. Terraform never runs automatically; deployment requires manual workflow dispatch and protected-environment approval.
