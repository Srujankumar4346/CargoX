from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
import uuid
from typing import Optional
from datetime import datetime

class PricingConfigCreate(BaseModel):
    base_rate_per_km: Decimal = Field(..., gt=Decimal("0"), description="Base rate per km in INR")
    margin_per_km: Decimal = Field(..., ge=Decimal("0"), description="Margin per km in INR")
    base_flat_fare: Optional[Decimal] = Field(default=Decimal("500.00"), ge=Decimal("0"), description="Base booking fare")
    base_distance_km: Optional[Decimal] = Field(default=Decimal("0.00"), ge=Decimal("0"), description="Included base distance threshold in km")
    part_load_min_freight: Optional[Decimal] = Field(default=Decimal("350.00"), ge=Decimal("0"), description="Part Load minimum freight")
    part_load_base_weight_kg: Optional[Decimal] = Field(default=Decimal("250.00"), ge=Decimal("0"), description="Part Load base weight included")
    part_load_rate_per_kg: Optional[Decimal] = Field(default=Decimal("7.00"), ge=Decimal("0"), description="Part Load rate per kg above base weight")
    part_load_rate_per_km: Optional[Decimal] = Field(default=Decimal("12.00"), ge=Decimal("0"), description="Part Load rate per km")
    part_load_volumetric_ratio: Optional[Decimal] = Field(default=Decimal("5000.00"), gt=Decimal("0"), description="Volumetric divisor cm3/kg")
    capacity_surcharge_enabled: Optional[bool] = Field(default=True, description="Whether capacity surcharge is enabled")
    capacity_utilization_threshold_percent: Optional[Decimal] = Field(default=Decimal("85.00"), ge=Decimal("0"), le=Decimal("100"), description="Threshold percent for capacity surcharge")
    vehicle_max_capacity_surcharge: Optional[Decimal] = Field(default=Decimal("600.00"), ge=Decimal("0"), description="Surcharge when reaching vehicle max capacity")
    fragile_surcharge_enabled: Optional[bool] = Field(default=True, description="Whether fragile surcharge is enabled")
    fragile_surcharge: Optional[Decimal] = Field(default=Decimal("400.00"), ge=Decimal("0"), description="Surcharge for fragile/delicate cargo")
    hazardous_surcharge_enabled: Optional[bool] = Field(default=True, description="Whether hazardous surcharge is enabled")
    hazardous_surcharge: Optional[Decimal] = Field(default=Decimal("700.00"), ge=Decimal("0"), description="Surcharge for hazardous cargo")
    refrigerated_surcharge_enabled: Optional[bool] = Field(default=True, description="Whether refrigerated surcharge is enabled")
    refrigerated_surcharge: Optional[Decimal] = Field(default=Decimal("800.00"), ge=Decimal("0"), description="Surcharge for refrigerated cargo")
    effective_from: Optional[datetime] = None

class PricingConfigRead(BaseModel):
    id: uuid.UUID
    base_rate_per_km: Decimal
    margin_per_km: Decimal
    base_flat_fare: Decimal = Decimal("500.00")
    base_distance_km: Decimal = Decimal("0.00")
    part_load_min_freight: Decimal = Decimal("350.00")
    part_load_base_weight_kg: Decimal = Decimal("250.00")
    part_load_rate_per_kg: Decimal = Decimal("7.00")
    part_load_rate_per_km: Decimal = Decimal("12.00")
    part_load_volumetric_ratio: Decimal = Decimal("5000.00")
    capacity_surcharge_enabled: bool = True
    capacity_utilization_threshold_percent: Decimal = Decimal("85.00")
    vehicle_max_capacity_surcharge: Decimal = Decimal("600.00")
    fragile_surcharge_enabled: bool = True
    fragile_surcharge: Decimal = Decimal("400.00")
    hazardous_surcharge_enabled: bool = True
    hazardous_surcharge: Decimal = Decimal("700.00")
    refrigerated_surcharge_enabled: bool = True
    refrigerated_surcharge: Decimal = Decimal("800.00")
    effective_from: datetime
    effective_until: Optional[datetime] = None
    active: bool
    created_by: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CustomerPriceEstimateRead(BaseModel):
    distance_km: Decimal
    customer_rate_per_km: Decimal
    base_fare: Decimal = Decimal("500.00")
    distance_charge: Decimal = Decimal("0.00")
    capacity_surcharge: Decimal = Decimal("0.00")
    handling_surcharge: Decimal = Decimal("0.00")
    estimated_total: Decimal
    currency: str = "INR"

    model_config = ConfigDict(from_attributes=True)
