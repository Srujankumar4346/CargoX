import jwt
from jwt import PyJWKClient
from app.core.config import settings

# Initialize PyJWKClient to fetch and cache JWKS keys automatically
# It handles caching based on Cache-Control headers returned by the JWKS endpoint
# We only fetch keys from the trusted URL in our configuration, NEVER dynamically from a token header.
jwks_client = PyJWKClient(settings.CLERK_JWKS_URL, cache_keys=True)

def decode_token(token: str) -> dict:
    """
    Decodes and verifies a Clerk JWT using asymmetric JWKS.
    Validates signature, expiration, and issuer.
    """
    try:
        # Fetch the signing key corresponding to the 'kid' header in the token
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # Decode and verify the token
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],  # Reject alg=none, HS256, etc. Require asymmetric RS256.
            issuer=settings.CLERK_ISSUER_URL,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": False,  
                "require": ["exp", "iss", "sub"], # Explicitly require `sub` claim
            }
        )
        return payload
    except jwt.PyJWTError as e:
        # Never log the token or the secret details here.
        raise ValueError("Token validation failed")
