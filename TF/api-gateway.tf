# API Gateway REST API for circulation data
# Exposes GET /circulation to the frontend

resource "aws_api_gateway_rest_api" "circulation" {
  name        = "${var.project_name}-circulation-api-${var.environment}"
  description = "Library Analytics – circulation graph data"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# /circulation resource
resource "aws_api_gateway_resource" "circulation" {
  rest_api_id = aws_api_gateway_rest_api.circulation.id
  parent_id   = aws_api_gateway_rest_api.circulation.root_resource_id
  path_part   = "circulation"
}

# ── GET /circulation ─────────────────────────────────────────────────────────

resource "aws_api_gateway_method" "get_circulation" {
  rest_api_id   = aws_api_gateway_rest_api.circulation.id
  resource_id   = aws_api_gateway_resource.circulation.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_circulation" {
  rest_api_id             = aws_api_gateway_rest_api.circulation.id
  resource_id             = aws_api_gateway_resource.circulation.id
  http_method             = aws_api_gateway_method.get_circulation.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.circulation_lambda.invoke_arn
}

# ── OPTIONS /circulation (CORS preflight) ────────────────────────────────────

resource "aws_api_gateway_method" "options_circulation" {
  rest_api_id   = aws_api_gateway_rest_api.circulation.id
  resource_id   = aws_api_gateway_resource.circulation.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_circulation" {
  rest_api_id = aws_api_gateway_rest_api.circulation.id
  resource_id = aws_api_gateway_resource.circulation.id
  http_method = aws_api_gateway_method.options_circulation.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "options_200" {
  rest_api_id = aws_api_gateway_rest_api.circulation.id
  resource_id = aws_api_gateway_resource.circulation.id
  http_method = aws_api_gateway_method.options_circulation.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "options_200" {
  rest_api_id = aws_api_gateway_rest_api.circulation.id
  resource_id = aws_api_gateway_resource.circulation.id
  http_method = aws_api_gateway_method.options_circulation.http_method
  status_code = aws_api_gateway_method_response.options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${var.cors_origin}'"
  }

  depends_on = [aws_api_gateway_integration.options_circulation]
}

# ── Lambda invoke permission for API Gateway ─────────────────────────────────

resource "aws_lambda_permission" "api_gateway_circulation" {
  statement_id  = "AllowAPIGatewayInvokeCirculation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.circulation_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.circulation.execution_arn}/*/*"
}

# ── Deployment & Stage ───────────────────────────────────────────────────────

resource "aws_api_gateway_deployment" "circulation" {
  rest_api_id = aws_api_gateway_rest_api.circulation.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.circulation.id,
      aws_api_gateway_method.get_circulation.id,
      aws_api_gateway_integration.get_circulation.id,
      aws_api_gateway_method.options_circulation.id,
      aws_api_gateway_integration.options_circulation.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "circulation" {
  deployment_id = aws_api_gateway_deployment.circulation.id
  rest_api_id   = aws_api_gateway_rest_api.circulation.id
  stage_name    = "prod"
}
