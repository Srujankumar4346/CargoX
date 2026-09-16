import pytest
import jwt
from unittest.mock import MagicMock
from datetime import datetime, timedelta, timezone
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

from app.core.security import decode_token
from app.core.config import settings

# Generate a mock RSA keypair for testing
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend()
)
public_key = private_key.public_key()
public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

@pytest.fixture(autouse=True)
def mock_jwks_client(mocker):
    # Mock the jwks_client to return our test public key
    mock_signing_key = MagicMock()
    mock_signing_key.key = public_pem
    mocker.patch('app.core.security.jwks_client.get_signing_key_from_jwt', return_value=mock_signing_key)

def create_mock_jwt(payload_overrides=None, headers_overrides=None, alg="RS256", sign_key=private_key):
    payload = {
        "iss": settings.CLERK_ISSUER_URL,
        "sub": "user_123",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
    }
    if payload_overrides:
        payload.update(payload_overrides)
        
    headers = {"kid": "mock_kid"}
    if headers_overrides:
        headers.update(headers_overrides)
        
    return jwt.encode(payload, sign_key, algorithm=alg, headers=headers)

def test_valid_rs256_token():
    token = create_mock_jwt()
    payload = decode_token(token)
    assert payload["sub"] == "user_123"

def test_invalid_signature():
    # Sign with a different key
    wrong_key = rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())
    token = create_mock_jwt(sign_key=wrong_key)
    with pytest.raises(ValueError, match="Token validation failed"):
        decode_token(token)

def test_expired_token():
    token = create_mock_jwt(payload_overrides={
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1)
    })
    with pytest.raises(ValueError, match="Token validation failed"):
        decode_token(token)

def test_wrong_issuer():
    token = create_mock_jwt(payload_overrides={"iss": "https://wrong.issuer.com"})
    with pytest.raises(ValueError, match="Token validation failed"):
        decode_token(token)

def test_missing_sub():
    payload = {
        "iss": settings.CLERK_ISSUER_URL,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
    }
    token = jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": "mock_kid"})
    with pytest.raises(ValueError, match="Token validation failed"):
        decode_token(token)

def test_missing_exp():
    payload = {
        "iss": settings.CLERK_ISSUER_URL,
        "sub": "user_123"
    }
    token = jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": "mock_kid"})
    with pytest.raises(ValueError, match="Token validation failed"):
        decode_token(token)

def test_missing_iss():
    payload = {
        "sub": "user_123",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
    }
    token = jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": "mock_kid"})
    with pytest.raises(ValueError, match="Token validation failed"):
        decode_token(token)

def test_alg_none(mocker):
    # PyJWT has a setting to explicitly reject alg=none unless configured otherwise.
    # To even test it, we bypass creation validation by raw stringing or using PyJWT insecure options,
    # but PyJWT automatically throws on alg=none when encode is used without an empty key.
    # We will simulate a malformed token.
    token = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ."
    with pytest.raises(ValueError, match="Token validation failed"):
        decode_token(token)

def test_hs256_token():
    # Attempt to pass an HS256 token
    # Using a 32-byte key to prevent InsecureKeyLengthWarning
    secret_32 = b"super_secret_key_that_is_32_bytes_long!!"
    token = jwt.encode({
        "iss": settings.CLERK_ISSUER_URL,
        "sub": "user_123",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
    }, secret_32, algorithm="HS256", headers={"kid": "mock_kid"})
    with pytest.raises(ValueError, match="Token validation failed"):
        decode_token(token)

def test_malformed_token():
    with pytest.raises(ValueError, match="Token validation failed"):
        decode_token("not.a.token")

def test_unknown_kid(mocker):
    # If the key is not in the JWKS, PyJWKClient raises PyJWKClientError
    mocker.patch('app.core.security.jwks_client.get_signing_key_from_jwt', side_effect=jwt.PyJWKClientError("Unable to find a signing key that matches"))
    token = create_mock_jwt()
    with pytest.raises(ValueError, match="Token validation failed"):
        decode_token(token)
