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
    base_flat_fare: DecimalType = Decimal("500.00")
    base_distance_km: DecimalType = Decimal("0.00")
    
    # Capacity Surcharge Rules
    capacity_surcharge_enabled: bool = True
    capacity_utilization_threshold_percent: DecimalType = Decimal("85.00")
    vehicle_max_capacity_surcharge: DecimalType = Decimal("600.00")
    
    # Handling Care Surcharge Rules
    fragile_surcharge_enabled: bool = True
    fragile_surcharge: DecimalType = Decimal("400.00")
    
    hazardous_surcharge_enabled: bool = True
    hazardous_surcharge: DecimalType = Decimal("700.00")
    
    refrigerated_surcharge_enabled: bool = True
    refrigerated_surcharge: DecimalType = Decimal("800.00")
    
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
    base_fare: Optional[DecimalType] = Decimal("500.00")
    distance_charge: Optional[DecimalType] = Decimal("0.00")
    capacity_surcharge: Optional[DecimalType] = Decimal("0.00")
    handling_surcharge: Optional[DecimalType] = Decimal("0.00")
    customer_total_charge: DecimalType
    service_fee_percentage: Optional[DecimalType] = None
    service_fee_amount: Optional[DecimalType] = None
    driver_payable_amount: Optional[DecimalType] = None
    vehicle_capacity_tons: Optional[DecimalType] = None
    selected_vehicle_id: Optional[str] = None
    status: QuotationStatus = QuotationStatus.PENDING # type: ignore
    created_at: datetime
    accepted_at: Optional[datetime] = None
    expires_at: datetime
    
    class Settings:
        name = "quotations"
        indexes = [
            pymongo.IndexModel("request_id"),
            pymongo.IndexModel("status"),
        ]
