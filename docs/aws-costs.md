# AWS cost warning

The Terraform dev composition is intentionally realistic and can be expensive even with no buyers. It creates six RDS PostgreSQL instances, MSK Serverless, at least eight Fargate services, an ALB, CloudFront, NAT gateway data paths, CloudWatch logs, ECR storage, Secrets Manager secrets, and SES usage. Temporal Cloud is billed separately.

Cost varies by region and changes over time; use the AWS Pricing Calculator and current provider prices before every deployment. The largest baseline risks are the six always-on RDS instances, NAT hourly/data processing, Fargate desired counts, and MSK Serverless capacity. A continuously running study environment can cost hundreds of US dollars per month.

Controls in the reference:

- One NAT gateway by default reduces cost but sacrifices AZ-independent egress.
- Small single-AZ RDS instances, short log retention, CloudFront PriceClass 100, and low ECS desired counts.
- Cost-allocation tags on resources and an explicit `CostCenter=study` tag.
- Manual protected deployment only; no scheduled or automatic apply.

Recommended study practice: plan first, create a budget and alerts outside this stack, deploy for a bounded exercise, verify charges after several hours, export anything needed, and destroy through a reviewed plan. Never assume `terraform destroy` removed the remote state bucket or external Temporal resources.
