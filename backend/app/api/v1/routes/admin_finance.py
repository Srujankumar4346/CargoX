import csv
import io
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_admin
from app.models.user import User
from app.schemas.financial_reporting import (
    FinancialReportSummaryResponse,
    FinancialExpensesResponse,
    SettlementSummaryResponse,
    TaxBreakdownResponse,
    BookingLedgerResponse,
    BookingFinancial360Detail
)
from app.services.financial_reporting_service import FinancialReportingService

router = APIRouter()

@router.get("/reports/summary", response_model=FinancialReportSummaryResponse)
async def get_financial_summary(
    period: str = Query("weekly", pattern="^(weekly|monthly|custom)$", description="Reporting period type"),
    reference_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD to select containing period"),
    start_date: Optional[str] = Query(None, description="Start date for custom period (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for custom period (YYYY-MM-DD)"),
    current_admin: User = Depends(get_current_admin)
):
    """
    Returns high-level financial summary cards for the selected week, month or custom date range.
    Access restricted to Admin role.
    """
    try:
        return await FinancialReportingService.get_summary(
            period_type=period,
            reference_date_str=reference_date,
            start_date_str=start_date,
            end_date_str=end_date
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/reports/expenses", response_model=FinancialExpensesResponse)
async def get_expenses_breakdown(
    period: str = Query("weekly", pattern="^(weekly|monthly|custom)$"),
    reference_date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_admin)
):
    """
    Returns breakdown of operating expenses grouped by category and approval status.
    Access restricted to Admin role.
    """
    try:
        return await FinancialReportingService.get_expenses_breakdown(
            period_type=period,
            reference_date_str=reference_date,
            start_date_str=start_date,
            end_date_str=end_date
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/reports/settlements", response_model=SettlementSummaryResponse)
async def get_settlements_breakdown(
    period: str = Query("weekly", pattern="^(weekly|monthly|custom)$"),
    reference_date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_admin)
):
    """
    Returns driver settlements breakdown (generated vs paid vs outstanding).
    Access restricted to Admin role.
    """
    try:
        return await FinancialReportingService.get_settlements_breakdown(
            period_type=period,
            reference_date_str=reference_date,
            start_date_str=start_date,
            end_date_str=end_date
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/reports/taxes", response_model=TaxBreakdownResponse)
async def get_taxes_breakdown(
    period: str = Query("weekly", pattern="^(weekly|monthly|custom)$"),
    reference_date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_admin)
):
    """
    Returns tax breakdown for invoices issued in the selected period.
    Access restricted to Admin role.
    """
    try:
        return await FinancialReportingService.get_tax_breakdown(
            period_type=period,
            reference_date_str=reference_date,
            start_date_str=start_date,
            end_date_str=end_date
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/reports/bookings", response_model=BookingLedgerResponse)
async def get_booking_ledger(
    period: str = Query("weekly", pattern="^(weekly|monthly|custom)$"),
    reference_date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    trip_status: Optional[str] = Query(None),
    invoice_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(get_current_admin)
):
    """
    Returns detailed booking-wise financial ledger for the period.
    Access restricted to Admin role.
    """
    try:
        return await FinancialReportingService.get_booking_ledger(
            period_type=period,
            reference_date_str=reference_date,
            start_date_str=start_date,
            end_date_str=end_date,
            customer_id=customer_id,
            trip_status=trip_status,
            invoice_status=invoice_status,
            search=search,
            page=page,
            page_size=page_size
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/reports/bookings/{request_id}", response_model=BookingFinancial360Detail)
async def get_booking_detail_360(
    request_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin)
):
    """
    Returns 360-degree operational and financial audit breakdown for a single booking.
    Access restricted to Admin role.
    """
    detail = await FinancialReportingService.get_booking_financial_360(request_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Booking request not found")
    return detail

@router.get("/reports/export/csv")
async def export_financial_csv(
    period: str = Query("weekly", pattern="^(weekly|monthly|custom)$"),
    reference_date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_admin)
):
    """
    Exports booking-wise financial ledger and summary totals for the selected period as CSV.
    Uses identical calculations to on-screen dashboard.
    Access restricted to Admin role.
    """
    summary_res = await FinancialReportingService.get_summary(
        period_type=period,
        reference_date_str=reference_date,
        start_date_str=start_date,
        end_date_str=end_date
    )
    ledger_res = await FinancialReportingService.get_booking_ledger(
        period_type=period,
        reference_date_str=reference_date,
        start_date_str=start_date,
        end_date_str=end_date,
        page=1,
        page_size=1000
    )

    p = summary_res.period
    s = summary_res.summary

    filename = f"CargoX_{period.capitalize()}_Financial_Report_{p.start_date}_to_{p.end_date}.csv"

    output = io.StringIO()
    writer = csv.writer(output)

    # 1. Header Information
    writer.writerow(["CargoX Financial Management System - Financial Report"])
    writer.writerow(["Period Type", p.period_type.upper()])
    writer.writerow(["Date Range", p.display_range])
    writer.writerow(["Timezone", p.timezone])
    writer.writerow(["Generated At", s.last_updated.isoformat()])
    writer.writerow([])

    # 2. Financial Summary Overview
    writer.writerow(["=== FINANCIAL SUMMARY OVERVIEW ==="])
    writer.writerow(["Metric", "Amount (INR)", "Notes"])
    writer.writerow(["Customer Charges (Period Invoiced)", f"{s.period_customer_charges:.2f}", "Total invoices issued in period"])
    writer.writerow(["Payments Collected (Cash Movement)", f"{s.payments_collected:.2f}", f"{s.payment_transactions_count} payment transactions"])
    writer.writerow(["Outstanding Receivables (As of Period End)", f"{s.outstanding_receivables:.2f}", f"{s.unpaid_invoices_count} unpaid, {s.partially_paid_invoices_count} partially paid"])
    writer.writerow(["Approved Operating Expenses", f"{s.approved_operating_expenses:.2f}", f"Trip: {s.approved_trip_expenses:.2f}, Maintenance: {s.completed_vehicle_maintenance:.2f}"])
    writer.writerow(["Tax Charged", f"{s.tax_charged_period:.2f}", f"Taxable Base: {s.taxable_value_period:.2f}"])
    writer.writerow(["Driver Payable Generated", f"{s.driver_payable_generated:.2f}", "Net allocated driver earnings"])
    writer.writerow(["Driver Settlements Paid", f"{s.driver_settlements_paid:.2f}", "Actual payouts completed in period"])
    writer.writerow(["Driver Settlement Liabilities", f"{s.driver_settlement_liabilities:.2f}", "Unpaid settlements awaiting disbursement"])
    writer.writerow(["Cash Operating Profit", f"{s.cash_operating_profit:.2f}", "Payments Collected minus Approved Expenses"])
    writer.writerow(["Accrual Operating Margin", f"{s.accrual_operating_margin:.2f}", "Invoiced Charges minus Expenses minus Driver Payables"])
    writer.writerow([])

    # 3. Booking-wise Ledger
    writer.writerow(["=== BOOKING-WISE FINANCIAL LEDGER ==="])
    writer.writerow([
        "Request Number",
        "Booking Date",
        "Customer Company",
        "Recipient",
        "Goods Type",
        "Weight (Tons)",
        "Pickup Address",
        "Destination Address",
        "Distance (km)",
        "Trip Status",
        "Vehicle",
        "Driver",
        "Quotation Total",
        "CargoX Fee",
        "Driver Payable",
        "Invoice Number",
        "Subtotal",
        "Tax",
        "Invoice Total",
        "Amount Paid",
        "Amount Due",
        "Invoice Status",
        "Approved Trip Expenses",
        "Settlement Status"
    ])

    for row in ledger_res.bookings:
        writer.writerow([
            row.request_number,
            row.booking_date.strftime("%Y-%m-%d %H:%M"),
            row.customer_name,
            row.recipient_name,
            row.goods_type,
            row.weight_tons,
            row.pickup_address,
            row.destination_address,
            f"{row.distance_km:.2f}" if row.distance_km is not None else "",
            row.trip_status.value,
            row.vehicle_registration or "",
            row.driver_name or "",
            f"{row.quotation_amount:.2f}" if row.quotation_amount is not None else "",
            f"{row.service_fee_amount:.2f}" if row.service_fee_amount is not None else "",
            f"{row.driver_payable_amount:.2f}" if row.driver_payable_amount is not None else "",
            row.invoice_number or "",
            f"{row.taxable_subtotal:.2f}" if row.taxable_subtotal is not None else "",
            f"{row.tax_amount:.2f}" if row.tax_amount is not None else "",
            f"{row.invoice_total:.2f}" if row.invoice_total is not None else "",
            f"{row.amount_paid:.2f}" if row.amount_paid is not None else "",
            f"{row.amount_due:.2f}" if row.amount_due is not None else "",
            row.invoice_status.value if row.invoice_status else "",
            f"{row.approved_trip_expenses:.2f}",
            row.settlement_status.value if row.settlement_status else ""
        ])

    csv_data = output.getvalue()
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
