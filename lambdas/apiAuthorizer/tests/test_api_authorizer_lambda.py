"""
Tests for api_authorizer_lambda.py
Run: pytest tests/ -v
"""

import pytest
from unittest.mock import patch, MagicMock
from jose import exceptions

from api_authorizer_lambda import lambda_handler, _allow_policy


METHOD_ARN = "arn:aws:execute-api:us-east-1:123456789012:abc123/dev/GET/circulation"

FAKE_JWKS = {
    "keys": [
        {
            "kty": "RSA",
            "kid": "test-key-id",
            "use": "sig",
            "n": "test-n",
            "e": "AQAB",
        }
    ]
}

FAKE_PAYLOAD = {"sub": "auth0|user123", "aud": "https://test-api", "iss": "https://test.auth0.com/"}


def _event(token="Bearer valid.token.here"):
    return {"authorizationToken": token, "methodArn": METHOD_ARN}


# ── _allow_policy ─────────────────────────────────────────────────────────────


class TestAllowPolicy:
    def test_returns_correct_principal(self):
        result = _allow_policy("user123", METHOD_ARN)
        assert result["principalId"] == "user123"

    def test_policy_allows_invoke(self):
        result = _allow_policy("user123", METHOD_ARN)
        stmt = result["policyDocument"]["Statement"][0]
        assert stmt["Effect"] == "Allow"
        assert stmt["Action"] == "execute-api:Invoke"

    def test_policy_resource_wildcards_stage_and_method(self):
        result = _allow_policy("user123", METHOD_ARN)
        resource = result["policyDocument"]["Statement"][0]["Resource"]
        assert resource.endswith("/*/*")
        assert "abc123" in resource

    def test_policy_does_not_leak_specific_resource(self):
        result = _allow_policy("user123", METHOD_ARN)
        resource = result["policyDocument"]["Statement"][0]["Resource"]
        assert "/GET/circulation" not in resource


# ── lambda_handler ────────────────────────────────────────────────────────────


class TestLambdaHandler:
    @patch("api_authorizer_lambda._get_jwks")
    @patch("api_authorizer_lambda.jwt.decode")
    @patch("api_authorizer_lambda.jwt.get_unverified_header")
    def test_valid_token_returns_allow_policy(self, mock_header, mock_decode, mock_jwks):
        mock_jwks.return_value = FAKE_JWKS
        mock_header.return_value = {"kid": "test-key-id"}
        mock_decode.return_value = FAKE_PAYLOAD

        result = lambda_handler(_event(), None)

        assert result["principalId"] == "auth0|user123"
        assert result["policyDocument"]["Statement"][0]["Effect"] == "Allow"

    @patch("api_authorizer_lambda._get_jwks")
    @patch("api_authorizer_lambda.jwt.decode")
    @patch("api_authorizer_lambda.jwt.get_unverified_header")
    def test_bearer_prefix_is_stripped(self, mock_header, mock_decode, mock_jwks):
        mock_jwks.return_value = FAKE_JWKS
        mock_header.return_value = {"kid": "test-key-id"}
        mock_decode.return_value = FAKE_PAYLOAD

        lambda_handler(_event("Bearer my.token.value"), None)

        _, call_kwargs = mock_decode.call_args
        # First positional arg to jwt.decode should be the raw token without "Bearer "
        raw_token = mock_decode.call_args[0][0]
        assert raw_token == "my.token.value"

    def test_missing_token_raises_unauthorized(self):
        with pytest.raises(Exception, match="Unauthorized"):
            lambda_handler({"authorizationToken": "", "methodArn": METHOD_ARN}, None)

    def test_missing_authorization_key_raises_unauthorized(self):
        with pytest.raises(Exception, match="Unauthorized"):
            lambda_handler({"methodArn": METHOD_ARN}, None)

    @patch("api_authorizer_lambda._get_jwks")
    @patch("api_authorizer_lambda.jwt.get_unverified_header")
    def test_unknown_kid_raises_unauthorized(self, mock_header, mock_jwks):
        mock_jwks.return_value = FAKE_JWKS
        mock_header.return_value = {"kid": "unknown-kid"}

        with pytest.raises(Exception, match="Unauthorized"):
            lambda_handler(_event(), None)

    @patch("api_authorizer_lambda._get_jwks")
    @patch("api_authorizer_lambda.jwt.decode")
    @patch("api_authorizer_lambda.jwt.get_unverified_header")
    def test_expired_token_raises_unauthorized(self, mock_header, mock_decode, mock_jwks):
        mock_jwks.return_value = FAKE_JWKS
        mock_header.return_value = {"kid": "test-key-id"}
        mock_decode.side_effect = exceptions.ExpiredSignatureError("expired")

        with pytest.raises(Exception, match="Unauthorized"):
            lambda_handler(_event(), None)

    @patch("api_authorizer_lambda._get_jwks")
    @patch("api_authorizer_lambda.jwt.decode")
    @patch("api_authorizer_lambda.jwt.get_unverified_header")
    def test_invalid_token_raises_unauthorized(self, mock_header, mock_decode, mock_jwks):
        mock_jwks.return_value = FAKE_JWKS
        mock_header.return_value = {"kid": "test-key-id"}
        mock_decode.side_effect = exceptions.JWTError("invalid")

        with pytest.raises(Exception, match="Unauthorized"):
            lambda_handler(_event(), None)

    @patch("api_authorizer_lambda._get_jwks")
    def test_jwks_fetch_failure_raises_unauthorized(self, mock_jwks):
        mock_jwks.side_effect = Exception("network error")

        with pytest.raises(Exception, match="Unauthorized"):
            lambda_handler(_event(), None)
