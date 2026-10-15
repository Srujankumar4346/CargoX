from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List, Any

class Settings(BaseSettings):
    PROJECT_NAME: str = "CargoX API"
    ENVIRONMENT: str = "development"
    
    # DB
    DATABASE_URL: str = "mongodb://localhost:27017/cargox_test_db"
    
    # Security / Clerk
    # These must be configured in environment (.env).
    # We do not use symmetric keys; we use asymmetric JWKS verification.
    CLERK_ISSUER_URL: str = "https://awaited-raptor-7824.clerk.accounts.dev"
    CLERK_JWKS_URL: str = "https://awaited-raptor-7824.clerk.accounts.dev/.well-known/jwks.json"
    CLERK_SECRET_KEY: str | None = None
    
    # Optional backend internal secret if needed for non-Clerk internal flows
    # Must be set securely in prod.
    SECRET_KEY: str = "unsafe_default_key"
    ALGORITHM: str = "HS256"
    
    # RBAC
    CARGOX_PRIMARY_ADMIN_CLERK_ID: str | None = None
    CARGOX_PRIMARY_ADMIN_EMAIL: str = "srujankumar4346@gmail.com"
    
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
    
    # Payment Gateway — Razorpay (Indian Market UPI & Net Banking)
    RAZORPAY_KEY_ID: str | None = None
    RAZORPAY_KEY_SECRET: str | None = None
    RAZORPAY_WEBHOOK_SECRET: str | None = None
    RAZORPAY_WEBHOOK_URL: str | None = None
    
    # SMS Provider Configuration (e.g. Twilio, Fast2SMS, MSG91, or sandbox)
    SMS_PROVIDER: str = "sandbox"  # "sandbox", "twilio", "fast2sms"
    SMS_ENABLED: bool = False
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_FROM_NUMBER: str | None = None
    FAST2SMS_API_KEY: str | None = None
    
    # OTP Configuration
    DELIVERY_OTP_REQUIRED: bool = True
    DELIVERY_OTP_EXPIRY_SECONDS: int = 300  # 5 minutes
    DELIVERY_OTP_MAX_ATTEMPTS: int = 5
    DELIVERY_OTP_RESEND_COOLDOWN_SECONDS: int = 60
    DELIVERY_OTP_MAX_RESENDS: int = 3
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
