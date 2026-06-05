# ── Time Series Lambda role ───────────────────────────────────────────────────

resource "aws_iam_role" "time_series_lambda" {
  name = "${var.project_name}-time-series-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Sid    = ""
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "time_series_lambda_logs" {
  role       = aws_iam_role.time_series_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}


# ── Circulation Lambda role ──────────────────────────────────────────────────

resource "aws_iam_role" "circulation_lambda" {
  name = "${var.project_name}-circulation-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "circulation_lambda" {
  name = "${var.project_name}-circulation-policy"
  role = aws_iam_role.circulation_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Logging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Sid      = "S3ListBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.circulation.arn
      },
      {
        Sid      = "S3ReadUploads"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.circulation.arn}/${var.circulation_upload_prefix}*"
      },
      {
        Sid      = "S3WriteProcessed"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.circulation.arn}/${var.circulation_processed_key}"
      },
      {
        Sid      = "S3ReadProcessed"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.circulation.arn}/${var.circulation_processed_key}"
      }
    ]
  })
}

# ── Upload Handler Lambda role ──────────────────────────────────────────────────

resource "aws_iam_role" "upload_lambda_role" {
  name = "${var.project_name}-upload-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# ── IAM Policy for Upload Lambda (S3 Access) ─────────────────────────────

resource "aws_iam_role_policy" "upload_lambda_s3_policy" {
  name = "${var.project_name}-upload-lambda-s3-${var.environment}"
  role = aws_iam_role.upload_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.circulation.arn,
          "${aws_s3_bucket.circulation.arn}/*"
        ]
      }
    ]
  })
}

# ── IAM Policy for Upload Lambda (CloudWatch Logs) ──────────────────────

resource "aws_iam_role_policy" "upload_lambda_logs_policy" {
  name = "${var.project_name}-upload-lambda-logs-${var.environment}"
  role = aws_iam_role.upload_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "arn:aws:logs:*:*:*"
    }]
  })
}

# ── Programming History Lambda role ──────────────────────────────────────────

resource "aws_iam_role" "programming_history_lambda" {
  name = "${var.project_name}-programming-history-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "programming_history_lambda" {
  name = "${var.project_name}-programming-history-policy"
  role = aws_iam_role.programming_history_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Logging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Sid    = "DynamoDBRead"
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.programming_data.arn,
          aws_dynamodb_table.branch_metadata.arn
        ]
      },
      {
        Sid      = "DynamoDBGSI"
        Effect   = "Allow"
        Action   = ["dynamodb:Query"]
        Resource = "${aws_dynamodb_table.programming_data.arn}/index/DateIndex"
      }
    ]
  })
}

# ── programmingDataParser Lambda role ────────────────────────────────────────────────

resource "aws_iam_role" "programmingDataParser" {
  name = "${var.project_name}-programmingDataParser-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "programmingDataParser" {
  name = "${var.project_name}-programmingDataParser-policy"
  role = aws_iam_role.programmingDataParser.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Logging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Sid      = "S3ListBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.circulation.arn
      },
      {
        Sid      = "S3ReadUploads"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.circulation.arn}/uploads/programming/*"
      },
      {
        Sid      = "S3WriteProcessed"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.circulation.arn}/processed/programming/*"
      },
      {
        Sid      = "S3ReadProcessed"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.circulation.arn}/processed/programming/*"
      },
      {
        Sid    = "DynamoDBProgrammingDataWrite"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = aws_dynamodb_table.programming_data.arn
      },
      {
        Sid    = "DynamoDBProgrammingDataRead"
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.programming_data.arn
      },
      {
        Sid      = "DynamoDBProgrammingDataGSI"
        Effect   = "Allow"
        Action   = ["dynamodb:Query"]
        Resource = "${aws_dynamodb_table.programming_data.arn}/index/DateIndex"
      },
      {
        Sid    = "DynamoDBMetadataWrite"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.branch_metadata.arn
      },
      {
        Sid    = "DynamoDBMetadataRead"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.branch_metadata.arn
      }
    ]
  })
}

# ── Optional: IAM Role for DynamoDB API Access (if needed for direct access) ──

resource "aws_iam_role" "dynamodb_api_access" {
  count = var.create_dynamodb_api_role ? 1 : 0
  name  = "${var.project_name}-dynamodb-api-access-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "dynamodb_api_access" {
  count = var.create_dynamodb_api_role ? 1 : 0
  name  = "${var.project_name}-dynamodb-api-access-policy"
  role  = aws_iam_role.dynamodb_api_access[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.programming_data.arn,
          "${aws_dynamodb_table.programming_data.arn}/index/DateIndex",
          aws_dynamodb_table.branch_metadata.arn
        ]
      }
    ]
  })
}