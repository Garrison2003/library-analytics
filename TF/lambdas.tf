# ── Time Series Lambda ────────────────────────────────────────────────────────

resource "aws_lambda_function" "time_series_lambda" {
  filename         = "lambda_function_payload.zip"
  function_name    = "time_series_lambda"
  role             = aws_iam_role.time_series_lambda.arn
  handler          = "lambda_handler.handler"
  runtime          = "python3.12"
  memory_size      = 1024
  timeout          = 120
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  layers = [
    var.time_series_layer_arn,
    aws_lambda_layer_version.openpyxl.arn,
  ]

  environment {
    variables = {
      CIRCULATION_BUCKET   = aws_s3_bucket.circulation.id
      CIRCULATION_PREFIX   = var.circulation_upload_prefix
      TIMESERIES_CACHE_KEY = var.timeseries_cache_key
    }
  }
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

  lifecycle {
    create_before_destroy = true
  }
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

# ── programmingHistoryAPI Lambda (GET /programming/history + /compare) ────────

resource "aws_lambda_function" "programmingHistoryAPI" {
  filename         = "programming_history_api_lambda.zip"
  function_name    = "${var.project_name}-programmingHistoryAPI-${var.environment}"
  role             = aws_iam_role.programming_history_lambda.arn
  handler          = "programming_history_api_lambda.lambda_handler"
  runtime          = "python3.12"
  memory_size      = 512
  timeout          = 30
  source_code_hash = data.archive_file.programming_history_lambda_zip.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE         = aws_dynamodb_table.programming_data.name
      PROGRAM_SESSIONS_TABLE = aws_dynamodb_table.program_sessions.name
    }
  }

  tags = {
    Name        = "${var.project_name}-programmingHistoryAPI"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "programmingHistoryAPI" {
  name              = "/aws/lambda/${aws_lambda_function.programmingHistoryAPI.function_name}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-programmingHistoryAPI-logs"
  }
}

# ── API Authorizer Lambda (validates Auth0 JWT on every request) ──────────────

resource "aws_lambda_function" "api_authorizer" {
  filename         = "api_authorizer_lambda.zip"
  function_name    = "${var.project_name}-api-authorizer-${var.environment}"
  role             = aws_iam_role.api_authorizer.arn
  handler          = "api_authorizer_lambda.lambda_handler"
  runtime          = "python3.12"
  memory_size      = 256
  timeout          = 10
  source_code_hash = filebase64sha256("api_authorizer_lambda.zip")

  environment {
    variables = {
      AUTH0_DOMAIN   = var.auth0_domain
      AUTH0_AUDIENCE = var.auth0_audience
    }
  }

  tags = {
    Name        = "${var.project_name}-api-authorizer"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "api_authorizer" {
  name              = "/aws/lambda/${aws_lambda_function.api_authorizer.function_name}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-api-authorizer-logs"
  }
}

resource "aws_iam_role" "api_authorizer" {
  name = "${var.project_name}-api-authorizer-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "api_authorizer" {
  name = "${var.project_name}-api-authorizer-policy"
  role = aws_iam_role.api_authorizer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "Logging"
      Effect   = "Allow"
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "arn:aws:logs:*:*:*"
    }]
  })
}

# ── programmingDataParser Lambda (S3 trigger — parses uploaded PDFs/xlsx) ─────

resource "aws_lambda_function" "programmingDataParser" {
  filename         = "programming_data_parser_lambda.zip"
  function_name    = "${var.project_name}-programmingDataParser-${var.environment}"
  role             = aws_iam_role.programmingDataParser.arn
  handler          = "programming_data_parser_lambda.lambda_handler"
  runtime          = "python3.12"
  memory_size      = var.programming_lambda_memory
  timeout          = var.programming_lambda_timeout
  source_code_hash = data.archive_file.programmingDataParser_zip.output_base64sha256
  layers           = [aws_lambda_layer_version.openpyxl.arn]

  environment {
    variables = {
      PROCESSED_BUCKET       = aws_s3_bucket.circulation.id
      DYNAMODB_TABLE         = aws_dynamodb_table.programming_data.name
      PROGRAM_SESSIONS_TABLE = aws_dynamodb_table.program_sessions.name
    }
  }

  tags = {
    Name        = "${var.project_name}-programmingDataParser"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "programmingDataParser" {
  name              = "/aws/lambda/${aws_lambda_function.programmingDataParser.function_name}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-programmingDataParser-logs"
  }
}
