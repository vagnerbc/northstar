locals {
  tags           = { Project = "ecommerce-study", Environment = "dev", ManagedBy = "Terraform", CostCenter = "study" }
  database_names = toset(["catalog", "cart", "orders", "payment", "notification", "keycloak"])
  common_environment = {
    NODE_ENV           = "production"
    AWS_REGION         = var.aws_region
    KAFKA_AUTH_MODE    = "aws-iam"
    KAFKA_BROKERS      = module.messaging.bootstrap_brokers_sasl_iam
    KEYCLOAK_ISSUER    = "${var.public_base_url}/auth/realms/ecommerce"
    TEMPORAL_ADDRESS   = var.temporal_address
    TEMPORAL_NAMESPACE = var.temporal_namespace
    LOG_LEVEL          = "info"
  }
  database_secret = { for name, arn in module.data.secret_arns : name => "${arn}:url::" }
}

resource "random_password" "origin" {
  length  = 40
  special = false
}
resource "random_password" "order_service_client" {
  length  = 40
  special = false
}
resource "aws_secretsmanager_secret" "application" {
  for_each                = toset(["stripe-secret-key", "stripe-webhook-secret", "temporal-api-key", "keycloak-admin-password", "order-service-client-secret"])
  name                    = "${var.project_name}/${each.key}"
  recovery_window_in_days = 7
}
resource "aws_secretsmanager_secret_version" "application" {
  for_each  = aws_secretsmanager_secret.application
  secret_id = each.value.id
  secret_string = {
    stripe-secret-key           = var.stripe_secret_key
    stripe-webhook-secret       = var.stripe_webhook_secret
    temporal-api-key            = var.temporal_api_key
    keycloak-admin-password     = var.keycloak_admin_password
    order-service-client-secret = random_password.order_service_client.result
  }[each.key]
}

module "network" {
  source             = "../../modules/network"
  name               = var.project_name
  cidr               = "10.40.0.0/16"
  az_count           = 2
  single_nat_gateway = true
  tags               = local.tags
}
module "data" {
  source         = "../../modules/data"
  name           = var.project_name
  vpc_id         = module.network.vpc_id
  vpc_cidr       = module.network.vpc_cidr
  subnet_ids     = module.network.private_subnet_ids
  database_names = local.database_names
  tags           = local.tags
}
module "messaging" {
  source     = "../../modules/messaging"
  name       = var.project_name
  vpc_id     = module.network.vpc_id
  vpc_cidr   = module.network.vpc_cidr
  subnet_ids = module.network.private_subnet_ids
  tags       = local.tags
}

module "compute" {
  source               = "../../modules/compute"
  name                 = var.project_name
  aws_region           = var.aws_region
  vpc_id               = module.network.vpc_id
  public_subnet_ids    = module.network.public_subnet_ids
  private_subnet_ids   = module.network.private_subnet_ids
  msk_cluster_arn      = module.messaging.cluster_arn
  image_tag            = var.image_tag
  origin_verify_secret = random_password.origin.result
  tags                 = local.tags
  services = {
    catalog-inventory = {
      port        = 3001
      command     = ["node", "services/catalog-inventory/dist/main.js"]
      environment = merge(local.common_environment, { SERVICE_NAME = "catalog-inventory-service", PORT = "3001" })
      secrets     = { DATABASE_URL = local.database_secret.catalog }
    }
    cart = {
      port        = 3002
      command     = ["node", "services/cart/dist/main.js"]
      environment = merge(local.common_environment, { SERVICE_NAME = "cart-service", PORT = "3002", CATALOG_BASE_URL = "http://catalog-inventory:3001", USER_AUTH_AUDIENCE = "web-app", INTERNAL_AUTH_AUDIENCE = "cart-service" })
      secrets     = { DATABASE_URL = local.database_secret.cart }
    }
    order = {
      port        = 3003
      command     = ["node", "services/order/dist/main.js"]
      environment = merge(local.common_environment, { SERVICE_NAME = "order-service", PORT = "3003", CART_BASE_URL = "http://cart:3002", INVENTORY_BASE_URL = "http://catalog-inventory:3001", PAYMENT_BASE_URL = "http://payment:3004" })
      secrets = {
        DATABASE_URL          = local.database_secret.orders
        TEMPORAL_API_KEY      = "${aws_secretsmanager_secret.application["temporal-api-key"].arn}:::"
        SERVICE_CLIENT_SECRET = "${aws_secretsmanager_secret.application["order-service-client-secret"].arn}:::"
      }
    }
    checkout-worker = {
      port        = 3006
      command     = ["node", "services/order/dist/worker.js"]
      cpu         = 512
      memory      = 1024
      environment = merge(local.common_environment, { SERVICE_NAME = "order-service", WORKER_PORT = "3006", CART_BASE_URL = "http://cart:3002", INVENTORY_BASE_URL = "http://catalog-inventory:3001", PAYMENT_BASE_URL = "http://payment:3004" })
      secrets = {
        DATABASE_URL          = local.database_secret.orders
        TEMPORAL_API_KEY      = "${aws_secretsmanager_secret.application["temporal-api-key"].arn}:::"
        SERVICE_CLIENT_SECRET = "${aws_secretsmanager_secret.application["order-service-client-secret"].arn}:::"
      }
    }
    payment = {
      port        = 3004
      command     = ["node", "services/payment/dist/main.js"]
      environment = merge(local.common_environment, { SERVICE_NAME = "payment-service", PORT = "3004", PAYMENT_PROVIDER = "stripe", USER_AUTH_AUDIENCE = "web-app", INTERNAL_AUTH_AUDIENCE = "payment-service" })
      secrets     = { DATABASE_URL = local.database_secret.payment, STRIPE_SECRET_KEY = "${aws_secretsmanager_secret.application["stripe-secret-key"].arn}:::", STRIPE_WEBHOOK_SECRET = "${aws_secretsmanager_secret.application["stripe-webhook-secret"].arn}:::" }
    }
    notification = {
      port        = 3005
      command     = ["node", "services/notification/dist/main.js"]
      environment = merge(local.common_environment, { SERVICE_NAME = "notification-service", PORT = "3005", EMAIL_PROVIDER = "ses", EMAIL_FROM = var.ses_identity })
      secrets     = { DATABASE_URL = local.database_secret.notification }
    }
    kong = {
      port        = 8000
      health_path = "/api/v1/products?limit=1"
      cpu         = 512
      memory      = 1024
      environment = { KONG_DATABASE = "off", KONG_DECLARATIVE_CONFIG = "/kong/declarative/kong.yml", KONG_PROXY_LISTEN = "0.0.0.0:8000", KONG_ADMIN_LISTEN = "127.0.0.1:8001" }
    }
    keycloak = {
      port        = 8080
      health_path = "/auth/realms/ecommerce"
      cpu         = 1024
      memory      = 2048
      command     = ["start", "--import-realm", "--http-enabled=true", "--proxy-headers=xforwarded", "--hostname=${var.public_base_url}", "--http-relative-path=/auth"]
      environment = { KC_DB = "postgres", KC_DB_URL_HOST = module.data.endpoints.keycloak, KC_DB_URL_DATABASE = "keycloak", KC_DB_USERNAME = "keycloak", KC_HEALTH_ENABLED = "true", KC_METRICS_ENABLED = "true" }
      secrets = {
        KC_DB_PASSWORD              = "${module.data.secret_arns.keycloak}:password::"
        KC_BOOTSTRAP_ADMIN_PASSWORD = "${aws_secretsmanager_secret.application["keycloak-admin-password"].arn}:::"
        ORDER_SERVICE_CLIENT_SECRET = "${aws_secretsmanager_secret.application["order-service-client-secret"].arn}:::"
      }
    }
  }
}

module "edge" {
  source               = "../../modules/edge"
  name                 = var.project_name
  alb_dns_name         = module.compute.alb_dns_name
  origin_verify_secret = random_password.origin.result
  tags                 = local.tags
}
resource "aws_sesv2_email_identity" "orders" { email_identity = var.ses_identity }

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}
data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:environment:dev"]
    }
  }
}
resource "aws_iam_role" "github_deploy" {
  name               = "${var.project_name}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
  tags               = local.tags
}
resource "aws_iam_role_policy" "github_deploy" {
  role = aws_iam_role.github_deploy.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
    { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage", "ecr:PutImage", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload"], Resource = "arn:aws:ecr:${var.aws_region}:*:repository/${var.project_name}/*" },
    { Effect = "Allow", Action = ["ecs:DescribeServices", "ecs:UpdateService", "ecs:RunTask", "ecs:DescribeTasks"], Resource = "*" },
    { Effect = "Allow", Action = ["iam:PassRole"], Resource = [module.compute.task_role_arn, module.compute.execution_role_arn] },
    { Effect = "Allow", Action = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"], Resource = [module.edge.bucket_arn, "${module.edge.bucket_arn}/*"] },
    { Effect = "Allow", Action = ["cloudfront:CreateInvalidation"], Resource = "*" }
  ] })
}
