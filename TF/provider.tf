# provider.tf - Configure AWS provider and data sources

terraform {
  required_version = "~> 1.15.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }

  cloud {
    hostname     = "app.terraform.io"
    organization = "TuwaAnalytics"

    workspaces {
      name = "library-analytics-dev"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Get available regions
data "aws_region" "current" {}

# Locals for commonly used values
locals {
  bucket_name = "${var.project_name}-frontend-${data.aws_caller_identity.current.account_id}"
  common_tags = merge(
    var.tags,
    {
      Environment = var.environment
      Region      = data.aws_region.current.name
    }
  )
}
