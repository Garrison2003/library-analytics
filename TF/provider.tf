# provider.tf - Configure AWS provider and data sources

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  cloud {
    organization = "TuwaAnalytics"
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
