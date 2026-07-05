# dynamodb.tf - DynamoDB tables for historical programming data

# ── Main Programming Data Table ──────────────────────────────────────────────

resource "aws_dynamodb_table" "programming_data" {
  name         = "${var.project_name}-programming-data-${var.environment}"
  billing_mode = var.dynamodb_billing_mode # "PAY_PER_REQUEST" or "PROVISIONED"
  hash_key     = "branch_code"
  range_key    = "year_month"

  # Provisioned capacity (only used if billing_mode = "PROVISIONED")
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  # Partition Key: branch_code (e.g., "IMG", "MAI")
  attribute {
    name = "branch_code"
    type = "S" # String
  }

  # Sort Key: year_month (e.g., "2026-05" for May 2026)
  attribute {
    name = "year_month"
    type = "S" # String
  }

  # GSI Partition Key: year_month (for "get all branches in a month" queries)
  attribute {
    name = "year_month_gsi"
    type = "S"
  }

  # Global Secondary Index: DateIndex
  # Allows querying: "Give me all branches for May 2026"
  global_secondary_index {
    name            = "DateIndex"
    hash_key        = "year_month_gsi"
    range_key       = "branch_code"
    projection_type = "ALL" # Project all attributes (needed for comparisons)

    read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_gsi_read_capacity : null
    write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_gsi_write_capacity : null
  }

  # Time-to-Live: Auto-delete data older than 5 years (optional)
  ttl {
    attribute_name = "ttl"
    enabled        = var.dynamodb_enable_ttl
  }

  # Point-in-Time Recovery: Can restore to any point in last 35 days
  point_in_time_recovery {
    enabled = true
  }

  # Stream for Lambda triggers (optional, for future analytics)
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  # Tags
  tags = {
    Name        = "${var.project_name}-programming-data"
    Environment = var.environment
    Type        = "Historical Data"
  }
}

# ── Program Sessions Table ───────────────────────────────────────────────────
# Stores one item per program session row parsed from In-House / Outreach PDFs.
# PK: branch_code  SK: session_key (date#program_name#facilitator[#site])
# Queryable by facilitator, program name, and program date via GSIs.

resource "aws_dynamodb_table" "program_sessions" {
  name         = "${var.project_name}-program-sessions-${var.environment}"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "branch_code"
  range_key    = "session_key"

  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  attribute {
    name = "branch_code"
    type = "S"
  }

  attribute {
    name = "session_key"
    type = "S"
  }

  attribute {
    name = "primary_facilitator"
    type = "S"
  }

  attribute {
    name = "program_name"
    type = "S"
  }

  attribute {
    name = "program_date"
    type = "S"
  }

  global_secondary_index {
    name            = "FacilitatorIndex"
    hash_key        = "primary_facilitator"
    range_key       = "program_date"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_gsi_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_gsi_write_capacity : null
  }

  global_secondary_index {
    name            = "ProgramNameIndex"
    hash_key        = "program_name"
    range_key       = "program_date"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_gsi_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_gsi_write_capacity : null
  }

  global_secondary_index {
    name            = "ProgramDateIndex"
    hash_key        = "program_date"
    range_key       = "branch_code"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_gsi_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_gsi_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "${var.project_name}-program-sessions"
    Environment = var.environment
    Type        = "Session Data"
  }
}

# ── CloudWatch Alarms for DynamoDB ──────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "dynamodb_read_throttle" {
  alarm_name          = "${var.project_name}-dynamodb-read-throttle"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "ReadThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = "60"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "Alert when DynamoDB read throttling occurs"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.programming_data.name
  }
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_write_throttle" {
  alarm_name          = "${var.project_name}-dynamodb-write-throttle"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "WriteThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = "60"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "Alert when DynamoDB write throttling occurs"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.programming_data.name
  }
}

# ── CloudWatch Log Group for DynamoDB Monitoring ─────────────────────────────

resource "aws_cloudwatch_log_group" "dynamodb_logs" {
  name              = "/aws/dynamodb/${var.project_name}-${var.environment}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-dynamodb-logs"
  }
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "programming_data_table_name" {
  description = "Name of the DynamoDB programming data table"
  value       = aws_dynamodb_table.programming_data.name
}

output "programming_data_table_arn" {
  description = "ARN of the DynamoDB programming data table"
  value       = aws_dynamodb_table.programming_data.arn
}

output "date_index_name" {
  description = "Name of the DateIndex GSI"
  value       = "DateIndex"
}

output "program_sessions_table_name" {
  description = "Name of the program sessions DynamoDB table"
  value       = aws_dynamodb_table.program_sessions.name
}

output "program_sessions_table_arn" {
  description = "ARN of the program sessions DynamoDB table"
  value       = aws_dynamodb_table.program_sessions.arn
}
