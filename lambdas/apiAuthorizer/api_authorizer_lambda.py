"""
API Gateway Token Authorizer — validates Auth0 JWT Bearer tokens.

Returns an IAM policy allowing execute-api:Invoke on all routes in the
current API when the token is valid; raises Exception('Unauthorized')
otherwise so API Gateway returns 401.
"""

import json
import os
import urllib.request

from jose import exceptions, jwt

AUTH0_DOMAIN = os.environ["AUTH0_DOMAIN"]
AUTH0_AUDIENCE = os.environ["AUTH0_AUDIENCE"]
ALGORITHMS = ["RS256"]


def lambda_handler(event, context):
    token = event.get("authorizationToken", "")
    if token.lower().startswith("bearer "):
        token = token[7:]

    if not token:
        raise Exception("Unauthorized")

    try:
        jwks = _get_jwks()
        header = jwt.get_unverified_header(token)

        rsa_key = next(
            (
                {"kty": k["kty"], "kid": k["kid"], "use": k["use"], "n": k["n"], "e": k["e"]}
                for k in jwks["keys"]
                if k["kid"] == header.get("kid")
            ),
            None,
        )
        if rsa_key is None:
            raise Exception("Unauthorized")

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHMS,
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/",
        )

        return _allow_policy(payload["sub"], event["methodArn"])

    except exceptions.ExpiredSignatureError:
        raise Exception("Unauthorized")
    except Exception:
        raise Exception("Unauthorized")


def _get_jwks() -> dict:
    url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    with urllib.request.urlopen(url, timeout=5) as resp:
        return json.loads(resp.read())


def _allow_policy(principal_id: str, method_arn: str) -> dict:
    # Wildcard stage/method/resource so one cached policy covers all endpoints.
    # methodArn format: arn:aws:execute-api:region:account:api-id/stage/METHOD/resource
    arn_base = method_arn.rsplit("/", 3)[0]  # strips /stage/METHOD/resource
    return {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": "Allow",
                    "Resource": f"{arn_base}/*/*",
                }
            ],
        },
    }
