from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from sqlalchemy.sql import func
from app.db.database import get_db
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.expense import Expense
from app.models.booking import Booking
from app.models.trip import Trip
from app.services.notifications.notifier import NotificationService
from app.schemas.financial import InvoiceResponse, PaymentCreate, PaymentResponse, ExpenseCreate, ExpenseResponse

router = APIRouter()

@router.get("/invoices", response_model=List[InvoiceResponse])
def get_invoices(db: Session = Depends(get_db)):
    return db.query(Invoice).all()

@router.post("/payments", response_model=PaymentResponse)
def create_payment(payment: PaymentCreate, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Create Payment
    db_payment = Payment(**payment.dict())
    db.add(db_payment)
    
    # Update Invoice amounts
    invoice.amount_paid += payment.amount
    invoice.amount_due = invoice.total_amount - invoice.amount_paid
    
    # Update Status
    if invoice.amount_due <= 0:
        invoice.status = "PAID"
    elif invoice.amount_paid > 0:
        invoice.status = "PARTIALLY_PAID"
        
    db.commit()
    db.refresh(db_payment)
    
    NotificationService.notify(
        db=db,
        user_type="CUSTOMER",
        user_id=invoice.customer_id,
        title="Payment Received",
        message=f"Received payment of INR {payment.amount} for Invoice {invoice.invoice_number}.",
        channels=["IN_APP", "EMAIL"]
    )
    
    return db_payment

@router.post("/expenses", response_model=ExpenseResponse)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    db_expense = Expense(**expense.dict())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

@router.get("/expenses", response_model=List[ExpenseResponse])
def get_expenses(db: Session = Depends(get_db)):
    return db.query(Expense).all()

@router.get("/dashboard")
def get_financial_dashboard(db: Session = Depends(get_db)):
    # Calculate Revenue (Sum of total_amount of all invoices)
    revenue = db.query(func.sum(Invoice.total_amount)).scalar() or 0.0
    
    # Calculate Total Paid
    amount_paid = db.query(func.sum(Invoice.amount_paid)).scalar() or 0.0
    
    # Calculate Expenses (Sum of amount of all expenses)
    expenses = db.query(func.sum(Expense.amount)).scalar() or 0.0
    
    # Profit
    profit = float(revenue) - float(expenses)
    
    return {
        "revenue": float(revenue),
        "amount_paid": float(amount_paid),
        "amount_due": float(revenue) - float(amount_paid),
        "expenses": float(expenses),
        "profit": profit
    }
