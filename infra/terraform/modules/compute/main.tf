locals {
  public_services     = toset(["kong", "keycloak"])
  repository_services = { for name, service in var.services : name => service if service.create_repository }
}

resource "aws_ecs_cluster" "this" {
  name = var.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = var.tags
}
resource "aws_service_discovery_http_namespace" "this" {
  name = "${var.name}.internal"
  tags = var.tags
}
resource "aws_ecr_repository" "service" {
  for_each             = local.repository_services
  name                 = "${var.name}/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
  tags = var.tags
}
resource "aws_ecr_lifecycle_policy" "service" {
  for_each   = aws_ecr_repository.service
  repository = each.value.name
  policy     = jsonencode({ rules = [{ rulePriority = 1, description = "Keep 20 images", selection = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }, action = { type = "expire" } }] })
}

resource "aws_iam_role" "execution" {
  name               = "${var.name}-ecs-execution"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
  tags               = var.tags
}
resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
resource "aws_iam_role_policy" "execution_secrets" {
  role   = aws_iam_role.execution.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "kms:Decrypt"], Resource = "*" }] })
}
resource "aws_iam_role" "task" {
  name               = "${var.name}-ecs-task"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
  tags               = var.tags
}
resource "aws_iam_role_policy" "task" {
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["kafka-cluster:Connect", "kafka-cluster:DescribeCluster", "kafka-cluster:ReadData", "kafka-cluster:WriteData", "kafka-cluster:DescribeTopic", "kafka-cluster:CreateTopic", "kafka-cluster:AlterGroup", "kafka-cluster:DescribeGroup"], Resource = [var.msk_cluster_arn, "${replace(var.msk_cluster_arn, ":cluster/", ":topic/")}/*", "${replace(var.msk_cluster_arn, ":cluster/", ":group/")}/*"] },
      { Effect = "Allow", Action = ["ses:SendEmail", "ses:SendRawEmail"], Resource = "*" }
    ]
  })
}

resource "aws_cloudwatch_log_group" "service" {
  for_each          = var.services
  name              = "/ecs/${var.name}/${each.key}"
  retention_in_days = 14
  tags              = var.tags
}
resource "aws_ecs_task_definition" "service" {
  for_each                 = var.services
  family                   = "${var.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([{
    name                   = each.key
    image                  = each.value.image != "" ? each.value.image : "${aws_ecr_repository.service[each.key].repository_url}:${var.image_tag}"
    essential              = true
    command                = length(each.value.command) > 0 ? each.value.command : null
    portMappings           = each.value.port == null ? [] : [{ name = "http", containerPort = each.value.port, hostPort = each.value.port, protocol = "tcp", appProtocol = "http" }]
    environment            = [for key, value in each.value.environment : { name = key, value = value }]
    secrets                = [for key, value in each.value.secrets : { name = key, valueFrom = value }]
    readonlyRootFilesystem = false
    user                   = each.key == "kong" || each.key == "keycloak" ? null : "1000"
    logConfiguration       = { logDriver = "awslogs", options = { "awslogs-group" = aws_cloudwatch_log_group.service[each.key].name, "awslogs-region" = var.aws_region, "awslogs-stream-prefix" = each.key } }
    healthCheck            = each.value.port == null ? null : { command = ["CMD-SHELL", "node -e \"fetch('http://localhost:${each.value.port}${each.value.health_path}').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))\" || exit 1"], interval = 30, timeout = 5, retries = 3, startPeriod = 60 }
  }])
  tags = var.tags
}

resource "aws_security_group" "alb" {
  name_prefix = "${var.name}-alb-"
  vpc_id      = var.vpc_id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "CloudFront origin traffic protected by secret header"
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = var.tags
}
resource "aws_security_group" "service" {
  name_prefix = "${var.name}-ecs-"
  vpc_id      = var.vpc_id
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    self        = true
    description = "ECS Service Connect"
  }
  ingress {
    from_port       = 3000
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "ALB to Kong and Keycloak"
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = var.tags
}
resource "aws_lb" "this" {
  name                       = substr(var.name, 0, 32)
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = var.public_subnet_ids
  enable_deletion_protection = false
  drop_invalid_header_fields = true
  tags                       = var.tags
}
resource "aws_lb_target_group" "public" {
  for_each    = local.public_services
  name        = substr("${var.name}-${each.key}", 0, 32)
  port        = var.services[each.key].port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id
  health_check {
    enabled  = true
    path     = var.services[each.key].health_path
    matcher  = "200-399"
    interval = 30
    timeout  = 5
  }
  deregistration_delay = 30
  tags                 = var.tags
}
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }
}
resource "aws_lb_listener_rule" "keycloak" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.public["keycloak"].arn
  }
  condition {
    path_pattern {
      values = ["/auth/*"]
    }
  }
  condition {
    http_header {
      http_header_name = "X-Origin-Verify"
      values           = [var.origin_verify_secret]
    }
  }
}
resource "aws_lb_listener_rule" "kong" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 20
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.public["kong"].arn
  }
  condition {
    http_header {
      http_header_name = "X-Origin-Verify"
      values           = [var.origin_verify_secret]
    }
  }
}

resource "aws_ecs_service" "service" {
  for_each               = var.services
  name                   = each.key
  cluster                = aws_ecs_cluster.this.id
  task_definition        = aws_ecs_task_definition.service[each.key].arn
  desired_count          = each.value.desired_count
  launch_type            = "FARGATE"
  enable_execute_command = true
  wait_for_steady_state  = false
  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = false
  }
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  dynamic "service_connect_configuration" {
    for_each = each.value.port == null ? [] : [1]
    content {
      enabled   = true
      namespace = aws_service_discovery_http_namespace.this.arn
      service {
        port_name      = "http"
        discovery_name = each.key
        client_alias {
          port     = each.value.port
          dns_name = each.key
        }
      }
    }
  }
  dynamic "load_balancer" {
    for_each = contains(local.public_services, each.key) ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.public[each.key].arn
      container_name   = each.key
      container_port   = each.value.port
    }
  }
  lifecycle { ignore_changes = [desired_count] }
  depends_on = [aws_lb_listener.http]
  tags       = var.tags
}
resource "aws_appautoscaling_target" "service" {
  for_each           = { for name, service in var.services : name => service if service.port != null }
  max_capacity       = 4
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.service[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}
resource "aws_appautoscaling_policy" "cpu" {
  for_each           = aws_appautoscaling_target.service
  name               = "${each.key}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = each.value.resource_id
  scalable_dimension = each.value.scalable_dimension
  service_namespace  = each.value.service_namespace
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification { predefined_metric_type = "ECSServiceAverageCPUUtilization" }
    target_value       = 65
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}

output "alb_dns_name" { value = aws_lb.this.dns_name }
output "alb_arn" { value = aws_lb.this.arn }
output "cluster_name" { value = aws_ecs_cluster.this.name }
output "service_names" { value = { for name, service in aws_ecs_service.service : name => service.name } }
output "ecr_repository_urls" { value = { for name, repo in aws_ecr_repository.service : name => repo.repository_url } }
output "task_role_arn" { value = aws_iam_role.task.arn }
output "execution_role_arn" { value = aws_iam_role.execution.arn }
output "task_definition_arns" { value = { for name, task in aws_ecs_task_definition.service : name => task.arn } }
output "service_security_group_id" { value = aws_security_group.service.id }
