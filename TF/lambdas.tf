# ── Existing: Time Series Lambda ─────────────────────────────────────────────

resource "aws_lambda_function" "time_series_lambda" {
  filename      = "lambda_function_payload.zip"
  function_name = "time_series_lambda"
  role          = aws_iam_role.lmbd_basic_exec.arn
  handler       = "index.handler"
  runtime       = "python3.12"

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}


# ── Circulation Lambda ───────────────────────────────────────────────────────

# Layer: openpyxl for Excel parsing
# Build step runs pip install locally, then zips the result.
# Re-triggers when layer/requirements.txt changes.
resource "null_resource" "build_openpyxl_layer" {
  triggers = {
    requirements = filemd5("../lambdas/circulationLambda/layer/requirements.txt")
  }

  provisioner "local-exec" {
    command = <<-EOT
      rm -rf ../lambdas/circulationLambda/build/layer
      mkdir -p ../lambdas/circulationLambda/build/layer/python
      pip install \
        -r ../lambdas/circulationLambda/layer/requirements.txt \
        -t ../lambdas/circulationLambda/build/layer/python \
        --quiet
      cd ../lambdas/circulationLambda/build/layer
      zip -r ../openpyxl_layer.zip python
    EOT
  }
}

resource "aws_lambda_layer_version" "openpyxl" {
  layer_name          = "${var.project_name}-openpyxl"
  filename            = "../lambdas/circulationLambda/build/openpyxl_layer.zip"
  compatible_runtimes = ["python3.12"]
  description         = "openpyxl for Excel .xlsm parsing"

  depends_on = [null_resource.build_openpyxl_layer]
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
  retention_in_days = 30
}
