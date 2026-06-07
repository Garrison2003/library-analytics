# ── Secrets Manager: Claude API Key ──────────────────────────────────────────

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name                    = "${var.project_name}-anthropic-api-key-${var.environment}"
  description             = "Anthropic Claude API key for the MCP questions server"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "anthropic_api_key" {
  secret_id     = aws_secretsmanager_secret.anthropic_api_key.id
  secret_string = jsonencode({ api_key = var.anthropic_api_key })
}

# ── IAM Role for MCP Lambda ───────────────────────────────────────────────────

resource "aws_iam_role" "mcp_server_lambda" {
  name = "${var.project_name}-mcp-server-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "mcp_server_lambda" {
  name = "${var.project_name}-mcp-server-policy-${var.environment}"
  role = aws_iam_role.mcp_server_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "Logging"
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Sid    = "S3ReadCirculation"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.circulation.arn,
          "${aws_s3_bucket.circulation.arn}/*",
        ]
      },
      {
        Sid    = "DynamoDBRead"
        Effect = "Allow"
        Action = ["dynamodb:Query", "dynamodb:GetItem", "dynamodb:Scan"]
        Resource = [
          aws_dynamodb_table.programming_data.arn,
          "${aws_dynamodb_table.programming_data.arn}/index/*",
          aws_dynamodb_table.program_sessions.arn,
          "${aws_dynamodb_table.program_sessions.arn}/index/*",
        ]
      },
      {
        Sid      = "SecretsManagerRead"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.anthropic_api_key.arn
      },
    ]
  })
}

# ── MCP Server Lambda ─────────────────────────────────────────────────────────

resource "aws_lambda_function" "mcp_server" {
  filename         = "mcp_server_lambda.zip"
  function_name    = "${var.project_name}-mcp-server-${var.environment}"
  role             = aws_iam_role.mcp_server_lambda.arn
  handler          = "dist/lambda.handler"
  runtime          = "nodejs20.x"
  memory_size      = 512
  timeout          = 30
  source_code_hash = try(filebase64sha256("mcp_server_lambda.zip"), "")

  environment {
    variables = {
      ANTHROPIC_API_KEY_SECRET_ARN = aws_secretsmanager_secret.anthropic_api_key.arn
      CIRCULATION_BUCKET           = aws_s3_bucket.circulation.id
      CIRCULATION_PREFIX           = "processed/"
      CIRCULATION_FILE             = "circulation_data.json"
      DYNAMODB_PROGRAMMING_TABLE        = aws_dynamodb_table.programming_data.name
      DYNAMODB_PROGRAM_SESSIONS_TABLE   = aws_dynamodb_table.program_sessions.name
      NODE_OPTIONS                      = "--enable-source-maps"
    }
  }

  tags = {
    Name        = "${var.project_name}-mcp-server"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "mcp_server" {
  name              = "/aws/lambda/${aws_lambda_function.mcp_server.function_name}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-mcp-server-logs"
  }
}
