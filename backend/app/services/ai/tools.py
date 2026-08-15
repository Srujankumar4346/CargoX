from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.invoice import Invoice
from app.models.expense import Expense
from app.models.trip import Trip
from app.models.booking import Booking

def get_total_revenue(db: Session) -> float:
    result = db.query(func.sum(Invoice.total_amount)).scalar()
    return float(result) if result else 0.0

def get_total_expenses(db: Session) -> float:
    result = db.query(func.sum(Expense.amount)).scalar()
    return float(result) if result else 0.0

def get_net_profit(db: Session) -> float:
    return get_total_revenue(db) - get_total_expenses(db)

def get_active_trips(db: Session) -> int:
    # Any trip that is not COMPLETED or TRIP CREATED (i.e., currently running)
    # The prompt might just want all trips not COMPLETED.
    result = db.query(func.count(Trip.id)).filter(Trip.status != "COMPLETED").scalar()
    return int(result) if result else 0

def get_pending_bookings(db: Session) -> int:
    result = db.query(func.count(Booking.id)).filter(Booking.status == "REQUESTED").scalar()
    return int(result) if result else 0

# Mapping of tools available to the LLM
def execute_tool(db: Session, tool_name: str, kwargs: dict) -> str:
    try:
        if tool_name == "get_total_revenue":
            val = get_total_revenue(db)
            return f"Total revenue is ₹{val}"
        elif tool_name == "get_total_expenses":
            val = get_total_expenses(db)
            return f"Total expenses are ₹{val}"
        elif tool_name == "get_net_profit":
            val = get_net_profit(db)
            return f"Net profit is ₹{val}"
        elif tool_name == "get_active_trips":
            val = get_active_trips(db)
            return f"There are {val} active trips."
        elif tool_name == "get_pending_bookings":
            val = get_pending_bookings(db)
            return f"There are {val} pending bookings."
        else:
            return "Tool not recognized."
    except Exception as e:
        return f"Error executing tool: {str(e)}"
