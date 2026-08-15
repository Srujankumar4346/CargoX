from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.base import Base
from app.db.database import engine
from app.models import *
from app.api.routes import api_router

app = FastAPI(
    title="CargoX API",
    description="API for CargoX Transport Management System",
    version="1.0.0"
)

app.include_router(api_router, prefix="/api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to CargoX API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
