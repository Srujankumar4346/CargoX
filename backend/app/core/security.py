import jwt
from jwt import PyJWKClient
from app.core.config import settings

# Initialize PyJWKClient to fetch and cache JWKS keys automatically
# It handles caching based on Cache-Control headers returned by the JWKS endpoint
# We only fetch keys from the trusted URL in our configuration, NEVER dynamically from a token header.
jwks_client = PyJWKClient(settings.CLERK_JWKS_URL, cache_keys=True)

from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext

import bcrypt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8')[:72], hashed_password.encode('utf-8'))
    except Exception:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8')[:72], salt).decode('utf-8')

def create_local_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=60*24*7) # 7 days
    to_encode.update({"exp": expire, "iss": "cargox_local"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_driver_token(data: dict) -> str:
    return create_local_token(data)

def decode_token(token: str) -> dict:
    """
    Decodes and verifies a JWT. Tries Clerk JWKS first, then local secret.
    """
    try:
        # Check if it's a local token by decoding headers without verification
        unverified_headers = jwt.get_unverified_header(token)
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        
        if unverified_payload.get("iss") == "cargox_local":
            return jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                issuer="cargox_local",
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iss": True,
                    "verify_aud": False,
                    "require": ["exp", "iss", "sub", "role"]
                }
            )
            
        # Otherwise, try Clerk
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # Accept either variant (with or without trailing slash) to prevent validation failures across environments
        expected_issuer = settings.CLERK_ISSUER_URL.rstrip("/")
        valid_issuers = [expected_issuer, f"{expected_issuer}/"]
        
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            leeway=60,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": False, # Verified below against allowed issuer variants
                "verify_aud": False,  
                "require": ["exp", "iss", "sub"],
            }
        )
        if payload.get("iss") not in valid_issuers:
            raise jwt.InvalidIssuerError(f"Invalid issuer: {payload.get('iss')}, expected one of {valid_issuers}")
        return payload
    except jwt.PyJWTError as e:
        print(f"Token validation failed with error: {e}")
        raise ValueError(f"Token validation failed: {e}")
