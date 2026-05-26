# ── Existing: Basic Lambda execution role ────────────────────────────────────

resource "aws_iam_role" "lmbd_basic_exec" {
  name = "lmbd_basic_exec"

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

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lmbd_basic_exec.name
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
        Sid    = "S3ReadUploads"
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.circulation.arn}/${var.circulation_upload_prefix}*"
      },
      {
        Sid    = "S3WriteProcessed"
        Effect = "Allow"
        Action = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.circulation.arn}/${var.circulation_processed_key}"
      },
      {
        Sid    = "S3ReadProcessed"
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.circulation.arn}/${var.circulation_processed_key}"
      }
    ]
  })
}
