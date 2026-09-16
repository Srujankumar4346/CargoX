import enum

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    CUSTOMER_USER = "CUSTOMER_USER"
    DRIVER = "DRIVER"

class CompanyStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"

class VehicleType(str, enum.Enum):
    OPEN = "OPEN"
    CONTAINER = "CONTAINER"
    TRAILER = "TRAILER"

class VehicleStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    MAINTENANCE = "MAINTENANCE"
    ASSIGNED = "ASSIGNED"

class DriverStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    ON_TRIP = "ON_TRIP"
    OFF_DUTY = "OFF_DUTY"

class DeliveryRequestStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    QUOTED = "QUOTED"
    ACCEPTED = "ACCEPTED"
    VEHICLE_ASSIGNED = "VEHICLE_ASSIGNED"
    DRIVER_ASSIGNED = "DRIVER_ASSIGNED"
    PICKUP_IN_PROGRESS = "PICKUP_IN_PROGRESS"
    IN_TRANSIT = "IN_TRANSIT"
    ARRIVED = "ARRIVED"
    POD_SUBMITTED = "POD_SUBMITTED"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    CUSTOMER_CANCELLED = "CUSTOMER_CANCELLED"

class QuotationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"
    REJECTED = "REJECTED"

class InvoiceStatus(str, enum.Enum):
    UNPAID = "UNPAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"

class PaymentMethod(str, enum.Enum):
    BANK_TRANSFER = "BANK_TRANSFER"
    CASH = "CASH"
    UPI = "UPI"
    OTHER = "OTHER"
