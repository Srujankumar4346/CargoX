import pymongo
import uuid
from typing import Optional, Annotated
from datetime import datetime
from decimal import Decimal
from beanie import Document
from bson import Decimal128
from pydantic import Field, BeforeValidator

def convert_decimal128(v):
    if isinstance(v, Decimal128):
        return str(v)
    return v

DecimalType = Annotated[Decimal, BeforeValidator(convert_decimal128)]
from app.models.enums import QuotationStatus

class PricingConfig(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    base_rate_per_km: DecimalType
    margin_per_km: DecimalType
    effective_from: datetime
    effective_until: Optional[datetime] = None
    active: bool = True
    created_by: uuid.UUID
    created_at: datetime
    
    class Settings:
        name = "pricing_configs"

        indexes = [
            pymongo.IndexModel("status")
        ]
class Quotation(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    request_id: uuid.UUID # type: ignore
    pricing_config_id: uuid.UUID
    distance_km: DecimalType
    base_rate_per_km: DecimalType
    internal_base_cost: DecimalType
    cargox_margin: DecimalType
    customer_total_charge: DecimalType
    status: QuotationStatus = QuotationStatus.PENDING # type: ignore
    created_at: datetime
    accepted_at: Optional[datetime] = None
    expires_at: datetime
    
    class Settings:
        name = "quotations"
        indexes = [
            pymongo.IndexModel("status")
        ]
