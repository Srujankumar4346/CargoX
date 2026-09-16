from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
import uuid

class RecipientCompanyBase(BaseModel):
    name: str = Field(..., min_length=1)
    address: str = Field(..., min_length=1)
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)

class RecipientCompanyCreate(RecipientCompanyBase):
    pass

class RecipientCompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    address: Optional[str] = Field(None, min_length=1)
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)

class RecipientCompanyRead(RecipientCompanyBase):
    id: uuid.UUID
    # Explicity omitting customer_company_id per Phase 3 rules
    
    model_config = ConfigDict(from_attributes=True)
