data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "../lambdas/timeSeriesLambda"
  output_path = "lambda_function_payload.zip"
  excludes    = [".git", "__pycache__", "*.pyc", ".gitignore", "venv", ".venv"]
}
