from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException, status
from datetime import datetime, timezone
from decimal import Decimal
import uuid
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
    def generate_invoice(
        db: Session,
        trip_id: uuid.UUID,
        invoice_in: InvoiceCreate,
        admin_user: User
    ) -> dict:
        """
        Generates an invoice for a COMPLETED trip.
        - Validates trip status == COMPLETED
        - Validates no existing invoice (409 Conflict if duplicate)
        - Validates quotation status == ACCEPTED
        - Derives invoice number from PostgreSQL sequence (concurrency-safe)
        - Derives all financials from the immutable Quotation
        - Single atomic commit
        """
        # Lock Trip
        trip = db.query(Trip).filter(Trip.id == trip_id).with_for_update().first()
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        # Lock DeliveryRequest
        request = db.query(DeliveryRequest).filter(
            DeliveryRequest.id == trip.request_id
        ).with_for_update().first()
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
        existing_invoice = db.query(Invoice).filter(Invoice.request_id == request.id).first()
        if existing_invoice:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An invoice has already been generated for this delivery request."
            )

        # Fetch and validate the accepted quotation — single authoritative pricing source
        quotation = db.query(Quotation).filter(Quotation.request_id == request.id).first()
        if not quotation or quotation.status != QuotationStatus.ACCEPTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No accepted quotation found for this delivery request. Cannot generate invoice."
            )

        # Derive invoice number from PostgreSQL sequence (concurrency-safe, may have gaps on rollback)
        seq_val = db.execute(text("SELECT nextval('invoice_number_seq')")).scalar()
        year = datetime.now(timezone.utc).year
        invoice_number = f"INV-{year}-{seq_val:06d}"

        # Financial calculation from immutable Quotation
        subtotal = Decimal(str(quotation.customer_total_charge))
        tax = Decimal("0.00")
        discount = Decimal("0.00")
        total_amount = subtotal + tax - discount

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        invoice = Invoice(
            id=uuid.uuid4(),
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
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        return InvoiceService._build_admin_read(invoice, quotation, [])

    @staticmethod
    def record_payment(
        db: Session,
        invoice_id: uuid.UUID,
        payment_in: PaymentCreate,
        admin_user: User
    ) -> Payment:
        """
        Records a payment against an invoice.
        - Validates invoice is not already PAID
        - Validates payment amount > 0 and <= amount_due (no overpayment)
        - Updates amount_paid, amount_due, and status atomically
        - Single commit
        """
        # Lock Invoice
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).with_for_update().first()
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
            id=uuid.uuid4(),
            invoice_id=invoice.id,
            amount=amount,
            method=payment_in.method,
            reference_number=payment_in.reference_number,
            notes=payment_in.notes,
            paid_at=now,
            recorded_by=admin_user.id,
        )
        db.add(payment)

        # Update invoice financials
        invoice.amount_paid = Decimal(str(invoice.amount_paid)) + amount
        invoice.amount_due = Decimal(str(invoice.total_amount)) - invoice.amount_paid

        # Recompute status
        if invoice.amount_paid >= Decimal(str(invoice.total_amount)):
            invoice.status = InvoiceStatus.PAID
        elif invoice.amount_paid > Decimal("0"):
            invoice.status = InvoiceStatus.PARTIALLY_PAID

        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def get_invoice_admin(db: Session, invoice_id: uuid.UUID) -> dict:
        """Returns full invoice detail for Admin, joining immutable Quotation fields."""
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

        quotation = db.query(Quotation).filter(Quotation.id == invoice.quotation_id).first()
        payments = db.query(Payment).filter(Payment.invoice_id == invoice.id).all()
        return InvoiceService._build_admin_read(invoice, quotation, payments)

    @staticmethod
    def list_invoices_admin(db: Session, status_filter: Optional[str] = None) -> List[dict]:
        """Lists all invoices. Optionally filters by status."""
        query = db.query(Invoice)
        if status_filter:
            try:
                status_enum = InvoiceStatus(status_filter)
                query = query.filter(Invoice.status == status_enum)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status filter '{status_filter}'. "
                           f"Valid values: {[s.value for s in InvoiceStatus]}"
                )
        invoices = query.all()
        result = []
        for inv in invoices:
            quotation = db.query(Quotation).filter(Quotation.id == inv.quotation_id).first()
            payments = db.query(Payment).filter(Payment.invoice_id == inv.id).all()
            result.append(InvoiceService._build_admin_read(inv, quotation, payments))
        return result

    @staticmethod
    def update_due_date(
        db: Session,
        invoice_id: uuid.UUID,
        due_at: datetime,
        admin_user: User
    ) -> Invoice:
        """
        Updates due_at on an UNPAID invoice.
        Financial fields are immutable once any payment is recorded.
        """
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).with_for_update().first()
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

        if invoice.status != InvoiceStatus.UNPAID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Due date can only be updated on UNPAID invoices. "
                       f"Current status: '{invoice.status.value}'."
            )

        invoice.due_at = due_at
        db.commit()
        db.refresh(invoice)
        return invoice

    @staticmethod
    def get_invoice_customer(
        db: Session,
        invoice_id: uuid.UUID,
        customer_user: User
    ) -> Invoice:
        """
        Returns customer-facing invoice detail.
        Enforces tenant isolation via AuthorizationService.
        Never exposes internal pricing fields.
        """
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

        # Tenant isolation — raises 404 on mismatch (masks resource existence)
        AuthorizationService.verify_customer_access(customer_user, invoice.customer_company_id)

        return invoice

    @staticmethod
    def list_invoices_customer(
        db: Session,
        customer_user: User
    ) -> List[Invoice]:
        """
        Returns all invoices belonging to the customer's company.
        Tenant-scoped by customer_company_id.
        """
        return db.query(Invoice).filter(
            Invoice.customer_company_id == customer_user.customer_company_id
        ).all()
