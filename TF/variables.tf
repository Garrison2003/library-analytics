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

# ── Time Series Lambda variables ─────────────────────────────────────────────

variable "circulation_s3_bucket_name" {
  description = "s3 circulation bucket"
  type        = string
  default     = ""
}

# ── DynamoDB Configuration ───────────────────────────────────────────────────

variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode: PAY_PER_REQUEST (recommended) or PROVISIONED"
  type        = string
  default     = "PAY_PER_REQUEST" # Auto-scales, no capacity planning needed

  validation {
    condition     = contains(["PAY_PER_REQUEST", "PROVISIONED"], var.dynamodb_billing_mode)
    error_message = "Billing mode must be either PAY_PER_REQUEST or PROVISIONED."
  }
}

# Provisioned Capacity (only used if billing_mode = "PROVISIONED")
variable "dynamodb_read_capacity" {
  description = "Read capacity units for programming_data table (if using PROVISIONED mode)"
  type        = number
  default     = 200 # Handles ~50 concurrent users
}

variable "dynamodb_write_capacity" {
  description = "Write capacity units for programming_data table (if using PROVISIONED mode)"
  type        = number
  default     = 5 # Handles monthly uploads + updates
}

variable "dynamodb_gsi_read_capacity" {
  description = "Read capacity units for DateIndex GSI (if using PROVISIONED mode)"
  type        = number
  default     = 100 # Handles branch comparisons
}

variable "dynamodb_gsi_write_capacity" {
  description = "Write capacity units for DateIndex GSI (if using PROVISIONED mode)"
  type        = number
  default     = 5 # Same as main table
}

variable "dynamodb_enable_ttl" {
  description = "Enable Time-to-Live to auto-delete data older than specified age"
  type        = bool
  default     = false # Set to true if you want auto-deletion
}

variable "dynamodb_retention_years" {
  description = "Number of years to retain data before auto-deletion (if TTL enabled)"
  type        = number
  default     = 5
}

variable "create_dynamodb_api_role" {
  description = "Whether to create an IAM role for API Gateway direct DynamoDB access"
  type        = bool
  default     = false
}

# ── Anthropic ────────────────────────────────────────────────────────────────

variable "anthropic_api_key" {
  description = "Anthropic Claude API key, stored in Secrets Manager by Terraform"
  type        = string
  sensitive   = true
  default     = ""
}

# ── Auth0 ────────────────────────────────────────────────────────────────────

variable "auth0_domain" {
  description = "Auth0 tenant domain (e.g. your-tenant.us.auth0.com)"
  type        = string
  default     = ""
}

variable "auth0_audience" {
  description = "Auth0 API audience identifier (must match VITE_AUTH0_AUDIENCE)"
  type        = string
  default     = ""
}
