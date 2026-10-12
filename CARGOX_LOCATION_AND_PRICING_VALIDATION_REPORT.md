# CargoX Technical Report: Vehicle Capacity Validation and Correct Pricing Implementation

**Date:** October 13, 2026  
**Branch:** `feature/location-routing-admin-pricing`  
**Status:** Completed & Validated  
**Component Scope:** `backend`, `customer-frontend`, `admin-frontend`

---

## 1. Executive Summary

This engineering effort resolves the critical vehicle overload bug where customers requesting 5 tons (5,000 kg) of cargo were able to select and receive price quotations for vehicles rated for only 2 tons (2,000 kg). Strict payload capacity validation has been enforced across all application tiers: normalized unit conversion (kg / tons), server-side schema verification, dynamic client-side filtering, Admin pricing controls (including configurable surcharge toggles and capacity threshold percentages), and dispatch assignment safeguards.

Both frontends (`customer-frontend` and `admin-frontend`) build cleanly with zero errors, and all automated backend test suites pass 100%.

---

## 2. Root Cause Analysis of the Capacity Validation Defect

1. **Frontend Filtering Omission:**  
   The customer vehicle selection screen (`ChooseVehicleScreen.tsx`) mapped all mock and catalog vehicles to cards and fetched pricing estimates for every vehicle indiscriminately without checking `vehicle.maxPayloadKg >= cargoWeightKg`.
2. **Missing Schema & Request Validation:**  
   The backend `delivery_request` schema and creation endpoints accepted arbitrary cargo weights without requiring or validating against the chosen vehicle's maximum payload capacity.
3. **Quotation Engine Bypass:**  
   The pricing engine allowed quotation creation even when `weight_tons > vehicle_capacity_tons`, applying a capacity surcharge instead of treating payload overload as a critical rejection condition. Surcharges were treated as an extra fee rather than maintaining vehicle physical limits.
4. **Dispatch Service Reassignment Blindspot:**  
   The dispatch assignment logic assigned vehicles without asserting `vehicle.capacity_tons >= request.weight_tons`.

---

## 3. Enforcement Architecture: Frontend & Backend

### 3.1 Unit Normalization
- Cargo weight is entered in either kg or metric tons.
- 1 Metric Ton = 1,000 Kilograms.
- Frontend: `cargoWeightKg = Math.round(Number(cargoWeightTons) * 1000)`
- Backend: Standardized to metric tons (`weight_tons`, `Decimal("0.01")`) and compared uniformly against `vehicle_capacity_tons`.

### 3.2 Frontend Vehicle Filtering (`customer-frontend`)
- **Strict In-Memory Filtering:**  
  In [ChooseVehicleScreen.tsx](file:///c:/Users/sange/Desktop/transport%20services/customer-frontend/src/components/customer/ChooseVehicleScreen.tsx), each vehicle definition includes `maxPayloadTons` and `maxPayloadKg`:
  ```typescript
  const eligibleVehicles = allVehicles.filter(
    (v) => v.maxPayloadKg >= cargoWeightKg
  );
  ```
- **Targeted Estimation Queries:**  
  Price estimates are only queried from the backend for `eligibleVehicles`. Overloaded vehicles never receive quotes.
- **Empty State UX:**  
  When no fleet vehicle meets the requested cargo payload, the UI renders an informative empty state:
  > *"No suitable vehicle is currently available for this cargo weight (X kg). Please contact CargoX support or choose another delivery arrangement."*
  with a direct action button to contact CargoX Support.
- **Form Submission Guard:**  
  In [MasterCustomerApp.tsx](file:///c:/Users/sange/Desktop/transport%20services/customer-frontend/src/components/customer/MasterCustomerApp.tsx), `handleConfirmAndPay` verifies `cargoWeightKg <= selectedVehicle.maxPayloadKg` before allowing quotation acceptance or booking creation.

### 3.3 Backend Enforcement & API Integrity (`backend`)
- **Pydantic Model Validator ([delivery_request.py](file:///c:/Users/sange/Desktop/transport%20services/backend/app/schemas/delivery_request.py)):**
  ```python
  @model_validator(mode="after")
  def validate_capacity_eligibility(self) -> "DeliveryRequestCreate":
      if self.vehicle_capacity_tons is not None and self.weight_tons is not None:
          if self.weight_tons > self.vehicle_capacity_tons:
              raise ValueError(
                  f"Cargo weight ({self.weight_tons}t) exceeds selected vehicle maximum payload capacity ({self.vehicle_capacity_tons}t)."
              )
      return self
  ```
- **Pricing Engine Overload Rejection ([pricing_engine.py](file:///c:/Users/sange/Desktop/transport%20services/backend/app/services/pricing_engine.py)):**
  In `PricingEngineService.calculate_quote` and `generate_quotation`:
  ```python
  if weight_tons > vehicle_capacity_tons:
      raise HTTPException(
          status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
          detail=f"Cargo weight ({weight_tons}t) exceeds vehicle maximum capacity ({vehicle_capacity_tons}t). Vehicle is ineligible.",
      )
  ```
- **Customer Price Estimate Endpoint ([customer_quotations.py](file:///c:/Users/sange/Desktop/transport%20services/backend/app/api/v1/routes/customer_quotations.py)):**
  Validates `weight_tons <= vehicle_capacity_tons` before estimating fares. Rejects bypass attempts with HTTP 422.
- **Dispatch Assignment & Reassignment ([dispatch_service.py](file:///c:/Users/sange/Desktop/transport%20services/backend/app/services/dispatch_service.py)):**
  Rejects dispatching or reassigning an order to a vehicle if `vehicle.capacity_tons < request.weight_tons`.

---

## 4. Exact Pricing Formula & Admin Configuration

### 4.1 Persisted Admin Configuration Fields
Persisted in MongoDB collection `pricing_configs`:
- `base_flat_fare`: Base flat rate (e.g. ₹500.00).
- `customer_rate_per_km`: Distance rate (e.g. ₹25.00/km).
- `capacity_surcharge_enabled`: Boolean toggle.
- `capacity_utilization_threshold_percent`: Threshold percentage (default `85.0%`).
- `fragile_surcharge_enabled`: Boolean toggle.
- `hazardous_surcharge_enabled`: Boolean toggle.
- `refrigerated_surcharge_enabled`: Boolean toggle.

### 4.2 Formula
```
utilization_ratio = weight_tons / vehicle_capacity_tons

base_fare = config.base_flat_fare

distance_charge = verified_route_distance_km * config.customer_rate_per_km

capacity_surcharge = (
    config.surcharge_near_capacity 
    if (config.capacity_surcharge_enabled and utilization_ratio >= (config.capacity_utilization_threshold_percent / 100))
    else 0.00
)

handling_surcharge = sum(
    charge for item, charge in {
        "fragile": config.fragile_handling_charge if config.fragile_surcharge_enabled else 0,
        "hazardous": config.hazardous_cargo_surcharge if config.hazardous_surcharge_enabled else 0,
        "refrigerated": config.refrigerated_cargo_surcharge if config.refrigerated_surcharge_enabled else 0
    }.items() if item in request.special_handling
)

quote_total = base_fare + distance_charge + capacity_surcharge + handling_surcharge
```

### 4.3 Immutable Snapshots
Accepted quotations snapshot `base_fare`, `distance_charge`, `capacity_surcharge`, `handling_surcharge`, `total_amount`, and `pricing_config_id`. Later changes to Admin pricing do not alter previously accepted quotations or issued invoices.

---

## 5. Verified Routing Provider & Coordinate Integrity

- **Provider:** Project OSRM (Open Source Routing Machine) Driving Engine:
  `http://router.project-osrm.org/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}?overview=full&geometries=geojson`
- **Route Validation:**
  - Route calculation rejects requests where origin and destination coordinates are identical (< 0.0001 euclidean distance) with HTTP 400.
  - If OSRM fails or times out, the backend returns HTTP 502 with actionable error message; no fallback/fabricated distance is generated.
  - Modifying pickup or drop-off coordinates resets the calculated distance and invalidates any pending quotation.

---

## 6. Files Changed

| Component | Path | Changes |
|---|---|---|
| **Backend** | `backend/app/models/pricing.py` | Extended `PricingConfig` with surcharge toggles, threshold percent, base fare; extended `Quotation` with itemized charges. |
| **Backend** | `backend/app/schemas/pricing.py` | Added Admin configuration and estimate schema fields. |
| **Backend** | `backend/app/schemas/quotation.py` | Added `base_fare`, `distance_charge`, itemized fields to quotation schemas. |
| **Backend** | `backend/app/schemas/delivery_request.py` | Added `vehicle_capacity_tons` validator rejecting overloaded payloads with HTTP 422. |
| **Backend** | `backend/app/services/pricing_engine.py` | Implemented strict overload rejection, threshold utilization check, enabled toggles. |
| **Backend** | `backend/app/api/v1/routes/customer_quotations.py` | Enforced vehicle payload validation on customer price estimates. |
| **Backend** | `backend/app/api/v1/routes/admin_dispatch.py` | Aligned dispatch quotes with Admin pricing configuration. |
| **Backend** | `backend/app/api/v1/routes/requests.py` | Enforced coordinate validation on `/calculate-route`. |
| **Backend** | `backend/app/services/dispatch_service.py` | Enforced `vehicle.capacity_tons >= request.weight_tons` on vehicle assignment. |
| **Backend** | `backend/tests/test_pricing.py` | Added comprehensive automated tests for capacity validation, surcharges, and pricing snapshot immutability. |
| **Backend** | `backend/tests/conftest.py` | Configured test database fallback using `os.getenv("DATABASE_URL")`. |
| **Customer Frontend** | `customer-frontend/src/components/customer/ChooseVehicleScreen.tsx` | Added vehicle capacity filtering, empty state with support CTA, selective estimate queries. |
| **Customer Frontend** | `customer-frontend/src/components/customer/MasterCustomerApp.tsx` | Enforced overload prevention check before booking confirmation. |
| **Customer Frontend** | `customer-frontend/src/components/customer/SelectDropLocationScreen.tsx` | Added identical coordinates prevention check. |
| **Admin Frontend** | `admin-frontend/src/pages/admin/AdminDashboard.tsx` | Added UI controls for toggling surcharges and capacity threshold percent. |
| **Admin Frontend** | `admin-frontend/src/services/api.ts` | Updated API payload to send surcharge toggles and threshold settings. |

---

## 7. Test and Build Execution Results

### 7.1 Backend Automated Tests (`pytest`)
Command:
```powershell
$env:DATABASE_URL="mongodb+srv://srujankumar4346_db_user:xCa1k8X5kPLayJj5@cluster0.uifzidp.mongodb.net"; pytest tests/test_pricing.py tests/test_dispatch.py
```
Output:
```
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-9.1.1, pluggy-1.6.0
collected 25 items

tests/test_pricing.py .............                                      [52%]
tests/test_dispatch.py ............                                      [100%]

======================= 25 passed, 8 warnings in 74.98s =======================
```
**Key Test Scenarios Verified:**
1. `test_capacity_validation_excludes_under_capacity_vehicles`: 5.0t excludes 2.0t and 3.0t vehicles (HTTP 422).
2. `test_capacity_validation_permits_adequate_and_higher_capacity_vehicles`: 5.0t permits 5.0t and 6.0t vehicles.
3. `test_customer_estimate_strict_overload_rejection`: Direct API request cannot bypass capacity validation.
4. `test_surcharge_disabled_flags_respected`: Disabled surcharges are excluded from quote totals.
5. `test_quotation_versioning_immutability`: Accepted quotes retain original amounts after Admin pricing updates.
6. `test_dispatch_vehicle_capacity_validation`: Dispatch assignment rejects overloaded vehicles.

### 7.2 Frontend Production Builds
- **`customer-frontend`:**
  ```powershell
  npm run build
  # Output: tsc -b && vite build
  # ✓ built in 782ms - 0 errors
  ```
- **`admin-frontend`:**
  ```powershell
  npm run build
  # Output: tsc -b && vite build
  # ✓ built in 1.08s - 0 errors
  ```

---

## 8. Remaining Blockers
- **None.** All automated tests pass, production builds succeed, and all acceptance criteria are fully satisfied.
