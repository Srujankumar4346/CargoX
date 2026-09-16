from sqlalchemy import Column, String, Float, DateTime, Enum, ForeignKey, CheckConstraint, Index
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.enums import DeliveryRequestStatus
import uuid
from sqlalchemy.dialects.postgresql import UUID

class DeliveryRequest(Base):
    __tablename__ = "delivery_requests"
    __table_args__ = (
        CheckConstraint("weight_tons > 0", name="chk_weight_positive"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    request_number = Column(String, unique=True, index=True, nullable=False)
    customer_company_id = Column(UUID(as_uuid=True), ForeignKey("customer_companies.id"), nullable=False)
    
    # Cargo Snapshot
    goods_type = Column(String, nullable=False)
    goods_description = Column(String, nullable=True)
    weight_tons = Column(Float, nullable=False)
    special_instructions = Column(String, nullable=True)
    
    # Pickup Snapshot
    pickup_company_name = Column(String, nullable=False)
    pickup_address = Column(String, nullable=False)
    pickup_contact_person = Column(String, nullable=True)
    pickup_phone = Column(String, nullable=True)
    pickup_lat = Column(Float, nullable=True)
    pickup_lng = Column(Float, nullable=True)
    
    # Destination Snapshot
    recipient_company_id = Column(UUID(as_uuid=True), ForeignKey("recipient_companies.id", ondelete="SET NULL"), nullable=True)
    destination_company_name = Column(String, nullable=False)
    destination_address = Column(String, nullable=False)
    destination_contact_person = Column(String, nullable=True)
    destination_phone = Column(String, nullable=True)
    destination_lat = Column(Float, nullable=True)
    destination_lng = Column(Float, nullable=True)
    
    # Metrics
    distance_km = Column(Float, nullable=False)
    status = Column(Enum(DeliveryRequestStatus), default=DeliveryRequestStatus.DRAFT, nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    
    # Relationships
    customer_company = relationship("CustomerCompany", back_populates="requests")
    recipient_company = relationship("RecipientCompany")
    quotation = relationship("Quotation", back_populates="delivery_request", uselist=False)
    trip = relationship("Trip", back_populates="delivery_request", uselist=False)
    invoices = relationship("Invoice", back_populates="delivery_request")

class Trip(Base):
    __tablename__ = "trips"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    request_id = Column(UUID(as_uuid=True), ForeignKey("delivery_requests.id"), unique=True, nullable=False)
    
    # Execution Timestamps
    assigned_at = Column(DateTime, nullable=False)
    pickup_started_at = Column(DateTime, nullable=True)
    picked_up_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    arrived_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Tracking
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    
    # Relationships
    delivery_request = relationship("DeliveryRequest", back_populates="trip")
    assignment = relationship("VehicleAssignment", back_populates="trip", uselist=False)
    proof_of_delivery = relationship("ProofOfDelivery", back_populates="trip")
    location_history = relationship("LocationHistory", back_populates="trip")

class ProofOfDelivery(Base):
    __tablename__ = "proof_of_deliveries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    file_url = Column(String, nullable=False)
    receiver_name = Column(String, nullable=True)
    receiver_phone = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    submitted_at = Column(DateTime, nullable=False)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    trip = relationship("Trip", back_populates="proof_of_delivery")

class LocationHistory(Base):
    __tablename__ = "location_histories"
    __table_args__ = (
        Index("ix_location_histories_trip_recorded", "trip_id", "recorded_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    recorded_at = Column(DateTime, nullable=False)

    # Relationships
    trip = relationship("Trip", back_populates="location_history")

