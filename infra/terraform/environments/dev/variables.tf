variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "project_name" {
  type    = string
  default = "ecommerce-study-dev"
}
variable "image_tag" {
  type        = string
  description = "Immutable Git SHA image tag"
}
variable "public_base_url" {
  type        = string
  description = "HTTPS public URL used as the Keycloak issuer"
}
variable "github_repository" {
  type        = string
  description = "GitHub owner/repository allowed to deploy"
}
variable "ses_identity" {
  type        = string
  description = "Verified SES email address or domain"
}
variable "temporal_address" { type = string }
variable "temporal_namespace" { type = string }
variable "temporal_api_key" {
  type      = string
  sensitive = true
}
variable "stripe_secret_key" {
  type      = string
  sensitive = true
}
variable "stripe_webhook_secret" {
  type      = string
  sensitive = true
}
variable "keycloak_admin_password" {
  type      = string
  sensitive = true
}
