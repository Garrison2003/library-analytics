# ── Existing: Time Series Lambda ─────────────────────────────────────────────

resource "aws_lambda_function" "time_series_lambda" {
  filename      = "lambda_function_payload.zip"
  function_name = "time_series_lambda"
  role          = aws_iam_role.time_series_lambda.arn
  handler       = "index.handler"
  runtime       = "python3.12"

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}

# ── Circulation Lambda ───────────────────────────────────────────────────────

# Layer: openpyxl for Excel parsing
# Built by the CI "Build openpyxl Layer" step; zip is placed at TF/openpyxl_layer.zip
# before Terraform runs so the remote runner never needs zip/pip.
resource "aws_lambda_layer_version" "openpyxl" {
  layer_name          = "${var.project_name}-openpyxl"
  filename            = "openpyxl_layer.zip"
  compatible_runtimes = ["python3.12"]
  description         = "openpyxl for Excel .xlsm parsing"
  source_code_hash    = filebase64sha256("openpyxl_layer.zip")
}

# Function
resource "aws_lambda_function" "circulation_lambda" {
  filename         = "circulation_lambda_payload.zip"
  function_name    = "${var.project_name}-circulation-${var.environment}"
  role             = aws_iam_role.circulation_lambda.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  memory_size      = var.circulation_lambda_memory
  timeout          = var.circulation_lambda_timeout
  source_code_hash = data.archive_file.circulation_lambda_zip.output_base64sha256
  layers           = [aws_lambda_layer_version.openpyxl.arn]

  environment {
    variables = {
      PROCESSED_BUCKET = aws_s3_bucket.circulation.id
      PROCESSED_KEY    = var.circulation_processed_key
    }
  }
}

resource "aws_cloudwatch_log_group" "circulation_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.circulation_lambda.function_name}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-upload-lambda-logs"
  }
}

# ── Upload Handler Lambda ────────────────────────────────────────────────────

resource "aws_lambda_function" "upload_handler" {
  filename         = "upload_handler_lambda.zip"
  function_name    = "${var.project_name}-upload-handler-${var.environment}"
  role             = aws_iam_role.upload_lambda_role.arn
  handler          = "upload_handler_lambda.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30
  source_code_hash = data.archive_file.upload_handler_lambda_zip.output_base64sha256

  environment {
    variables = {
      UPLOAD_BUCKET = aws_s3_bucket.circulation.id
    }
  }

  tags = {
    Name        = "${var.project_name}-upload-handler"
    Environment = var.environment
  }
}

# ── CloudWatch Log Group for Upload Lambda ──────────────────────────────

resource "aws_cloudwatch_log_group" "upload_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.upload_handler.function_name}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-upload-lambda-logs"
  }
}

# ── Programming Statistics Lambda ───────────────────────────────────────────

resource "aws_lambda_function" "programming_lambda" {
  filename         = "programming_lambda_payload.zip"
  function_name    = "${var.project_name}-programming-${var.environment}"
  role             = aws_iam_role.programming_lambda.arn
  handler          = "programming_lambda.lambda_handler"
  runtime          = "python3.12"
  memory_size      = var.programming_lambda_memory
  timeout          = var.programming_lambda_timeout
  source_code_hash = data.archive_file.programming_lambda_zip.output_base64sha256
  layers           = [aws_lambda_layer_version.openpyxl.arn]

  environment {
    variables = {
      PROCESSED_BUCKET = aws_s3_bucket.circulation.id
    }
  }

  tags = {
    Name        = "${var.project_name}-programming-lambda"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "programming_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.programming_lambda.function_name}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-programming-lambda-logs"
  }
}
