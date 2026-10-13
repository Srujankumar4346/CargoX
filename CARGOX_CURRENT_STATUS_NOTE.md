# CargoX Git & Deployment Status Snapshot

**Date**: 2026-10-14  
**Branch**: `feature/location-routing-admin-pricing`  
**Current Commit**: `a3b5015` ("feat(customer): automatically detect user GPS location on launch instead of static defaults")

---

## 1. Web vs Mobile Architecture Overview

CargoX is architected so that:
1. **Web Version**: The web customer frontend (`customer-frontend`) is a responsive Single Page Application (Vite + React + TypeScript + Tailwind CSS). It runs as a full web app that can be accessed from any desktop, tablet, or mobile browser at `http://localhost:5173/` (or its production deployment URL `https://cargox-frontend.onrender.com/`).
2. **Mobile App**: The mobile customer app in `apps/customer-mobile` is a native wrapper powered by React Native / Expo (`WebView`) targeting Android APK (`com.cargox.customer`). It directly packages and loads the responsive web interface into a native Android environment with hardware back navigation, push handling, and deep links.

---

## 2. Customer Frontend Changes Staged / In Working Tree

| File | Status | Description |
|---|---|---|
| `customer-frontend/src/components/customer/WelcomeScreen.tsx` | Modified | Animated onboarding carousel, high-res truck graphics, responsive layout. |
| `customer-frontend/src/components/customer/CustomerHomeScreen.tsx` | Modified | Upgraded header, quick action cards, high-res vehicle catalog, real GPS status. |
| `customer-frontend/src/components/customer/SelectDropLocationScreen.tsx` | Modified | True OSRM road geometry, road distance (km) and duration (mins). Race condition token protection. |
| `customer-frontend/src/components/customer/PriceQuoteScreen.tsx` | Modified | Capacity validation, dynamic fare calculation based on road km, zero straight-line fallbacks. |
| `customer-frontend/src/components/customer/MyBookingsScreen.tsx` | Modified | Removed fake hardcoded bookings (`CRGX20261010-7990`, ₹7,850). Added genuine empty/loading/error states. |
| `customer-frontend/src/components/customer/MasterCustomerApp.tsx` | Modified | Live backend API mapping, state integration, and error handling for customer bookings. |
| `customer-frontend/public/images/` | Added/Updated | High-definition web vehicle assets and banners. |

---

## 3. Backend & Admin Integrations Staged / In Working Tree

| File | Status | Description |
|---|---|---|
| `backend/app/api/v1/routes/requests.py` | Modified | OSRM road topography calculation endpoint (`/calculate-route`). |
| `backend/app/services/pricing_engine.py` | Modified | Fixed falsy Decimal zero fallback bug across all surcharge fields. |
| `backend/tests/test_invoice.py` | Modified | Verified financial snapshot consistency, partial payment, and pricing estimate tests pass. |
| `admin-frontend/src/App.tsx` | Modified | Nested URL routing for Admin pages (`/admin/:tab`) and 404 handler. |
| `admin-frontend/src/pages/admin/AdminDashboard.tsx` | Modified | Bi-directional synchronization of active tabs with browser URLs and history navigation. |

---

## 4. Build Status

- **Customer Web Frontend (`customer-frontend`)**: `npm run build` -> **0 errors, build SUCCESS**
- **Admin Frontend (`admin-frontend`)**: `npm run build` -> **0 errors, build SUCCESS**
- **Driver Frontend (`driver-frontend`)**: `npm run build` -> **0 errors, build SUCCESS**
- **Backend Tests (`pytest tests/test_invoice.py`)**: -> **All tests PASSED**
