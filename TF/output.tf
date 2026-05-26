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
