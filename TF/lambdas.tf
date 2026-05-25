resource "aws_lambda_function" "time_series_lambda" {
  filename      = "lambda_function_payload.zip"
  function_name = "time_series_lambda"
  role          = aws_iam_role.lmbd_basic_exec.arn
  handler       = "index.handler" # The name of your handler function (e.g., filename.export)

  # Choose the runtime (e.g., nodejs22.x, python3.12, etc.)
  runtime = "python3.12"

  # Ensures the code is updated when the zip file changes
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}
