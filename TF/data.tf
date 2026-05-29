data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "../lambdas/timeSeriesLambda"
  output_path = "lambda_function_payload.zip"
  excludes    = [".git", "__pycache__", "*.pyc", ".gitignore", "venv", ".venv"]
}

data "archive_file" "circulation_lambda_zip" {
  type        = "zip"
  source_file = "../lambdas/circulationLambda/lambda_function.py"
  output_path = "circulation_lambda_payload.zip"
}

data "archive_file" "upload_handler_lambda_zip" {
  type        = "zip"
  source_file = "../lambdas/uploadHandlerLambda/upload_handler_lambda.py"
  output_path = "upload_handler_lambda.zip"
}

data "archive_file" "programming_lambda_zip" {
  type        = "zip"
  source_file = "../lambdas/programmingLambda/programming_lambda.py"
  output_path = "programming_lambda_payload.zip"
}
