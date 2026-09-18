from beanie import Document
from pydantic import Field
from typing import Optional
import uuid
from app.models.enums import CompanyStatus

class CustomerCompany(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    name: str
    billing_address: str
    gst_number: Optional[str] = None
    status: CompanyStatus = CompanyStatus.PENDING

    class Settings:
        name = "customer_companies"

class RecipientCompany(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    customer_company_id: uuid.UUID
    name: str
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    
    class Settings:
        name = "recipient_companies"
