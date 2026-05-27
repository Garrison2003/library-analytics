output "website_url" {
  description = "CloudFront distribution URL"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

# ── Circulation outputs ──────────────────────────────────────────────────────

output "circulation_api_url" {
  description = "API endpoint for circulation graph data (GET /circulation)"
  value       = "${aws_api_gateway_stage.circulation.invoke_url}/circulation"
}

output "circulation_api_base_url" {
  description = "API base URL (set as VITE_API_URL in frontend .env)"
  value       = aws_api_gateway_stage.circulation.invoke_url
}

output "circulation_bucket_name" {
  description = "S3 bucket for circulation uploads"
  value       = aws_s3_bucket.circulation.id
}

output "circulation_upload_path" {
  description = "Full S3 URI for uploading .xlsm files"
  value       = "s3://${aws_s3_bucket.circulation.id}/${var.circulation_upload_prefix}"
}

output "circulation_lambda_name" {
  description = "Circulation Lambda function name"
  value       = aws_lambda_function.circulation_lambda.function_name
}

# ── Upload Handler Outputs ────────────────────────────────────────────────────

output "upload_lambda_arn" {
  value       = aws_lambda_function.upload_handler.arn
  description = "ARN of the upload handler Lambda function"
}

output "upload_endpoint_url" {
  value       = "${aws_api_gateway_deployment.upload_endpoints.invoke_url}/upload"
  description = "URL of the upload endpoint"
}

output "upload_validate_endpoint_url" {
  value       = "${aws_api_gateway_deployment.upload_endpoints.invoke_url}/upload/validate"
  description = "URL of the upload validation endpoint"
}
