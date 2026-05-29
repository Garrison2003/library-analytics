# variables.tf - All input variables for the project
#
# Existing variables (referenced in provider.tf, s3-frontend.tf)
# are typically set in the Terraform Cloud workspace.

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used as a prefix for resource naming"
  type        = string
  default     = "library-analytics"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "tags" {
  description = "Tags applied to all resources"
  type        = map(string)
  default     = {}
}

variable "domain_name" {
  description = "Custom domain name for CloudFront (leave empty to skip)"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the custom domain (leave empty to skip)"
  type        = string
  default     = ""
}

# ── Circulation Lambda variables ─────────────────────────────────────────────

variable "circulation_upload_prefix" {
  description = "S3 key prefix where .xlsm circulation files are uploaded"
  type        = string
  default     = "uploads/circulation/"
}

variable "circulation_processed_key" {
  description = "S3 key where the processed circulation JSON is written"
  type        = string
  default     = "processed/circulation_data.json"
}

variable "circulation_lambda_memory" {
  description = "Memory (MB) for the circulation Lambda"
  type        = number
  default     = 512
}

variable "circulation_lambda_timeout" {
  description = "Timeout (seconds) for the circulation Lambda"
  type        = number
  default     = 60
}

variable "cors_origin" {
  description = "Allowed CORS origin for the circulation API"
  type        = string
  default     = "*"
}

# ── Programming Lambda variables ─────────────────────────────────────────────

variable "programming_lambda_memory" {
  description = "Memory (MB) for the programming Lambda"
  type        = number
  default     = 512
}

variable "programming_lambda_timeout" {
  description = "Timeout (seconds) for the programming Lambda"
  type        = number
  default     = 60
}
