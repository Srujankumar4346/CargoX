from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List, Any

class Settings(BaseSettings):
    PROJECT_NAME: str = "CargoX API"
    ENVIRONMENT: str = "development"
    
    # DB
    DATABASE_URL: str
    
    # Security / Clerk
    # These must be configured in environment (.env).
    # We do not use symmetric keys; we use asymmetric JWKS verification.
    CLERK_ISSUER_URL: str = "https://awaited-raptor-7824.clerk.accounts.dev"
    CLERK_JWKS_URL: str = "https://awaited-raptor-7824.clerk.accounts.dev/.well-known/jwks.json"
    
    # Optional backend internal secret if needed for non-Clerk internal flows
    # Must be set securely in prod.
    SECRET_KEY: str = "unsafe_default_key"
    ALGORITHM: str = "HS256"
    
    # RBAC
    CARGOX_PRIMARY_ADMIN_CLERK_ID: str | None = None
    
    # CORS
    CORS_ORIGINS: Any = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "*"
    ]
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            v_clean = v.strip()
            if v_clean == "*":
                return ["*"]
            if not v_clean.startswith("["):
                return [i.strip() for i in v_clean.split(",") if i.strip()]
        return v
    
    # Paths
    UPLOAD_DIR: str = "uploads"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
