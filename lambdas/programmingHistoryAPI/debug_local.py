"""
Local debugging script for programmingHistoryAPI Lambda.

Simulates API Gateway events and calls the lambda handler with mock data.
Set breakpoints in programming_history_api_lambda.py and run this debug script.

AWS credentials are automatically loaded from ~/.aws/credentials by boto3.
"""

import json
import sys
import os
from unittest.mock import MagicMock

# Add the lambda directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Set environment variable for DynamoDB table
os.environ.setdefault("DYNAMODB_TABLE", "library-analytics-programming-data-dev")

from programming_history_api_lambda import lambda_handler

# ── Mock Lambda Context ──────────────────────────────────────────────────────

class MockLambdaContext:
    def __init__(self):
        self.function_name = "programmingHistoryAPI"
        self.function_version = "$LATEST"
        self.invoked_function_arn = "arn:aws:lambda:us-east-1:000000000000:function:programmingHistoryAPI"
        self.memory_limit_in_mb = 128
        self.aws_request_id = "local-debug-request-id"
        self.log_group_name = "/aws/lambda/programmingHistoryAPI"
        self.log_stream_name = "local-debug-stream"

    def get_remaining_time_in_millis(self):
        return 30000


# ── Test Events ──────────────────────────────────────────────────────────────

def _print_response(result: dict) -> None:
    """Format and print Lambda response with parsed body."""
    if "body" in result:
        body = json.loads(result["body"])
        print(json.dumps({"statusCode": result["statusCode"], "body": body}, indent=2, default=str))
    else:
        print(json.dumps(result, indent=2, default=str))


def test_branch_history():
    """Test: GET /programming/history?branch=IMG&months=12"""
    print("\n" + "="*70)
    print("TEST: Branch History Query (IMG, 12 months)")
    print("="*70)
    
    event = {
        "httpMethod": "GET",
        "path": "/programming/history",
        "queryStringParameters": {
            "branch": "IMG",
            "months": "12"
        }
    }
    
    context = MockLambdaContext()
    result = lambda_handler(event, context)
    _print_response(result)


def test_compare_branches():
    """Test: GET /programming/compare?branches=IMG,MAI,PLZ&month=2026-05"""
    print("\n" + "="*70)
    print("TEST: Compare Branches (IMG, MAI, PLZ for 2026-05)")
    print("="*70)
    
    event = {
        "httpMethod": "GET",
        "path": "/programming/compare",
        "queryStringParameters": {
            "branches": "IMG,MAI,PLZ",
            "month": "2026-05"
        }
    }
    
    context = MockLambdaContext()
    result = lambda_handler(event, context)
    _print_response(result)


def test_cors_preflight():
    """Test: OPTIONS request (CORS preflight)"""
    print("\n" + "="*70)
    print("TEST: CORS Preflight (OPTIONS)")
    print("="*70)
    
    event = {
        "httpMethod": "OPTIONS",
        "path": "/programming/history"
    }
    
    context = MockLambdaContext()
    result = lambda_handler(event, context)
    _print_response(result)


def test_missing_branch():
    """Test: Error case - missing branch parameter"""
    print("\n" + "="*70)
    print("TEST: Error - Missing branch parameter")
    print("="*70)
    
    event = {
        "httpMethod": "GET",
        "path": "/programming/history",
        "queryStringParameters": {}
    }
    
    context = MockLambdaContext()
    result = lambda_handler(event, context)
    _print_response(result)


def test_invalid_path():
    """Test: Error case - invalid path"""
    print("\n" + "="*70)
    print("TEST: Error - Invalid path")
    print("="*70)
    
    event = {
        "httpMethod": "GET",
        "path": "/invalid/endpoint",
        "queryStringParameters": {}
    }
    
    context = MockLambdaContext()
    result = lambda_handler(event, context)
    _print_response(result)


# ── Run Tests ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n🐍 programmingHistoryAPI Local Debug Session")
    print("   Set breakpoints in programming_history_api_lambda.py to inspect state")
    
    try:
        test_cors_preflight()
        test_branch_history()
        test_compare_branches()
        test_missing_branch()
        test_invalid_path()
        
        print("\n" + "="*70)
        print("✅ All tests completed")
        print("="*70)
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
