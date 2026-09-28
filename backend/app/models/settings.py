import uuid
from typing import Optional, Annotated
from datetime import datetime
from decimal import Decimal
from beanie import Document
from pydantic import Field, BeforeValidator
from bson import Decimal128

def convert_decimal128(v):
    if isinstance(v, Decimal128):
        return str(v)
    return v

DecimalType = Annotated[Decimal, BeforeValidator(convert_decimal128)]

class SystemSettings(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    cargox_upi_id: Optional[str] = None
    cargox_service_fee_percentage: DecimalType = Decimal('4.00')
    updated_at: datetime
    updated_by: uuid.UUID
    
    class Settings:
        name = "system_settings"
