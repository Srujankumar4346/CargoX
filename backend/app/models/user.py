from sqlalchemy import Column, String, Boolean, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.enums import UserRole
import uuid
from sqlalchemy.dialects.postgresql import UUID

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    clerk_user_id = Column(String, unique=True, index=True, nullable=True) # Mapped from Clerk token
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    customer_company_id = Column(UUID(as_uuid=True), ForeignKey("customer_companies.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    company = relationship("CustomerCompany", back_populates="users")
    driver = relationship("Driver", back_populates="user", uselist=False)
