from fastapi import APIRouter, Depends, HTTPException, Query
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
from app.domain.events import event_dispatcher, DomainEvent
from app.schemas.financial import InvoiceResponse, PaymentCreate, PaymentResponse, ExpenseCreate, ExpenseResponse
from app.api.deps import get_current_active_user, get_current_admin

router = APIRouter()

@router.get("/invoices", response_model=List[InvoiceResponse])
def get_invoices(
    skip: int = Query(0, ge=0), 
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    query = db.query(Invoice)
    if current_user["role"] == "CUSTOMER":
        query = query.filter(Invoice.customer_id == current_user["id"])
    elif current_user["role"] == "DRIVER":
        raise HTTPException(status_code=403, detail="Drivers cannot access invoices")
        
    return query.offset(skip).limit(limit).all()

@router.post("/payments", response_model=PaymentResponse)
def create_payment(payment: PaymentCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_active_user)):
    # Assuming only Admins can record payments manually in this simplified app
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Only admins can record payments")
        
    # Transactional safety using with_for_update
    invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).with_for_update().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Create Payment
    db_payment = Payment(**payment.model_dump())
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
    
    event_dispatcher.publish(db, DomainEvent(
        event_type="PAYMENT_RECEIVED", 
        entity_id=invoice.id,
        metadata_payload={"amount": str(payment.amount), "invoice_number": invoice.invoice_number}
    ))
    
    return db_payment

@router.post("/expenses", response_model=ExpenseResponse)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_active_user)):
    if current_user["role"] == "CUSTOMER":
        raise HTTPException(status_code=403, detail="Customers cannot submit expenses")
        
    db_expense = Expense(**expense.model_dump())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)

    event_dispatcher.publish(db, DomainEvent(
        event_type="EXPENSE_SUBMITTED", 
        entity_id=db_expense.id,
        metadata_payload={"amount": str(expense.amount)}
    ))

    return db_expense

@router.get("/expenses", response_model=List[ExpenseResponse])
def get_expenses(
    skip: int = Query(0, ge=0), 
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    query = db.query(Expense)
    if current_user["role"] == "CUSTOMER":
        raise HTTPException(status_code=403, detail="Customers cannot access expenses")
    elif current_user["role"] == "DRIVER":
        # A driver should logically only see expenses for their trips
        query = query.join(Trip).filter(Trip.driver_id == current_user["id"])
        
    return query.offset(skip).limit(limit).all()

@router.get("/dashboard")
def get_financial_dashboard(db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    revenue = db.query(func.sum(Invoice.total_amount)).scalar() or 0.0
    amount_paid = db.query(func.sum(Invoice.amount_paid)).scalar() or 0.0
    expenses = db.query(func.sum(Expense.amount)).scalar() or 0.0
    
    profit = float(revenue) - float(expenses)
    
    return {
        "revenue": float(revenue),
        "amount_paid": float(amount_paid),
        "amount_due": float(revenue) - float(amount_paid),
        "expenses": float(expenses),
        "profit": profit
    }
