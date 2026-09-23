from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
import uuid
from typing import Optional
from datetime import datetime

class PricingConfigCreate(BaseModel):
    base_rate_per_km: Decimal = Field(..., gt=Decimal("0"), description="Base rate per km in INR")
    margin_per_km: Decimal = Field(..., ge=Decimal("0"), description="Margin per km in INR")
    effective_from: Optional[datetime] = None

class PricingConfigRead(BaseModel):
    id: uuid.UUID
    base_rate_per_km: Decimal
    margin_per_km: Decimal
    effective_from: datetime
    effective_until: Optional[datetime] = None
    active: bool
    created_by: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CustomerPriceEstimateRead(BaseModel):
    distance_km: Decimal
    customer_rate_per_km: Decimal
    estimated_total: Decimal
    currency: str = "INR"

    model_config = ConfigDict(from_attributes=True)
