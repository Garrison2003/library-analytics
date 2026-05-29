# S3 bucket for circulation data uploads and processed output

resource "aws_s3_bucket" "circulation" {
  bucket = "${var.project_name}-circulation-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name    = "${var.project_name}-circulation"
    Purpose = "Circulation .xlsm uploads and processed graph data"
  }
}

resource "aws_s3_bucket_versioning" "circulation" {
  bucket = aws_s3_bucket.circulation.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "circulation" {
  bucket = aws_s3_bucket.circulation.id

  rule {
    id     = "clean-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "circulation" {
  bucket = aws_s3_bucket.circulation.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "circulation" {
  bucket = aws_s3_bucket.circulation.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = [var.cors_origin]
    max_age_seconds = 3600
  }
}

# ── S3 → Lambda trigger ─────────────────────────────────────────────────────

resource "aws_lambda_permission" "s3_invoke_circulation" {
  statement_id   = "AllowS3InvokeCirculation"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.circulation_lambda.function_name
  principal      = "s3.amazonaws.com"
  source_arn     = aws_s3_bucket.circulation.arn
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_s3_bucket_notification" "circulation_trigger" {
  bucket = aws_s3_bucket.circulation.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.circulation_lambda.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = var.circulation_upload_prefix
    filter_suffix       = ".xlsm"
  }

  depends_on = [aws_lambda_permission.s3_invoke_circulation]
}

# ── S3 → Programming Lambda trigger ──────────────────────────────────────────

resource "aws_lambda_permission" "s3_invoke_programming" {
  statement_id   = "AllowS3InvokeProgramming"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.programming_lambda.function_name
  principal      = "s3.amazonaws.com"
  source_arn     = aws_s3_bucket.circulation.arn
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_s3_bucket_notification" "programming_trigger" {
  bucket = aws_s3_bucket.circulation.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.programming_lambda.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/programming/"
    filter_suffix       = ".xlsx"
  }

  depends_on = [aws_lambda_permission.s3_invoke_programming]
}
