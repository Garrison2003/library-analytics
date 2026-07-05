data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "../lambdas/timeSeriesLambda/lambda_handler.py"
  output_path = "lambda_function_payload.zip"
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

data "archive_file" "programmingDataParser_zip" {
  type        = "zip"
  source_file = "../lambdas/programmingDataParser/programming_data_parser_lambda.py"
  output_path = "programming_data_parser_lambda.zip"
}

data "archive_file" "programming_history_lambda_zip" {
  type        = "zip"
  source_file = "../lambdas/programmingHistoryAPI/programming_history_api_lambda.py"
  output_path = "programming_history_api_lambda.zip"
}
