variable "name" { type = string }
variable "cidr" {
  type    = string
  default = "10.40.0.0/16"
}
variable "az_count" {
  type    = number
  default = 2
}
variable "single_nat_gateway" {
  type    = bool
  default = true
}
variable "tags" {
  type    = map(string)
  default = {}
}
