# variables.tf - Define input variables for frontend infrastructure

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"  # CloudFront requires us-east-1 for certificates
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "library-analytics"
}

variable "domain_name" {
  description = "Custom domain name for CloudFront"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for custom domain"
  type        = string
  default     = ""
}

variable "cache_ttl_default" {
  description = "Default cache TTL in seconds"
  type        = number
  default     = 3600
}

variable "cache_ttl_assets" {
  description = "Cache TTL for static assets in seconds"
  type        = number
  default     = 31536000  # 1 year
}

variable "enable_versioning" {
  description = "Enable S3 versioning for backup"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project = "library-analytics"
    Team    = "frontend"
  }
}
