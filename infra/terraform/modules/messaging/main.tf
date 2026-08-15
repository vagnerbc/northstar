resource "aws_security_group" "msk" {
  name_prefix = "${var.name}-msk-"
  vpc_id      = var.vpc_id
  ingress {
    from_port   = 9098
    to_port     = 9098
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "MSK IAM from VPC"
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = var.tags
}
resource "aws_msk_serverless_cluster" "this" {
  cluster_name = var.name
  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [aws_security_group.msk.id]
  }
  client_authentication {
    sasl {
      iam {
        enabled = true
      }
    }
  }
  tags = var.tags
}
output "cluster_arn" { value = aws_msk_serverless_cluster.this.arn }
output "bootstrap_brokers_sasl_iam" { value = aws_msk_serverless_cluster.this.bootstrap_brokers_sasl_iam }
