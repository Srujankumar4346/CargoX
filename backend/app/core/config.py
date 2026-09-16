from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "CargoX API"
    ENVIRONMENT: str = "development"
    
    # DB
    DATABASE_URL: str = "postgresql://cargox_user:cargox_password@localhost:5055/cargox"
    
    # Security
    SECRET_KEY: str = "super_secret_temporary_key_replace_in_prod" # Should be overridden in prod
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # Paths
    UPLOAD_DIR: str = "uploads"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
