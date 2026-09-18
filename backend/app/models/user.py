import pymongo
from beanie import Document, Indexed
from pydantic import Field
from typing import Optional
import uuid
from app.models.enums import UserRole

class User(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    clerk_user_id: Optional[str] = Field(default=None) # type: ignore
    email: str # type: ignore
    role: UserRole
    customer_company_id: Optional[uuid.UUID] = None
    is_active: bool = True
    
    class Settings:
        name = "users"
        indexes = [
            pymongo.IndexModel("clerk_user_id", unique=True, sparse=True),
            pymongo.IndexModel("email", unique=True)
        ]
