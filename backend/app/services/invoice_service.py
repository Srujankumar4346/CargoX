from fastapi import HTTPException, status
from datetime import datetime, timezone
from decimal import Decimal
import uuid
import random
from typing import List, Optional

from app.models.user import User
from app.models.delivery import DeliveryRequest, Trip
from app.models.finance import Invoice, Payment
from app.models.pricing import Quotation
from app.models.enums import DeliveryRequestStatus, QuotationStatus, InvoiceStatus
from app.schemas.invoice import InvoiceCreate, InvoiceAdminRead, CustomerInvoiceRead, PaymentCreate, PaymentRead
from app.services.authorization import AuthorizationService


class InvoiceService:

    @staticmethod
    def _build_admin_read(invoice: Invoice, quotation: Quotation, payments: List[Payment]) -> dict:
        """Assembles InvoiceAdminRead by joining immutable Quotation fields."""
        return {
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "request_id": invoice.request_id,
            "quotation_id": invoice.quotation_id,
            "customer_company_id": invoice.customer_company_id,
            "subtotal": invoice.subtotal,
            "tax": invoice.tax,
            "discount": invoice.discount,
            "total_amount": invoice.total_amount,
            "amount_paid": invoice.amount_paid,
            "amount_due": invoice.amount_due,
            "status": invoice.status,
            "issued_at": invoice.issued_at,
            "due_at": invoice.due_at,
            # Immutable Quotation fields — single authoritative source
            "distance_km": quotation.distance_km if quotation else None,
            "base_rate_per_km": quotation.base_rate_per_km if quotation else None,
            "internal_base_cost": quotation.internal_base_cost if quotation else None,
            "cargox_margin": quotation.cargox_margin if quotation else None,
            "customer_total_charge": quotation.customer_total_charge if quotation else None,
            "payments": [
                {
                    "id": p.id,
                    "invoice_id": p.invoice_id,
                    "amount": p.amount,
                    "method": p.method,
                    "reference_number": p.reference_number,
                    "notes": p.notes,
                    "paid_at": p.paid_at,
                    "recorded_by": p.recorded_by,
                }
                for p in payments
            ],
        }

    @staticmethod
    async def generate_invoice(
        trip_id: uuid.UUID,
        invoice_in: InvoiceCreate,
        admin_user: User
    ) -> dict:
        """
        Generates an invoice for a COMPLETED trip.
        """
        # Lock Trip
        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        # Lock DeliveryRequest
        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        # Guard: request must be COMPLETED
        if request.status != DeliveryRequestStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot generate invoice for request in status '{request.status.value}'. "
                       f"Request must be COMPLETED."
            )

        # Guard: no duplicate invoice
        existing_invoice = await Invoice.find_one(Invoice.request_id == request.id)
        if existing_invoice:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An invoice has already been generated for this delivery request."
            )

        # Fetch and validate the accepted quotation — single authoritative pricing source
        quotation = await Quotation.find_one(Quotation.request_id == request.id)
        if not quotation or quotation.status != QuotationStatus.ACCEPTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No accepted quotation found for this delivery request. Cannot generate invoice."
            )

        year = datetime.now(timezone.utc).year
        seq_val = random.randint(1000, 999999) # Placeholder for sequence since mongo handles this differently
        invoice_number = f"INV-{year}-{seq_val:06d}"

        # Financial calculation from immutable Quotation
        subtotal = Decimal(str(quotation.customer_total_charge))
        tax = Decimal("0.00")
        discount = Decimal("0.00")
        total_amount = subtotal + tax - discount

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        invoice = Invoice(
            invoice_number=invoice_number,
            request_id=request.id,
            customer_company_id=request.customer_company_id,
            quotation_id=quotation.id,
            subtotal=subtotal,
            tax=tax,
            discount=discount,
            total_amount=total_amount,
            amount_paid=Decimal("0.00"),
            amount_due=total_amount,
            status=InvoiceStatus.UNPAID,
            issued_at=now,
            due_at=invoice_in.due_at,
        )
        await invoice.insert()

        return InvoiceService._build_admin_read(invoice, quotation, [])

    @staticmethod
    async def record_payment(
        invoice_id: uuid.UUID,
        payment_in: PaymentCreate,
        admin_user: User
    ) -> Payment:
        """
        Records a payment against an invoice.
        """
        # Lock Invoice
        invoice = await Invoice.find_one(Invoice.id == invoice_id)
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

        # Guard: invoice must not be already PAID
        if invoice.status == InvoiceStatus.PAID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice is already fully paid. No further payments can be recorded."
            )

        # Guard: no overpayment
        amount = Decimal(str(payment_in.amount))
        if amount > Decimal(str(invoice.amount_due)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment amount ({amount}) exceeds outstanding balance ({invoice.amount_due}). "
                       f"Overpayment is not allowed."
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        payment = Payment(
            invoice_id=invoice.id,
            amount=amount,
            method=payment_in.method,
            reference_number=payment_in.reference_number,
            notes=payment_in.notes,
            paid_at=now,
            recorded_by=admin_user.id,
        )
        await payment.insert()

        # Update invoice financials
        invoice.amount_paid = Decimal(str(invoice.amount_paid)) + amount
        invoice.amount_due = Decimal(str(invoice.total_amount)) - invoice.amount_paid

        # Recompute status
        if invoice.amount_paid >= Decimal(str(invoice.total_amount)):
            invoice.status = InvoiceStatus.PAID
        elif invoice.amount_paid > Decimal("0"):
            invoice.status = InvoiceStatus.PARTIALLY_PAID

        await invoice.save()
        return payment

    @staticmethod
    async def get_invoice_admin(invoice_id: uuid.UUID) -> dict:
        """Returns full invoice detail for Admin, joining immutable Quotation fields."""
        invoice = await Invoice.find_one(Invoice.id == invoice_id)
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

        quotation = await Quotation.find_one(Quotation.id == invoice.quotation_id)
        payments = await Payment.find(Payment.invoice_id == invoice.id).to_list()
        return InvoiceService._build_admin_read(invoice, quotation, payments)

    @staticmethod
    async def list_invoices_admin(status_filter: Optional[str] = None) -> List[dict]:
        """Lists all invoices. Optionally filters by status."""
        if status_filter:
            try:
                status_enum = InvoiceStatus(status_filter)
                invoices = await Invoice.find(Invoice.status == status_enum).to_list()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status filter '{status_filter}'. "
                           f"Valid values: {[s.value for s in InvoiceStatus]}"
                )
        else:
            invoices = await Invoice.find_all().to_list()
            
        result = []
        for inv in invoices:
            quotation = await Quotation.find_one(Quotation.id == inv.quotation_id)
            payments = await Payment.find(Payment.invoice_id == inv.id).to_list()
            result.append(InvoiceService._build_admin_read(inv, quotation, payments))
        return result

    @staticmethod
    async def update_due_date(
        invoice_id: uuid.UUID,
        due_at: datetime,
        admin_user: User
    ) -> Invoice:
        """
        Updates due_at on an UNPAID invoice.
        Financial fields are immutable once any payment is recorded.
        """
        invoice = await Invoice.find_one(Invoice.id == invoice_id)
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

        if invoice.status != InvoiceStatus.UNPAID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Due date can only be updated on UNPAID invoices. "
                       f"Current status: '{invoice.status.value}'."
            )

        invoice.due_at = due_at
        await invoice.save()
        return invoice

    @staticmethod
    async def get_invoice_customer(
        invoice_id: uuid.UUID,
        customer_user: User
    ) -> Invoice:
        """
        Returns customer-facing invoice detail.
        Enforces tenant isolation via AuthorizationService.
        Never exposes internal pricing fields.
        """
        invoice = await Invoice.find_one(Invoice.id == invoice_id)
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

        # Tenant isolation — raises 404 on mismatch (masks resource existence)
        AuthorizationService.verify_customer_access(customer_user, invoice.customer_company_id)

        return invoice

    @staticmethod
    async def list_invoices_customer(
        customer_user: User
    ) -> List[Invoice]:
        """
        Returns all invoices belonging to the customer's company.
        Tenant-scoped by customer_company_id.
        """
        return await Invoice.find(
            Invoice.customer_company_id == customer_user.customer_company_id
        ).to_list()
