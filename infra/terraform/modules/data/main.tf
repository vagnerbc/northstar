resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
  tags       = var.tags
}
resource "aws_security_group" "database" {
  name_prefix = "${var.name}-db-"
  vpc_id      = var.vpc_id
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "PostgreSQL from private VPC"
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = var.tags
}
resource "random_password" "database" {
  for_each         = var.database_names
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}
resource "aws_secretsmanager_secret" "database" {
  for_each                = var.database_names
  name                    = "${var.name}/database/${each.key}"
  recovery_window_in_days = 7
  tags                    = var.tags
}
resource "aws_secretsmanager_secret_version" "database" {
  for_each  = var.database_names
  secret_id = aws_secretsmanager_secret.database[each.key].id
  secret_string = jsonencode({
    username = each.key
    password = random_password.database[each.key].result
    host     = aws_db_instance.database[each.key].address
    port     = 5432
    database = replace(each.key, "-", "_")
    url      = "postgresql://${each.key}:${urlencode(random_password.database[each.key].result)}@${aws_db_instance.database[each.key].address}:5432/${replace(each.key, "-", "_")}"
  })
}
resource "aws_db_instance" "database" {
  for_each                     = var.database_names
  identifier                   = "${var.name}-${replace(each.key, "_", "-")}"
  engine                       = "postgres"
  engine_version               = "17.6"
  instance_class               = var.instance_class
  allocated_storage            = 20
  max_allocated_storage        = 100
  storage_type                 = "gp3"
  storage_encrypted            = true
  db_name                      = replace(each.key, "-", "_")
  username                     = each.key
  password                     = random_password.database[each.key].result
  port                         = 5432
  db_subnet_group_name         = aws_db_subnet_group.this.name
  vpc_security_group_ids       = [aws_security_group.database.id]
  publicly_accessible          = false
  multi_az                     = false
  backup_retention_period      = 1
  deletion_protection          = false
  skip_final_snapshot          = true
  apply_immediately            = true
  auto_minor_version_upgrade   = true
  performance_insights_enabled = false
  tags                         = merge(var.tags, { Service = each.key })
}

output "endpoints" { value = { for name, database in aws_db_instance.database : name => database.address } }
output "secret_arns" { value = { for name, secret in aws_secretsmanager_secret.database : name => secret.arn } }
output "secret_values" {
  value     = { for name, password in random_password.database : name => password.result }
  sensitive = true
}
