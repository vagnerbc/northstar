variable "name" { type = string }
variable "vpc_id" { type = string }
variable "vpc_cidr" { type = string }
variable "subnet_ids" { type = list(string) }
variable "database_names" { type = set(string) }
variable "instance_class" {
  type    = string
  default = "db.t4g.micro"
}
variable "tags" {
  type    = map(string)
  default = {}
}
