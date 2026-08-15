# Runbook: AWS plan, deployment, rollback, and destruction

Read `docs/aws-costs.md` first. Bootstrap the state bucket once from `infra/terraform/bootstrap`, then copy the reported bucket into `environments/dev/backend.hcl`. Create/verify the SES identity and Temporal Cloud namespace. The first infrastructure apply needs an administrator because the GitHub OIDC role does not exist yet; subsequent deployment uses that role.

1. Copy `terraform.tfvars.example`, supply secrets through `TF_VAR_...`, and run `terraform init -backend-config=backend.hcl`.
2. Run `terraform fmt -check`, `terraform validate`, TFLint, and `terraform plan -out=plan.tfplan`.
3. Review RDS count, NAT, MSK, ECS desired counts, deletions, and secret changes. Do not approve an unexplained replacement.
4. Configure the GitHub `dev` environment, required reviewers, variables, secrets, and `AWS_DEPLOY_ROLE_ARN`.
5. Manually dispatch `Deploy dev`. It applies the reviewed plan, pushes SHA-tagged images, runs one-off migrations, rolls services, uploads the SPA, and invalidates CloudFront.

Rollback application code by selecting the prior known-good SHA task definition and updating the ECS service; do not reverse a database migration. CloudFront/S3 can be restored from the prior web artifact. A failed circuit breaker should roll a service back automatically.

To destroy, first preserve required audit/payment data, disable deletion protection only with explicit approval, run and review `terraform plan -destroy`, then apply it. Finally empty/delete the separate state bucket only if the entire study environment and its recovery history are intentionally retired.
