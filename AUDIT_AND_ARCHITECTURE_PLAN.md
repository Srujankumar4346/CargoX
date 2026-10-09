# CargoX: Architecture Audit & Mobile Transformation Plan

## 1. Executive Summary & Audit Baseline
We conducted an in-depth audit of the existing **CargoX** codebase (backend FastAPI + MongoDB Beanie, web Admin Portal, web Customer Portal, and Driver PWA).

### Baseline Test Suite Status
- **Backend Test Suite**: All **140 tests passed** (`pytest -v`).
- **Core State Machine & RBAC**: Fully verified across 11 existing phases.
- **Authoritative Business Model**: CargoX is a closed Transport Service Provider controlling fleet and drivers (not an open marketplace). Customers never choose vehicles; pricing, margin, driver payables, and allocations are backend-controlled and isolated.

---

## 2. Existing Architecture & Integrity Verification

### 2.1 Backend Models & Database (MongoDB / Beanie)
| Entity | Key Integrity Rules | Current Implementation Status |
| :--- | :--- | :--- |
| `User` & `Driver` | RBAC roles (`ADMIN`, `CUSTOMER_USER`, `DRIVER`). Driver has local credential authentication (`/api/v1/auth/driver-login`) + optional Clerk auth. Admin has email/Clerk auto-promotion. | **VERIFIED** |
| `DeliveryRequest` | Request lifecycle: `SUBMITTED` → `ACCEPTED` → `VEHICLE_ASSIGNED` → `DRIVER_ASSIGNED` → `PICKUP_IN_PROGRESS` → `IN_TRANSIT` → `ARRIVED` → `POD_SUBMITTED` → `DELIVERED` → `COMPLETED`. | **VERIFIED** |
| `Quotation` | Immutable snapshot of `distance_km`, `internal_base_cost`, `cargox_margin`, `customer_total_charge`, `service_fee_amount`, `driver_payable_amount`. | **VERIFIED** |
| `Invoice` | Frozen from accepted Quotation. Fields: `subtotal`, `tax`, `total_amount`, `amount_paid`, `amount_due`. Customer never sees internal costs or margin. | **VERIFIED** |
| `Payment` & UPI | UPI URI generated from `invoice.amount_due` and admin-configured `cargox_upi_id`. Payment recording strictly requires Admin verification. | **VERIFIED** |
| `DriverSettlement` | Approved Phase 11 formula: `driver_payable_amount + reimbursements - deductions`. State machine: `DRAFT` → `PENDING_PAYMENT` → `PAID` / `CANCELLED`. | **VERIFIED** |
| `SystemSettings` | Holds `cargox_upi_id` and default service fee percentage. | **VERIFIED** |

### 2.2 Security & Isolation Audit
- **Customer Isolation**: Customer endpoints enforce `customer_company_id` scoping; attempting to access another company's request, quote, or invoice returns `404 Not Found`. Internal cost/margin fields are strictly filtered out in `CustomerQuotationRead` and `CustomerInvoiceRead`.
- **Driver Isolation**: Driver endpoints only expose trips assigned to the active driver's `user_id`. Customer invoices and internal margins are blocked from driver responses.
- **Admin Security**: Protected with `get_current_admin`. Role tampering on client side is impossible because roles are resolved from backend claims.

---

## 3. Gap Analysis for Mobile-First Production Platform

### 3.1 Gaps Identified
1. **Absence of Dedicated Cross-Platform Mobile Applications**:
   - The current repository only provides web applications (`customer-frontend` and `admin-frontend`).
   - Mobile-first React Native / Expo apps with true native capabilities (background GPS, secure keychain storage, offline queuing, native camera for POD) are required:
     - **App 1**: `CargoX Customer` (`apps/customer-mobile`)
     - **App 2**: `CargoX Operations` (`apps/operations-mobile`) with distinct Admin and Driver workspaces.
2. **Backend API Enhancements Needed (Preserving Existing Contracts)**:
   - **Distance Calculation Endpoint**: Backend endpoint to compute driving distance and route coordinates between two coordinate pairs/addresses without client-side fake distance fallback.
   - **Driver Settlement Visibility Endpoint**: Driver-safe endpoint allowing authenticated drivers to view their own settlement summaries (showing only driver payable, status, reference number—no customer invoice totals or internal margins).
   - **Service Fee Admin Setting Endpoint**: Extend `admin_settings.py` so admins can update the service fee percentage (0-100%) in addition to the UPI ID.
   - **Push Notification Token Registration**: Endpoints to register device push tokens (Expo / FCM / APNS) for real-time operational notifications without battery-draining continuous polling.
3. **Eco-Friendly Mobile Architecture**:
   - Native background location tracking must use intelligent distance filters (`distanceFilter: 25m`) and stationary throttling rather than continuous high-frequency GPS pinging.
   - Client-side image compression for POD (target < 500 KB per photo).
   - Local offline SQLite/AsyncStorage cache for trips and sync queue when network is lost.

---

## 4. Mobile Architecture Blueprint

### 4.1 Applications Structure
```
cargox/
├── backend/                  # Authoritative FastAPI + Beanie backend
├── apps/
│   ├── customer-mobile/      # CargoX Customer (React Native + Expo + TS)
│   │   ├── src/
│   │   │   ├── navigation/   # Home, Bookings, Trips, Invoices, Profile
│   │   │   ├── screens/      # Booking wizard, Active tracking, UPI Pay
│   │   │   ├── services/     # API client, secure storage, offline cache
│   │   │   └── theme/        # Deep Slate, Indigo, Blue, crisp typography
│   │   └── app.json          # Package: com.cargox.customer
│   │
│   └── operations-mobile/    # CargoX Operations (React Native + Expo + TS)
│       ├── src/
│       │   ├── auth/         # Branded portal switcher: Driver Portal | Admin Portal
│       │   ├── admin/        # Dashboard, Dispatch, Fleet, Drivers, Invoices, Settlements, Settings
│       │   ├── driver/       # Current Trip, Step-by-Step execution, GPS, POD Camera, History
│       │   ├── services/     # Background GPS engine, offline sync, compression
│       │   └── theme/        # Unified CargoX design system
│       └── app.json          # Package: com.cargox.operations
```

### 4.2 Authentication Flow & Role Routing
- **Operations App**:
  - Branded selection screen: **[ DRIVER PORTAL ]** and **[ ADMIN PORTAL ]**.
  - Driver login authenticates against `/api/v1/auth/driver-login` using driver credentials.
  - Admin login authenticates via Clerk or backend admin token.
  - Backend `/api/v1/auth/me` verifies real role. If a driver attempts Admin access: display *"Access restricted to administrators"* and route to Driver workspace. If Customer attempts Operations login: access is denied.
- **Customer App**:
  - Dedicated Customer login/signup. If non-customer enters: access denied.

### 4.3 End-to-End Workflow Execution Matrix
1. **Customer**: Books transport with Cargo, Weight (>0), Pickup, Destination coordinates. Backend validates distance and active pricing.
2. **Admin**: Receives request, inspects distance and map route, approves request, and issues Quotation.
3. **Customer**: Reviews estimated transport charge (no internal margins shown) and accepts quotation.
4. **Admin**: Selects available vehicle (capacity >= weight) and available driver.
5. **Driver**: Receives trip in Operations App → Navigates to pickup → Starts pickup → Starts transit → GPS updates battery-efficiently → Arrives at destination → Captures photo POD & notes.
6. **Admin**: Verifies POD → Marks delivered → Completes trip → Vehicle and driver are released back to AVAILABLE → Invoice generated.
7. **Customer**: Views invoice and amount due → Taps "Pay Now" → Displays dynamic UPI QR code (`amount_due`, Admin's configured UPI ID) → Pays via UPI app.
8. **Admin**: Verifies received payment → Records payment in system → Invoice status updates.
9. **Admin**: Generates driver settlement for the period using immutable allocation formula. Driver views their settlement details without internal financial leakage.

---

## 5. Phased Implementation Plan

- **Milestone 1**: Audit & Architecture Approval (Completed & Documented herein).
- **Milestone 2**: Backend API Enhancements (Distance calculation, driver settlement view, settings fee update, push token registration).
- **Milestone 3**: Customer Mobile App Setup (`apps/customer-mobile`) & Core Navigation.
- **Milestone 4**: Customer Booking, Tracking, Quotation Acceptance, & Invoices/UPI QR.
- **Milestone 5**: Operations Mobile App Setup (`apps/operations-mobile`) & Role-Based Entry.
- **Milestone 6**: Driver Workspace (Current Trip state machine, Navigation, Battery-Efficient GPS, Camera POD, Offline Sync).
- **Milestone 7**: Admin Mobile Workspace (Dashboard KPI cards, Request Review, Vehicle/Driver assignment, Settlements, Payment Verification, Settings).
- **Milestone 8**: Eco-Friendly Optimizations (Image compression, intelligent GPS sampling, offline sync queue).
- **Milestone 9**: Rigorous End-to-End & Security Auditing across all 65 requirements.
- **Milestone 10**: Production Store Readiness & Release Build Configuration.
