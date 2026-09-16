from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
import uuid
from typing import Optional
from datetime import datetime
from app.models.enums import QuotationStatus

class QuotationGenerate(BaseModel):
    distance_km: Decimal = Field(..., gt=Decimal("0"), description="Distance in kilometers")
    validity_hours: Optional[int] = Field(default=24, gt=0, description="Validity duration in hours")

class QuotationBase(BaseModel):
    id: uuid.UUID
    request_id: uuid.UUID
    distance_km: Decimal
    customer_total_charge: Decimal
    status: QuotationStatus
    created_at: datetime
    accepted_at: Optional[datetime] = None
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CustomerQuotationRead(QuotationBase):
    pass

class AdminQuotationRead(QuotationBase):
    pricing_config_id: uuid.UUID
    base_rate_per_km: Decimal
    internal_base_cost: Decimal
    cargox_margin: Decimal
