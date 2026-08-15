variable "name" { type = string }
variable "aws_region" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "msk_cluster_arn" { type = string }
variable "image_tag" { type = string }
variable "origin_verify_secret" {
  type      = string
  sensitive = true
}
variable "services" {
  type = map(object({
    image             = optional(string, "")
    create_repository = optional(bool, true)
    port              = optional(number)
    cpu               = optional(number, 256)
    memory            = optional(number, 512)
    desired_count     = optional(number, 1)
    health_path       = optional(string, "/health/ready")
    command           = optional(list(string), [])
    environment       = optional(map(string), {})
    secrets           = optional(map(string), {})
  }))
}
variable "tags" {
  type    = map(string)
  default = {}
}
