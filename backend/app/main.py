import logging
import uuid
import time
from fastapi import FastAPI, Request, Response, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from slowapi.errors import RateLimitExceeded
from app.core.rate_limit import limiter
from app.db.base import Base
from app.db.database import engine, get_db
from app.models import *
from app.api.v1.routes import api_router
from app.core.config import settings

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("cargox")

# Limiter is now imported from app.core.rate_limit
# Disable docs in production if specified (or can be configured). For now, keep them.
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API for CargoX Transport Management System",
    version="1.0.0"
)

app.state.limiter = limiter
from slowapi import _rate_limit_exceeded_handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging and Security Headers Middleware
@app.middleware("http")
async def security_and_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Do not log sensitive info
    logger.info(f"Request {request_id}: {request.method} {request.url.path}")
    
    try:
        response: Response = await call_next(request)
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        logger.error(f"Request {request_id} failed after {process_time:.2f}ms: {str(e)}", exc_info=True)
        raise
        
    process_time = (time.time() - start_time) * 1000
    logger.info(f"Response {request_id}: {response.status_code} in {process_time:.2f}ms")
    
    # Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Only add HSTS in prod if HTTPS is used. Nginx is better suited for this, but we can add it here.
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
    return response

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to CargoX API"}

@app.get("/health")
def health_check():
    """Liveness probe"""
    return {"status": "alive"}

@app.get("/ready")
def readiness_check(db: Session = Depends(get_db)):
    """Readiness probe"""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return Response(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content="Database unavailable")
