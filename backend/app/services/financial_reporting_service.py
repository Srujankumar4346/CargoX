import calendar
from datetime import datetime, date, time, timedelta, timezone
from decimal import Decimal
from typing import Tuple, Optional, Dict, Any, List
import uuid

from app.models.finance import Invoice, Payment, DriverSettlement
from app.models.operations import TripExpense, VehicleMaintenance
from app.models.delivery import DeliveryRequest, Trip, ProofOfDelivery
from app.models.company import CustomerCompany, RecipientCompany
from app.models.fleet import Driver, Vehicle, VehicleAssignment
from app.models.pricing import Quotation
from app.models.enums import (
    DeliveryRequestStatus,
    InvoiceStatus,
    SettlementStatus,
    ExpenseCategory,
    ExpenseStatus,
    MaintenanceStatus
)
from app.schemas.financial_reporting import (
    PeriodBounds,
    FinancialSummaryCards,
    FinancialReportSummaryResponse,
    ExpenseCategoryItem,
    FinancialExpensesResponse,
    SettlementSummaryResponse,
    TaxBreakdownResponse,
    BookingLedgerRow,
    BookingLedgerResponse,
    BookingExpenseDetail,
    BookingFinancial360Detail
)

# Canonical Business Timezone for CargoX: Asia/Kolkata (UTC +05:30)
IST_OFFSET = timedelta(hours=5, minutes=30)
IST_TZ = timezone(IST_OFFSET, name="Asia/Kolkata")

class FinancialReportingService:

    @staticmethod
    def _now_ist() -> datetime:
        return datetime.now(timezone.utc).astimezone(IST_TZ)

    @staticmethod
    def get_period_bounds(
        period_type: str = "weekly",
        reference_date_str: Optional[str] = None,
        start_date_str: Optional[str] = None,
        end_date_str: Optional[str] = None
    ) -> Tuple[datetime, datetime, PeriodBounds]:
        """
        Calculates half-open [start_utc, end_utc) interval corresponding to
        business timezone (Asia/Kolkata, UTC+05:30).
        
        Week definition: Monday 00:00:00 IST to following Monday 00:00:00 IST.
        Month definition: 1st of month 00:00:00 IST to 1st of next month 00:00:00 IST.
        Custom definition: start_date 00:00:00 IST to (end_date + 1 day) 00:00:00 IST.
        """
        now_ist = FinancialReportingService._now_ist()

        if period_type == "weekly":
            if reference_date_str:
                ref_d = date.fromisoformat(reference_date_str)
            else:
                ref_d = now_ist.date()
            
            # In Python, weekday(): Monday is 0, Sunday is 6
            start_d = ref_d - timedelta(days=ref_d.weekday())
            end_d = start_d + timedelta(days=7) # Following Monday

            prev_start_d = start_d - timedelta(days=7)
            next_start_d = start_d + timedelta(days=7)

            start_ist = datetime.combine(start_d, time.min, tzinfo=IST_TZ)
            end_ist = datetime.combine(end_d, time.min, tzinfo=IST_TZ)

            # Display Sunday as the human-readable end of the week
            display_end_d = start_d + timedelta(days=6)
            display_range = f"{start_d.strftime('%d %b %Y')} – {display_end_d.strftime('%d %b %Y')}"

            bounds = PeriodBounds(
                period_type="weekly",
                start_date=start_d.isoformat(),
                end_date=end_d.isoformat(),
                display_range=display_range,
                prev_period_start=prev_start_d.isoformat(),
                next_period_start=next_start_d.isoformat(),
                timezone="Asia/Kolkata"
            )

        elif period_type == "monthly":
            if reference_date_str:
                ref_d = date.fromisoformat(reference_date_str)
            else:
                ref_d = now_ist.date()

            start_d = date(ref_d.year, ref_d.month, 1)
            days_in_month = calendar.monthrange(ref_d.year, ref_d.month)[1]
            
            # Next month 1st
            if ref_d.month == 12:
                next_month_d = date(ref_d.year + 1, 1, 1)
            else:
                next_month_d = date(ref_d.year, ref_d.month + 1, 1)

            # Previous month 1st
            if ref_d.month == 1:
                prev_month_d = date(ref_d.year - 1, 12, 1)
            else:
                prev_month_d = date(ref_d.year, ref_d.month - 1, 1)

            end_d = next_month_d
            start_ist = datetime.combine(start_d, time.min, tzinfo=IST_TZ)
            end_ist = datetime.combine(end_d, time.min, tzinfo=IST_TZ)

            display_range = f"{start_d.strftime('%d %b %Y')} – {date(ref_d.year, ref_d.month, days_in_month).strftime('%d %b %Y')}"

            bounds = PeriodBounds(
                period_type="monthly",
                start_date=start_d.isoformat(),
                end_date=end_d.isoformat(),
                display_range=display_range,
                prev_period_start=prev_month_d.isoformat(),
                next_period_start=next_month_d.isoformat(),
                timezone="Asia/Kolkata"
            )

        elif period_type == "custom":
            if not start_date_str or not end_date_str:
                ref_d = now_ist.date()
                start_d = ref_d - timedelta(days=6)
                end_d = ref_d + timedelta(days=1)
            else:
                start_d = date.fromisoformat(start_date_str)
                end_d_user = date.fromisoformat(end_date_str)
                if end_d_user < start_d:
                    raise ValueError("End date cannot be earlier than start date")
                end_d = end_d_user + timedelta(days=1) # half-open exclusive upper bound

            start_ist = datetime.combine(start_d, time.min, tzinfo=IST_TZ)
            end_ist = datetime.combine(end_d, time.min, tzinfo=IST_TZ)

            display_end_d = end_d - timedelta(days=1)
            display_range = f"{start_d.strftime('%d %b %Y')} – {display_end_d.strftime('%d %b %Y')}"

            bounds = PeriodBounds(
                period_type="custom",
                start_date=start_d.isoformat(),
                end_date=end_d.isoformat(),
                display_range=display_range,
                prev_period_start=None,
                next_period_start=None,
                timezone="Asia/Kolkata"
            )
        else:
            raise ValueError(f"Invalid period_type: {period_type}")

        # MongoDB stores naive UTC datetimes. Convert tz-aware IST bounds to naive UTC datetimes
        start_utc = start_ist.astimezone(timezone.utc).replace(tzinfo=None)
        end_utc = end_ist.astimezone(timezone.utc).replace(tzinfo=None)

        return start_utc, end_utc, bounds

    @staticmethod
    async def _sum_field(model_class, match_query: dict, sum_field: str) -> Decimal:
        pipeline = [
            {"$match": match_query},
            {"$group": {"_id": None, "total": {"$sum": {"$toDecimal": f"${sum_field}"}}}}
        ]
        cursor = model_class.get_pymongo_collection().aggregate(pipeline)
        result = await cursor.to_list(length=1)
        if result and result[0].get("total") is not None:
            return Decimal(str(result[0]["total"]))
        return Decimal("0.00")

    @staticmethod
    async def get_summary(
        period_type: str = "weekly",
        reference_date_str: Optional[str] = None,
        start_date_str: Optional[str] = None,
        end_date_str: Optional[str] = None
    ) -> FinancialReportSummaryResponse:
        start_utc, end_utc, bounds = FinancialReportingService.get_period_bounds(
            period_type, reference_date_str, start_date_str, end_date_str
        )

        # 1. Invoices issued during the period
        invoice_period_filter = {"issued_at": {"$gte": start_utc, "$lt": end_utc}}
        invoices_issued_count = await Invoice.find(invoice_period_filter).count()
        period_customer_charges = await FinancialReportingService._sum_field(
            Invoice, invoice_period_filter, "total_amount"
        )
        tax_charged_period = await FinancialReportingService._sum_field(
            Invoice, invoice_period_filter, "tax"
        )
        taxable_value_period = await FinancialReportingService._sum_field(
            Invoice, invoice_period_filter, "subtotal"
        )

        # 2. Accepted quotations in the period
        quotations_filter = {
            "status": "ACCEPTED",
            "accepted_at": {"$gte": start_utc, "$lt": end_utc}
        }
        total_accepted_quotations = await Quotation.find(quotations_filter).count()
        accepted_quotations_value = await FinancialReportingService._sum_field(
            Quotation, quotations_filter, "customer_total_charge"
        )

        # 3. Cash payments collected during the period
        payment_period_filter = {"paid_at": {"$gte": start_utc, "$lt": end_utc}}
        payments_collected = await FinancialReportingService._sum_field(
            Payment, payment_period_filter, "amount"
        )
        payment_transactions_count = await Payment.find(payment_period_filter).count()

        # 4. Cumulative Outstanding Receivables as of period end:
        # Crucial Invariant: All invoices issued up to end_utc that have an outstanding balance (status != PAID)
        # Note: We compute outstanding debt at period end.
        receivables_filter = {
            "issued_at": {"$lt": end_utc},
            "status": {"$in": [InvoiceStatus.UNPAID.value, InvoiceStatus.PARTIALLY_PAID.value]}
        }
        outstanding_receivables = await FinancialReportingService._sum_field(
            Invoice, receivables_filter, "amount_due"
        )
        unpaid_invoices_count = await Invoice.find({
            "issued_at": {"$lt": end_utc},
            "status": InvoiceStatus.UNPAID.value
        }).count()
        partially_paid_invoices_count = await Invoice.find({
            "issued_at": {"$lt": end_utc},
            "status": InvoiceStatus.PARTIALLY_PAID.value
        }).count()

        # 5. Operating Expenditures in Period
        approved_trip_expenses = await FinancialReportingService._sum_field(
            TripExpense,
            {
                "status": ExpenseStatus.APPROVED.value,
                "date": {"$gte": start_utc, "$lt": end_utc}
            },
            "amount"
        )

        completed_vehicle_maintenance = await FinancialReportingService._sum_field(
            VehicleMaintenance,
            {
                "status": MaintenanceStatus.COMPLETED.value,
                "completed_date": {"$gte": start_utc, "$lt": end_utc}
            },
            "cost"
        )

        approved_operating_expenses = approved_trip_expenses + completed_vehicle_maintenance

        pending_expenses_count = await TripExpense.find({
            "status": ExpenseStatus.PENDING_APPROVAL.value,
            "date": {"$gte": start_utc, "$lt": end_utc}
        }).count()
        pending_expenses_amount = await FinancialReportingService._sum_field(
            TripExpense,
            {
                "status": ExpenseStatus.PENDING_APPROVAL.value,
                "date": {"$gte": start_utc, "$lt": end_utc}
            },
            "amount"
        )

        # 6. Driver Settlements
        # Generated during period
        settlements_generated_filter = {
            "period_end": {"$gte": start_utc, "$lt": end_utc}
        }
        driver_payable_generated = await FinancialReportingService._sum_field(
            DriverSettlement, settlements_generated_filter, "driver_payable_amount"
        )

        # Paid during period
        settlements_paid_filter = {
            "status": SettlementStatus.PAID.value,
            "paid_at": {"$gte": start_utc, "$lt": end_utc}
        }
        driver_settlements_paid = await FinancialReportingService._sum_field(
            DriverSettlement, settlements_paid_filter, "total_payout"
        )

        # Cumulative outstanding unpaid settlements up to period end
        settlement_liability_filter = {
            "status": SettlementStatus.PENDING_PAYMENT.value,
            "period_end": {"$lt": end_utc}
        }
        driver_settlement_liabilities = await FinancialReportingService._sum_field(
            DriverSettlement, settlement_liability_filter, "total_payout"
        )

        # 7. Operational Profitability metrics
        cash_operating_profit = payments_collected - approved_operating_expenses
        accrual_operating_margin = period_customer_charges - approved_operating_expenses - driver_payable_generated

        # 8. Deliveries & completed trips counts
        total_bookings = await DeliveryRequest.find({
            "created_at": {"$gte": start_utc, "$lt": end_utc}
        }).count()

        completed_trips = await Trip.find({
            "completed_at": {"$gte": start_utc, "$lt": end_utc}
        }).count()

        summary = FinancialSummaryCards(
            period_customer_charges=period_customer_charges,
            total_invoices_issued=invoices_issued_count,
            total_accepted_quotations=total_accepted_quotations,
            accepted_quotations_value=accepted_quotations_value,
            payments_collected=payments_collected,
            payment_transactions_count=payment_transactions_count,
            outstanding_receivables=outstanding_receivables,
            unpaid_invoices_count=unpaid_invoices_count,
            partially_paid_invoices_count=partially_paid_invoices_count,
            approved_operating_expenses=approved_operating_expenses,
            approved_trip_expenses=approved_trip_expenses,
            completed_vehicle_maintenance=completed_vehicle_maintenance,
            pending_expenses_count=pending_expenses_count,
            pending_expenses_amount=pending_expenses_amount,
            tax_charged_period=tax_charged_period,
            taxable_value_period=taxable_value_period,
            driver_payable_generated=driver_payable_generated,
            driver_settlements_paid=driver_settlements_paid,
            driver_settlement_liabilities=driver_settlement_liabilities,
            cash_operating_profit=cash_operating_profit,
            accrual_operating_margin=accrual_operating_margin,
            total_bookings=total_bookings,
            completed_trips=completed_trips,
            last_updated=datetime.now(timezone.utc)
        )

        return FinancialReportSummaryResponse(period=bounds, summary=summary)

    @staticmethod
    async def get_expenses_breakdown(
        period_type: str = "weekly",
        reference_date_str: Optional[str] = None,
        start_date_str: Optional[str] = None,
        end_date_str: Optional[str] = None
    ) -> FinancialExpensesResponse:
        start_utc, end_utc, bounds = FinancialReportingService.get_period_bounds(
            period_type, reference_date_str, start_date_str, end_date_str
        )

        pipeline = [
            {"$match": {"date": {"$gte": start_utc, "$lt": end_utc}}},
            {
                "$group": {
                    "_id": {"category": "$category", "status": "$status"},
                    "count": {"$sum": 1},
                    "total_amount": {"$sum": {"$toDecimal": "$amount"}}
                }
            }
        ]

        cursor = TripExpense.get_pymongo_collection().aggregate(pipeline)
        raw_items = await cursor.to_list(length=100)

        # Build category map across all known ExpenseCategory enums
        cat_map: Dict[str, Dict[str, Any]] = {}
        for cat in ExpenseCategory:
            cat_map[cat.value] = {
                "submitted_count": 0, "submitted_amount": Decimal("0.00"),
                "approved_count": 0, "approved_amount": Decimal("0.00"),
                "rejected_count": 0, "rejected_amount": Decimal("0.00"),
                "pending_count": 0, "pending_amount": Decimal("0.00"),
            }

        for item in raw_items:
            cat_val = item["_id"].get("category")
            status_val = item["_id"].get("status")
            amt = Decimal(str(item["total_amount"])) if item.get("total_amount") is not None else Decimal("0.00")
            cnt = int(item["count"])

            if cat_val not in cat_map:
                cat_map[cat_val] = {
                    "submitted_count": 0, "submitted_amount": Decimal("0.00"),
                    "approved_count": 0, "approved_amount": Decimal("0.00"),
                    "rejected_count": 0, "rejected_amount": Decimal("0.00"),
                    "pending_count": 0, "pending_amount": Decimal("0.00"),
                }

            cat_map[cat_val]["submitted_count"] += cnt
            cat_map[cat_val]["submitted_amount"] += amt

            if status_val == ExpenseStatus.APPROVED.value:
                cat_map[cat_val]["approved_count"] += cnt
                cat_map[cat_val]["approved_amount"] += amt
            elif status_val == ExpenseStatus.REJECTED.value:
                cat_map[cat_val]["rejected_count"] += cnt
                cat_map[cat_val]["rejected_amount"] += amt
            elif status_val == ExpenseStatus.PENDING_APPROVAL.value:
                cat_map[cat_val]["pending_count"] += cnt
                cat_map[cat_val]["pending_amount"] += amt

        categories = [
            ExpenseCategoryItem(
                category=cat,
                submitted_count=data["submitted_count"],
                submitted_amount=data["submitted_amount"],
                approved_count=data["approved_count"],
                approved_amount=data["approved_amount"],
                rejected_count=data["rejected_count"],
                rejected_amount=data["rejected_amount"],
                pending_count=data["pending_count"],
                pending_amount=data["pending_amount"],
            )
            for cat, data in cat_map.items()
        ]

        completed_maintenance = await FinancialReportingService._sum_field(
            VehicleMaintenance,
            {
                "status": MaintenanceStatus.COMPLETED.value,
                "completed_date": {"$gte": start_utc, "$lt": end_utc}
            },
            "cost"
        )

        total_approved_trip_expenses = sum(c.approved_amount for c in categories)
        total_approved = total_approved_trip_expenses + completed_maintenance

        return FinancialExpensesResponse(
            period=bounds,
            categories=categories,
            vehicle_maintenance_completed=completed_maintenance,
            total_approved_operating_expenses=total_approved
        )

    @staticmethod
    async def get_settlements_breakdown(
        period_type: str = "weekly",
        reference_date_str: Optional[str] = None,
        start_date_str: Optional[str] = None,
        end_date_str: Optional[str] = None
    ) -> SettlementSummaryResponse:
        start_utc, end_utc, bounds = FinancialReportingService.get_period_bounds(
            period_type, reference_date_str, start_date_str, end_date_str
        )

        # Generated settlements in period (based on period_end of settlement matching)
        gen_filter = {"period_end": {"$gte": start_utc, "$lt": end_utc}}
        gen_count = await DriverSettlement.find(gen_filter).count()
        driver_payable_gen = await FinancialReportingService._sum_field(
            DriverSettlement, gen_filter, "driver_payable_amount"
        )
        service_fee_gen = await FinancialReportingService._sum_field(
            DriverSettlement, gen_filter, "service_fee_amount"
        )
        reimbursements_gen = await FinancialReportingService._sum_field(
            DriverSettlement, gen_filter, "reimbursements"
        )
        deductions_gen = await FinancialReportingService._sum_field(
            DriverSettlement, gen_filter, "deductions"
        )
        total_payout_gen = await FinancialReportingService._sum_field(
            DriverSettlement, gen_filter, "total_payout"
        )

        # Paid settlements in period
        paid_filter = {
            "status": SettlementStatus.PAID.value,
            "paid_at": {"$gte": start_utc, "$lt": end_utc}
        }
        paid_count = await DriverSettlement.find(paid_filter).count()
        total_payout_paid = await FinancialReportingService._sum_field(
            DriverSettlement, paid_filter, "total_payout"
        )

        # Outstanding liabilities
        pending_filter = {
            "status": SettlementStatus.PENDING_PAYMENT.value,
            "period_end": {"$lt": end_utc}
        }
        pending_count = await DriverSettlement.find(pending_filter).count()
        outstanding_liability = await FinancialReportingService._sum_field(
            DriverSettlement, pending_filter, "total_payout"
        )

        return SettlementSummaryResponse(
            period=bounds,
            settlements_generated_count=gen_count,
            driver_payable_generated=driver_payable_gen,
            service_fee_generated=service_fee_gen,
            reimbursements_generated=reimbursements_gen,
            deductions_generated=deductions_gen,
            total_payout_generated=total_payout_gen,
            settlements_paid_count=paid_count,
            total_payout_paid=total_payout_paid,
            pending_payment_count=pending_count,
            outstanding_settlement_liability=outstanding_liability
        )

    @staticmethod
    async def get_tax_breakdown(
        period_type: str = "weekly",
        reference_date_str: Optional[str] = None,
        start_date_str: Optional[str] = None,
        end_date_str: Optional[str] = None
    ) -> TaxBreakdownResponse:
        start_utc, end_utc, bounds = FinancialReportingService.get_period_bounds(
            period_type, reference_date_str, start_date_str, end_date_str
        )

        match_query = {"issued_at": {"$gte": start_utc, "$lt": end_utc}}
        invoice_count = await Invoice.find(match_query).count()
        taxable_value = await FinancialReportingService._sum_field(Invoice, match_query, "subtotal")
        tax_amount = await FinancialReportingService._sum_field(Invoice, match_query, "tax")
        total_invoiced = await FinancialReportingService._sum_field(Invoice, match_query, "total_amount")

        return TaxBreakdownResponse(
            period=bounds,
            taxable_value=taxable_value,
            tax_amount=tax_amount,
            total_invoiced_with_tax=total_invoiced,
            invoice_count=invoice_count
        )

    @staticmethod
    async def get_booking_ledger(
        period_type: str = "weekly",
        reference_date_str: Optional[str] = None,
        start_date_str: Optional[str] = None,
        end_date_str: Optional[str] = None,
        customer_id: Optional[str] = None,
        trip_status: Optional[str] = None,
        invoice_status: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> BookingLedgerResponse:
        start_utc, end_utc, bounds = FinancialReportingService.get_period_bounds(
            period_type, reference_date_str, start_date_str, end_date_str
        )

        # Date criterion: Bookings created during period OR Invoices issued during period
        # First gather request IDs from Invoices issued in the period:
        invoice_req_ids = await Invoice.get_pymongo_collection().distinct(
            "request_id",
            {"issued_at": {"$gte": start_utc, "$lt": end_utc}}
        )

        # Build filter for DeliveryRequest:
        base_or = [
            {"created_at": {"$gte": start_utc, "$lt": end_utc}}
        ]
        if invoice_req_ids:
            base_or.append({"_id": {"$in": invoice_req_ids}})

        query_conditions: List[Dict[str, Any]] = [{"$or": base_or}]

        if customer_id:
            try:
                query_conditions.append({"customer_company_id": uuid.UUID(customer_id)})
            except ValueError:
                pass

        if trip_status:
            query_conditions.append({"status": trip_status})

        if search:
            query_conditions.append({
                "$or": [
                    {"request_number": {"$regex": search, "$options": "i"}},
                    {"pickup_company_name": {"$regex": search, "$options": "i"}},
                    {"destination_company_name": {"$regex": search, "$options": "i"}},
                    {"goods_type": {"$regex": search, "$options": "i"}}
                ]
            })

        final_query = {"$and": query_conditions} if len(query_conditions) > 1 else query_conditions[0]

        total_records = await DeliveryRequest.find(final_query).count()
        skip = (page - 1) * page_size

        requests = await DeliveryRequest.find(final_query).sort("-created_at").skip(skip).limit(page_size).to_list()

        rows: List[BookingLedgerRow] = []

        # Batch load references for performance
        req_ids = [r.id for r in requests]
        
        # Invoices
        invoices_list = await Invoice.find({"request_id": {"$in": req_ids}}).to_list()
        invoices_by_req = {inv.request_id: inv for inv in invoices_list}

        # Trips
        trips_list = await Trip.find({"request_id": {"$in": req_ids}}).to_list()
        trips_by_req = {tr.request_id: tr for tr in trips_list}

        # Quotations
        quotes_list = await Quotation.find({"request_id": {"$in": req_ids}}).to_list()
        quotes_by_req = {q.request_id: q for q in quotes_list}

        # Trip IDs for assignments and expenses
        trip_ids = [tr.id for tr in trips_list]
        assignments = await VehicleAssignment.find({"trip_id": {"$in": trip_ids}}).to_list() if trip_ids else []
        assignments_by_trip = {va.trip_id: va for va in assignments}

        # Vehicles and Drivers
        veh_ids = [va.vehicle_id for va in assignments]
        driver_ids = [va.driver_id for va in assignments]
        vehicles = await Vehicle.find({"_id": {"$in": veh_ids}}).to_list() if veh_ids else []
        drivers = await Driver.find({"_id": {"$in": driver_ids}}).to_list() if driver_ids else []
        veh_by_id = {v.id: v for v in vehicles}
        driver_by_id = {d.id: d for d in drivers}

        # Approved expenses grouped by trip_id
        expenses_by_trip: Dict[uuid.UUID, Decimal] = {}
        if trip_ids:
            exp_pipeline = [
                {"$match": {"trip_id": {"$in": trip_ids}, "status": ExpenseStatus.APPROVED.value}},
                {"$group": {"_id": "$trip_id", "total": {"$sum": {"$toDecimal": "$amount"}}}}
            ]
            exp_cursor = TripExpense.get_pymongo_collection().aggregate(exp_pipeline)
            exp_results = await exp_cursor.to_list(length=len(trip_ids))
            for res in exp_results:
                expenses_by_trip[res["_id"]] = Decimal(str(res["total"]))

        # Customer companies
        cust_ids = [r.customer_company_id for r in requests]
        companies = await CustomerCompany.find({"_id": {"$in": cust_ids}}).to_list() if cust_ids else []
        comp_by_id = {c.id: c.name for c in companies}

        # Settlements for trips
        settlement_ids = [tr.settlement_id for tr in trips_list if tr.settlement_id]
        settlements_list = await DriverSettlement.find({"_id": {"$in": settlement_ids}}).to_list() if settlement_ids else []
        settlement_by_id = {s.id: s for s in settlements_list}

        for r in requests:
            inv = invoices_by_req.get(r.id)
            tr = trips_by_req.get(r.id)
            quote = quotes_by_req.get(r.id)

            if invoice_status and (not inv or inv.status.value != invoice_status):
                continue

            va = assignments_by_trip.get(tr.id) if tr else None
            veh = veh_by_id.get(va.vehicle_id) if va else None
            drv = driver_by_id.get(va.driver_id) if va else None

            approved_exp = expenses_by_trip.get(tr.id, Decimal("0.00")) if tr else Decimal("0.00")
            st = settlement_by_id.get(tr.settlement_id) if (tr and tr.settlement_id) else None

            rows.append(
                BookingLedgerRow(
                    request_id=r.id,
                    request_number=r.request_number,
                    booking_date=r.created_at,
                    customer_name=comp_by_id.get(r.customer_company_id, r.pickup_company_name),
                    recipient_name=r.destination_company_name,
                    goods_type=r.goods_type,
                    goods_description=r.goods_description,
                    weight_tons=r.weight_tons,
                    pickup_address=r.pickup_address,
                    destination_address=r.destination_address,
                    distance_km=r.distance_km,
                    trip_status=r.status,
                    trip_id=tr.id if tr else None,
                    vehicle_registration=veh.registration_number if veh else None,
                    driver_name=drv.name if drv else None,
                    quotation_amount=quote.customer_total_charge if quote else None,
                    service_fee_amount=quote.service_fee_amount if quote else None,
                    driver_payable_amount=quote.driver_payable_amount if quote else None,
                    invoice_id=inv.id if inv else None,
                    invoice_number=inv.invoice_number if inv else None,
                    taxable_subtotal=inv.subtotal if inv else None,
                    tax_amount=inv.tax if inv else None,
                    invoice_total=inv.total_amount if inv else None,
                    amount_paid=inv.amount_paid if inv else None,
                    amount_due=inv.amount_due if inv else None,
                    invoice_status=inv.status if inv else None,
                    approved_trip_expenses=approved_exp,
                    settlement_status=st.status if st else None
                )
            )

        return BookingLedgerResponse(
            period=bounds,
            total_records=total_records,
            page=page,
            page_size=page_size,
            bookings=rows
        )

    @staticmethod
    async def get_booking_financial_360(request_id: uuid.UUID) -> Optional[BookingFinancial360Detail]:
        r = await DeliveryRequest.get(request_id)
        if not r:
            return None

        customer_company = await CustomerCompany.get(r.customer_company_id)
        customer_company_name = customer_company.name if customer_company else r.pickup_company_name

        tr = await Trip.find_one({"request_id": r.id})
        quote = await Quotation.find_one({"request_id": r.id})
        inv = await Invoice.find_one({"request_id": r.id})

        veh_reg = None
        drv_name = None
        drv_phone = None
        assigned_at = None
        expenses_list: List[BookingExpenseDetail] = []
        total_approved_exp = Decimal("0.00")
        pod_url = None
        pod_receiver = None

        settlement = None
        if tr:
            assigned_at = tr.assigned_at
            va = await VehicleAssignment.find_one({"trip_id": tr.id})
            if va:
                veh = await Vehicle.get(va.vehicle_id)
                drv = await Driver.get(va.driver_id)
                if veh:
                    veh_reg = veh.registration_number
                if drv:
                    drv_name = drv.name
                    drv_phone = drv.phone

            # Proof of delivery
            pod = await ProofOfDelivery.find_one({"trip_id": tr.id})
            if pod:
                pod_url = pod.file_url
                pod_receiver = pod.receiver_name

            # Trip expenses
            raw_expenses = await TripExpense.find({"trip_id": tr.id}).sort("-date").to_list()
            for exp in raw_expenses:
                expenses_list.append(
                    BookingExpenseDetail(
                        id=exp.id,
                        category=exp.category,
                        amount=Decimal(str(exp.amount)),
                        status=exp.status,
                        date=exp.date,
                        description=exp.description,
                        receipt_url=exp.receipt_url
                    )
                )
                if exp.status == ExpenseStatus.APPROVED:
                    total_approved_exp += Decimal(str(exp.amount))

            if tr.settlement_id:
                settlement = await DriverSettlement.get(tr.settlement_id)

        return BookingFinancial360Detail(
            request_id=r.id,
            request_number=r.request_number,
            created_at=r.created_at,
            customer_company_name=customer_company_name,
            recipient_company_name=r.destination_company_name,
            goods_type=r.goods_type,
            goods_description=r.goods_description,
            weight_tons=r.weight_tons,
            pickup_address=r.pickup_address,
            pickup_contact=r.pickup_contact_person,
            destination_address=r.destination_address,
            destination_contact=r.destination_contact_person,
            distance_km=r.distance_km,
            booking_status=r.status,
            trip_id=tr.id if tr else None,
            vehicle_registration=veh_reg,
            driver_name=drv_name,
            driver_phone=drv_phone,
            assigned_at=assigned_at,
            delivered_at=tr.delivered_at if tr else None,
            completed_at=tr.completed_at if tr else None,
            pod_url=pod_url,
            pod_receiver=pod_receiver,
            quotation_id=quote.id if quote else None,
            quotation_amount=quote.customer_total_charge if quote else None,
            invoice_id=inv.id if inv else None,
            invoice_number=inv.invoice_number if inv else None,
            taxable_subtotal=inv.subtotal if inv else None,
            tax_amount=inv.tax if inv else None,
            discount=inv.discount if inv else None,
            invoice_total=inv.total_amount if inv else None,
            amount_paid=inv.amount_paid if inv else None,
            amount_due=inv.amount_due if inv else None,
            invoice_status=inv.status if inv else None,
            issued_at=inv.issued_at if inv else None,
            expenses=expenses_list,
            total_approved_expenses=total_approved_exp,
            service_fee_percentage=quote.service_fee_percentage if quote else None,
            service_fee_amount=quote.service_fee_amount if quote else None,
            driver_payable_amount=quote.driver_payable_amount if quote else None,
            reimbursements=settlement.reimbursements if settlement else None,
            deductions=settlement.deductions if settlement else None,
            settlement_status=settlement.status if settlement else None,
            settlement_id=settlement.id if settlement else None
        )
