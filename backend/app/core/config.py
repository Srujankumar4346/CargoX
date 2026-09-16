from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "CargoX API"
    ENVIRONMENT: str = "development"
    
    # DB
    DATABASE_URL: str
    
    # Security / Clerk
    # These must be configured in environment (.env).
    # We do not use symmetric keys; we use asymmetric JWKS verification.
    CLERK_ISSUER_URL: str
    CLERK_JWKS_URL: str
    
    # Optional backend internal secret if needed for non-Clerk internal flows
    # Must be set securely in prod.
    SECRET_KEY: str = "unsafe_default_key"
    ALGORITHM: str = "HS256"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # Paths
    UPLOAD_DIR: str = "uploads"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
