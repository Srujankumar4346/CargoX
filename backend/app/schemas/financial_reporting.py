import uuid
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field

from app.models.enums import (
    DeliveryRequestStatus,
    InvoiceStatus,
    SettlementStatus,
    ExpenseCategory,
    ExpenseStatus
)

class PeriodBounds(BaseModel):
    period_type: str  # "weekly", "monthly", "custom"
    start_date: str   # ISO date YYYY-MM-DD
    end_date: str     # ISO date YYYY-MM-DD (exclusive boundary representation)
    display_range: str # e.g. "05 Oct 2026 – 11 Oct 2026"
    prev_period_start: Optional[str] = None
    next_period_start: Optional[str] = None
    timezone: str = "Asia/Kolkata"

class FinancialSummaryCards(BaseModel):
    # Customer charges & Invoicing
    period_customer_charges: Decimal = Decimal("0.00")  # Invoices issued in period
    total_invoices_issued: int = 0
    total_accepted_quotations: int = 0
    accepted_quotations_value: Decimal = Decimal("0.00")
    
    # Cash collected in period
    payments_collected: Decimal = Decimal("0.00")  # Payments recorded in period
    payment_transactions_count: int = 0
    
    # Cumulative balance sheet as of period end
    outstanding_receivables: Decimal = Decimal("0.00")  # Cumulative unpaid invoice balance up to period end
    unpaid_invoices_count: int = 0
    partially_paid_invoices_count: int = 0
    
    # Operating expenditures in period
    approved_operating_expenses: Decimal = Decimal("0.00") # Approved TripExpense + Completed VehicleMaintenance
    approved_trip_expenses: Decimal = Decimal("0.00")
    completed_vehicle_maintenance: Decimal = Decimal("0.00")
    pending_expenses_count: int = 0
    pending_expenses_amount: Decimal = Decimal("0.00")
    
    # Taxes
    tax_charged_period: Decimal = Decimal("0.00")  # Tax on invoices issued in period
    taxable_value_period: Decimal = Decimal("0.00") # Subtotal on invoices issued in period
    
    # Driver settlements
    driver_payable_generated: Decimal = Decimal("0.00") # Driver payable generated on settlements in period
    driver_settlements_paid: Decimal = Decimal("0.00")   # Settlements paid during period
    driver_settlement_liabilities: Decimal = Decimal("0.00") # Outstanding unpaid settlements
    
    # Profitability metrics (transparently labeled)
    cash_operating_profit: Decimal = Decimal("0.00") # payments_collected - approved_operating_expenses
    accrual_operating_margin: Decimal = Decimal("0.00") # period_customer_charges - approved_operating_expenses - driver_payable_generated
    
    # Counts
    total_bookings: int = 0
    completed_trips: int = 0
    
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class FinancialReportSummaryResponse(BaseModel):
    period: PeriodBounds
    summary: FinancialSummaryCards

class ExpenseCategoryItem(BaseModel):
    category: str
    submitted_count: int = 0
    submitted_amount: Decimal = Decimal("0.00")
    approved_count: int = 0
    approved_amount: Decimal = Decimal("0.00")
    rejected_count: int = 0
    rejected_amount: Decimal = Decimal("0.00")
    pending_count: int = 0
    pending_amount: Decimal = Decimal("0.00")

class FinancialExpensesResponse(BaseModel):
    period: PeriodBounds
    categories: List[ExpenseCategoryItem]
    vehicle_maintenance_completed: Decimal = Decimal("0.00")
    total_approved_operating_expenses: Decimal = Decimal("0.00")

class SettlementSummaryResponse(BaseModel):
    period: PeriodBounds
    settlements_generated_count: int = 0
    driver_payable_generated: Decimal = Decimal("0.00")
    service_fee_generated: Decimal = Decimal("0.00")
    reimbursements_generated: Decimal = Decimal("0.00")
    deductions_generated: Decimal = Decimal("0.00")
    total_payout_generated: Decimal = Decimal("0.00")
    
    settlements_paid_count: int = 0
    total_payout_paid: Decimal = Decimal("0.00")
    
    pending_payment_count: int = 0
    outstanding_settlement_liability: Decimal = Decimal("0.00")

class TaxBreakdownResponse(BaseModel):
    period: PeriodBounds
    taxable_value: Decimal = Decimal("0.00")
    tax_amount: Decimal = Decimal("0.00")
    total_invoiced_with_tax: Decimal = Decimal("0.00")
    invoice_count: int = 0

class BookingLedgerRow(BaseModel):
    request_id: uuid.UUID
    request_number: str
    booking_date: datetime
    customer_name: str
    recipient_name: str
    goods_type: str
    goods_description: Optional[str] = None
    weight_tons: float
    pickup_address: str
    destination_address: str
    distance_km: Optional[Decimal] = None
    trip_status: DeliveryRequestStatus
    trip_id: Optional[uuid.UUID] = None
    vehicle_registration: Optional[str] = None
    driver_name: Optional[str] = None
    
    # Financial fields
    quotation_amount: Optional[Decimal] = None
    service_fee_amount: Optional[Decimal] = None
    driver_payable_amount: Optional[Decimal] = None
    
    invoice_id: Optional[uuid.UUID] = None
    invoice_number: Optional[str] = None
    taxable_subtotal: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    invoice_total: Optional[Decimal] = None
    amount_paid: Optional[Decimal] = None
    amount_due: Optional[Decimal] = None
    invoice_status: Optional[InvoiceStatus] = None
    
    approved_trip_expenses: Decimal = Decimal("0.00")
    settlement_status: Optional[SettlementStatus] = None

class BookingLedgerResponse(BaseModel):
    period: PeriodBounds
    total_records: int
    page: int
    page_size: int
    bookings: List[BookingLedgerRow]

class BookingExpenseDetail(BaseModel):
    id: uuid.UUID
    category: ExpenseCategory
    amount: Decimal
    status: ExpenseStatus
    date: datetime
    description: Optional[str] = None
    receipt_url: Optional[str] = None

class BookingFinancial360Detail(BaseModel):
    # A. Booking info
    request_id: uuid.UUID
    request_number: str
    created_at: datetime
    customer_company_name: str
    recipient_company_name: str
    goods_type: str
    goods_description: Optional[str] = None
    weight_tons: float
    pickup_address: str
    pickup_contact: Optional[str] = None
    destination_address: str
    destination_contact: Optional[str] = None
    distance_km: Optional[Decimal] = None
    booking_status: DeliveryRequestStatus
    
    # B. Trip info
    trip_id: Optional[uuid.UUID] = None
    vehicle_registration: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    assigned_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    pod_url: Optional[str] = None
    pod_receiver: Optional[str] = None
    
    # C. Customer charges & invoice
    quotation_id: Optional[uuid.UUID] = None
    quotation_amount: Optional[Decimal] = None
    invoice_id: Optional[uuid.UUID] = None
    invoice_number: Optional[str] = None
    taxable_subtotal: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    discount: Optional[Decimal] = None
    invoice_total: Optional[Decimal] = None
    amount_paid: Optional[Decimal] = None
    amount_due: Optional[Decimal] = None
    invoice_status: Optional[InvoiceStatus] = None
    issued_at: Optional[datetime] = None
    
    # D. Expenditures on trip
    expenses: List[BookingExpenseDetail]
    total_approved_expenses: Decimal = Decimal("0.00")
    
    # E. Driver Allocation snapshot
    service_fee_percentage: Optional[Decimal] = None
    service_fee_amount: Optional[Decimal] = None
    driver_payable_amount: Optional[Decimal] = None
    reimbursements: Optional[Decimal] = None
    deductions: Optional[Decimal] = None
    settlement_status: Optional[SettlementStatus] = None
    settlement_id: Optional[uuid.UUID] = None
