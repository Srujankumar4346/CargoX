from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
import uuid
from typing import Optional
from datetime import datetime
from app.models.enums import QuotationStatus

class QuotationGenerate(BaseModel):
    distance_km: Decimal = Field(..., gt=Decimal("0"), description="Distance in kilometers")
    validity_hours: Optional[int] = Field(default=24, gt=0, description="Validity duration in hours")
    weight_tons: Optional[float] = None
    vehicle_capacity_tons: Optional[float] = None
    special_handling: Optional[str] = None

class QuotationBase(BaseModel):
    id: uuid.UUID
    request_id: uuid.UUID
    distance_km: Decimal
    base_fare: Optional[Decimal] = Decimal("500.00")
    distance_charge: Optional[Decimal] = Decimal("0.00")
    capacity_surcharge: Optional[Decimal] = Decimal("0.00")
    handling_surcharge: Optional[Decimal] = Decimal("0.00")
    customer_total_charge: Decimal
    load_type: Optional[str] = "PART_LOAD"
    billable_weight_kg: Optional[Decimal] = None
    gst_percentage: Optional[Decimal] = Decimal("5.00")
    gst_amount: Optional[Decimal] = Decimal("0.00")
    final_total_with_tax: Optional[Decimal] = None
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
