from fastapi import APIRouter, Depends, HTTPException, status, Query
from decimal import Decimal
from typing import Optional
import uuid

from app.api.deps import get_current_customer_user
from app.models.user import User
from app.schemas.quotation import CustomerQuotationRead
from app.schemas.pricing import PricingConfigRead, CustomerPriceEstimateRead
from app.services.pricing_engine import PricingEngineService

router = APIRouter()

@router.get("/pricing/estimate", response_model=CustomerPriceEstimateRead)
async def get_customer_pricing_estimate(
    distance_km: Decimal = Query(..., gt=Decimal("0"), description="Distance in km"),
    weight_tons: Optional[float] = Query(None, description="Cargo weight in tons"),
    vehicle_capacity_tons: Optional[float] = Query(None, description="Vehicle capacity in tons"),
    special_handling: Optional[str] = Query(None, description="Special handling e.g. Fragile, Delicate, Hazardous, Refrigerated"),
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Returns an informational price estimate for customers based on active PricingConfig.
    Itemizes distance charges, vehicle capacity surcharges, and special handling care fees.
    """
    # Overload validation
    if vehicle_capacity_tons and weight_tons and float(weight_tons) > float(vehicle_capacity_tons):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cargo weight ({weight_tons} Tons) exceeds vehicle maximum capacity ({vehicle_capacity_tons} Tons)."
        )

    active_config = await PricingEngineService.get_active_pricing_config()
    base_rate = Decimal(str(active_config.base_rate_per_km))
    margin_rate = Decimal(str(active_config.margin_per_km))
    customer_rate = base_rate + margin_rate
    dist = Decimal(str(distance_km))

    base_flat = Decimal(str(getattr(active_config, "base_flat_fare", Decimal("200.00"))))

    # Scale base fare and distance charge according to vehicle size/payload category:
    # A 6-ton BharatBenz or 5-ton Eicher costs significantly more than a 1-ton Tata Ace.
    # Default to 1.0 multiplier when vehicle_capacity_tons is not passed or <= 1.0 Ton.
    cap_multiplier = Decimal("1.0")
    if vehicle_capacity_tons:
        v_cap = float(vehicle_capacity_tons)
        if v_cap <= 1.0:
            cap_multiplier = Decimal("1.0")
        elif v_cap <= 1.5:
            cap_multiplier = Decimal("1.25")
        elif v_cap <= 2.0:
            cap_multiplier = Decimal("1.50")
        elif v_cap <= 2.5:
            cap_multiplier = Decimal("1.80")
        elif v_cap <= 5.0:
            cap_multiplier = Decimal("2.60")
        else:
            cap_multiplier = Decimal("3.20")

    base_flat = (base_flat * cap_multiplier).quantize(Decimal("0.01"))
    distance_charge = (dist * customer_rate * cap_multiplier).quantize(Decimal("0.01"))

    # Surcharges
    capacity_surcharge = Decimal("0.00")
    cap_enabled = getattr(active_config, "capacity_surcharge_enabled", True)
    cap_threshold_pct = float(getattr(active_config, "capacity_utilization_threshold_percent", Decimal("85.00")))
    if cap_enabled and vehicle_capacity_tons and weight_tons:
        if (float(weight_tons) / float(vehicle_capacity_tons) * 100.0) >= cap_threshold_pct:
            capacity_surcharge = Decimal(str(getattr(active_config, "vehicle_max_capacity_surcharge", Decimal("150.00"))))

    handling_surcharge = Decimal("0.00")
    if special_handling:
        h_str = special_handling.lower()
        if getattr(active_config, "fragile_surcharge_enabled", True) and ("fragile" in h_str or "delicate" in h_str or "handle with care" in h_str):
            handling_surcharge = Decimal(str(getattr(active_config, "fragile_surcharge", Decimal("100.00"))))
        elif getattr(active_config, "hazardous_surcharge_enabled", True) and ("hazardous" in h_str or "sensitive" in h_str):
            handling_surcharge = Decimal(str(getattr(active_config, "hazardous_surcharge", Decimal("200.00"))))
        elif getattr(active_config, "refrigerated_surcharge_enabled", True) and ("refrigerated" in h_str or "cold" in h_str):
            handling_surcharge = Decimal(str(getattr(active_config, "refrigerated_surcharge", Decimal("250.00"))))

    estimated_total = (base_flat + distance_charge + capacity_surcharge + handling_surcharge).quantize(Decimal("0.01"))

    return CustomerPriceEstimateRead(
        distance_km=dist,
        customer_rate_per_km=customer_rate,
        base_fare=base_flat,
        distance_charge=distance_charge,
        capacity_surcharge=capacity_surcharge,
        handling_surcharge=handling_surcharge,
        estimated_total=estimated_total,
        currency="INR"
    )

@router.get("/pricing/active", response_model=PricingConfigRead)
async def get_active_pricing_config(
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Returns the currently active pricing configuration for customers.
    """
    return await PricingEngineService.get_active_pricing_config()

@router.get("/{quotation_id}", response_model=CustomerQuotationRead)
async def get_customer_quotation(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Returns a customer quotation with internal cost/margin fields stripped.
    Enforces customer company tenant isolation (returns 404 if unauthorized).
    """
    return await PricingEngineService.get_customer_quotation(quotation_id, current_user)

@router.post("/{quotation_id}/accept", response_model=CustomerQuotationRead)
async def accept_customer_quotation(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Customer accepts a quotation.
    Atomically updates quotation and delivery request status to ACCEPTED.
    """
    return await PricingEngineService.accept_quotation(quotation_id, current_user)

@router.post("/{quotation_id}/reject", response_model=CustomerQuotationRead)
async def reject_customer_quotation(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Customer rejects a quotation.
    Atomically updates quotation and delivery request status to REJECTED.
    """
    return await PricingEngineService.reject_quotation(quotation_id, current_user)
