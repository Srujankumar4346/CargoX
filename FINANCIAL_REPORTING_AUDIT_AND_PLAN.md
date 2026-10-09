# AUDIT AND IMPLEMENTATION PLAN: CARGOX FINANCIAL CONTROL CENTER

## 1. Executive Summary & Architecture Context
CargoX is a production-grade, authoritative fleet transport management platform (Transport Service Provider model).
The current backend is powered by FastAPI, MongoDB with Beanie ODM, and Clerk authentication.
Financial invariants and isolation rules are strictly preserved:
- Financial invariant: `total_amount == amount_paid + amount_due`
- Driver settlement invariant: `total_payout == driver_payable + reimbursements - deductions`
- Service fee invariant: `driver_payable = customer_amount - (customer_amount * fee_pct / 100)`
- Role isolation: Customers see only customer invoices; Drivers see only net payouts/reimbursements; Admins retain full financial visibility.

## 2. Existing Reusable Financial Modules & Collections
1. **Invoice (`invoices`)**:
   - Fields: `subtotal`, `tax`, `discount`, `total_amount`, `amount_paid`, `amount_due`, `status`, `issued_at`, `due_at`, `request_id`, `customer_company_id`, `quotation_id`.
   - Index on `status`, `invoice_number`, `request_id`, `customer_company_id`.
2. **Payment (`payments`)**:
   - Fields: `invoice_id`, `amount`, `method`, `reference_number`, `notes`, `paid_at`, `recorded_by`.
   - Index on `invoice_id`, `reference_number`.
3. **DriverSettlement (`driver_settlements`)**:
   - Fields: `driver_id`, `period_start`, `period_end`, `customer_amount`, `service_fee_percentage`, `service_fee_amount`, `driver_payable_amount`, `base_pay`, `reimbursements`, `deductions`, `total_payout`, `status` (`DRAFT`, `PENDING_PAYMENT`, `PAID`, `CANCELLED`), `paid_at`, `generated_by`.
4. **TripExpense (`trip_expenses`)**:
   - Fields: `trip_id`, `amount`, `category` (`FUEL`, `TOLL`, `DRIVER_ALLOWANCE`, `MAINTENANCE`, `OTHER`), `status` (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`), `date`, `receipt_url`, `paid_by`.
5. **VehicleMaintenance (`vehicle_maintenance`)**:
   - Fields: `vehicle_id`, `maintenance_type`, `status` (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), `cost`, `scheduled_date`, `completed_date`.
6. **DeliveryRequest (`delivery_requests`) & Trip (`trips`) & Quotation (`quotations`)**:
   - Store route coordinates, actual distance, goods description, customer/recipient companies, vehicle & driver assignment timestamps, and accepted quotation pricing internals.

## 3. Financial Definition Audits & Core Rules
1. **Reporting Periods & Timezone Boundary**:
   - Default business timezone: `Asia/Kolkata` (UTC+05:30).
   - Week definition: Monday 00:00:00 to the next Monday 00:00:00 (half-open interval `[start_datetime, end_datetime)`).
   - Month definition: 1st of month 00:00:00 to 1st of next month 00:00:00 (half-open interval).
   - Custom date range: `[start_date 00:00:00, end_date + 1 day 00:00:00)`.
2. **The "New Week Starts at Zero" Invariant**:
   - Period-specific metrics (Period Invoiced Revenue, Period Cash Collected, Period Approved Expenses, Period Trips Completed) are computed via strict date filters on timestamps (`issued_at`, `paid_at`, `date`, `completed_at`). When a new week begins without transactions, these metrics evaluate naturally to 0.
   - Cumulative/Balance Sheet metrics (Outstanding Receivables as of period end, Cumulative Unpaid Settlements) inspect all open liabilities up to the end of the period, so historical unpaid debts are never erased or hidden.
   - Zero database mutations occur when a new week begins.
3. **Operational Profit Definition**:
   $$\text{Operational Cash Profit} = \text{Payments Collected (Period)} - \text{Approved Trip Expenses (Period)} - \text{Completed Maintenance Costs (Period)}$$
   $$\text{Period Operating Margin (Accrual)} = \text{Invoiced (Period)} - \text{Approved Expenses (Period)} - \text{Driver Payable Generated (Period)}$$
   Both metrics will be transparently labeled to prevent conflation of cash collected with invoiced revenue.
4. **Tax Accounting**:
   - Derived directly from `Invoice.tax` and `Invoice.subtotal`.
   - Tax charged vs collected: Tax charged on invoices issued in period vs tax portion collected.

## 4. Proposed Backend Endpoints & Architecture
Add router `/api/v1/admin/finance` (`app/api/v1/routes/admin_finance.py`):
1. `GET /api/v1/admin/finance/summary`:
   - Query params: `period_type` (`weekly`, `monthly`, `custom`), `reference_date` (ISO date), `start_date`, `end_date`.
   - Returns: Period overview cards (Charges, Collected, Expenses, Outstanding, Taxes, Driver Payables, Settlements Paid, Profit metrics) with start/end bounds and period navigation links.
2. `GET /api/v1/admin/finance/bookings`:
   - Returns period-bounded ledger rows with searchable pagination (Request #, Customer, Cargo, Route, Distance, Vehicle, Driver, Quotation, Invoice, Tax, Paid, Due, Expenses, Driver Payable, Settlement status).
3. `GET /api/v1/admin/finance/expenses`:
   - Expenses grouped by category (Fuel, Tolls, Driver Allowance, Maintenance, Other) with approval status breakdown.
4. `GET /api/v1/admin/finance/settlements`:
   - Driver settlements generated vs paid in period.
5. `GET /api/v1/admin/finance/bookings/{request_id}`:
   - Full 360-degree audit breakdown (Booking, Trip, Customer Charges, Approved Expenses, Driver Allocation, Audit Log).
6. `GET /api/v1/admin/finance/export/csv`:
   - Streamed CSV export matching on-screen calculations with timestamped filename.

## 5. Mobile-First Admin Frontend UI Design
1. **Web Admin Portal (`admin-frontend`)**:
   - Add dedicated "Financial Control Center" view with period switcher (Weekly, Monthly, Custom).
   - Responsive cards with touch-friendly 44px targets, horizontal carousel on mobile, stacked booking cards on small screens (`<768px`), dense data table on desktop.
   - Booking Detail slide-over / modal.
   - One-click CSV and printable PDF export.
2. **Operations Mobile App (`apps/operations-mobile`)**:
   - Add new `Finance` tab in Admin mode.
   - Single-column swipeable financial metric cards with week/month picker.
   - Stacked card view for bookings with status badges and full financial ledger modal.

## 6. Testing & Validation Plan
1. Backend test suite (`tests/test_financial_reporting.py`):
   - Zero-activity week returns zero period metrics while retaining outstanding debt.
   - Week boundary tests (Monday 00:00 to Monday 00:00 in Asia/Kolkata).
   - Month and Year boundary tests.
   - Historical week persistence.
   - Expense categorization and rejection exclusion.
   - Driver settlement generated vs paid date isolation.
   - Role protection: Non-admins blocked from financial reporting endpoints (HTTP 403).
   - Decimal precision accuracy (zero floating-point leaks).
2. Frontend verification:
   - TypeScript compilation clean on both `admin-frontend` and `operations-mobile`.
   - Responsive viewport check on phone dimensions.
