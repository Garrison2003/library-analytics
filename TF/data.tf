data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "../lambdas/timeSeriesLambda/dist"
  output_path = "lambda_function_payload.zip"
}
