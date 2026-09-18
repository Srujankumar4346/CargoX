import pymongo
import uuid
from typing import Optional
from datetime import datetime
from decimal import Decimal
from beanie import Document
from pydantic import Field
from app.models.enums import QuotationStatus

class PricingConfig(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    base_rate_per_km: Decimal
    margin_per_km: Decimal
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
    distance_km: Decimal
    base_rate_per_km: Decimal
    internal_base_cost: Decimal
    cargox_margin: Decimal
    customer_total_charge: Decimal
    status: QuotationStatus = QuotationStatus.PENDING # type: ignore
    created_at: datetime
    accepted_at: Optional[datetime] = None
    expires_at: datetime
    
    class Settings:
        name = "quotations"
        indexes = [
            pymongo.IndexModel("status")
        ]
