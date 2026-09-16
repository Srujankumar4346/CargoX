from sqlalchemy import Column, String, Numeric, DateTime, Enum, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.enums import ExpenseCategory, ExpenseStatus, MaintenanceType, MaintenanceStatus, ExpensePayer
import uuid
from sqlalchemy.dialects.postgresql import UUID

class TripExpense(Base):
    __tablename__ = "trip_expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_expense_amount_positive"),
        CheckConstraint("receipt_url LIKE 'https://%' OR receipt_url IS NULL", name="chk_receipt_url_https"),
    )
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), index=True, nullable=False)
    
    amount = Column(Numeric(12, 2), nullable=False)
    category = Column(Enum(ExpenseCategory), index=True, nullable=False)
    status = Column(Enum(ExpenseStatus), default=ExpenseStatus.PENDING_APPROVAL, index=True, nullable=False)
    date = Column(DateTime, nullable=False)
    description = Column(String, nullable=True)
    receipt_url = Column(String, nullable=True)
    paid_by = Column(Enum(ExpensePayer), default=ExpensePayer.CARGOX, nullable=False)
    
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    trip = relationship("Trip", back_populates="expenses")

class VehicleMaintenance(Base):
    __tablename__ = "vehicle_maintenance"
    __table_args__ = (
        CheckConstraint("cost > 0 OR cost IS NULL", name="chk_maintenance_cost_positive"),
    )
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), index=True, nullable=False)
    
    maintenance_type = Column(Enum(MaintenanceType), index=True, nullable=False)
    status = Column(Enum(MaintenanceStatus), default=MaintenanceStatus.SCHEDULED, index=True, nullable=False)
    cost = Column(Numeric(12, 2), nullable=True) # Cost can be set when completed
    
    scheduled_date = Column(DateTime, nullable=False)
    completed_date = Column(DateTime, nullable=True)
    
    description = Column(String, nullable=True)
    mechanic_notes = Column(String, nullable=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    vehicle = relationship("Vehicle", back_populates="maintenance_records")
