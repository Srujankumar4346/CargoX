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

class ExpenseCategory(str, enum.Enum):
    FUEL = "FUEL"
    TOLL = "TOLL"
    DRIVER_ALLOWANCE = "DRIVER_ALLOWANCE"
    MAINTENANCE_INCIDENTAL = "MAINTENANCE_INCIDENTAL"
    OTHER = "OTHER"

class ExpensePayer(str, enum.Enum):
    CARGOX = "CARGOX"
    DRIVER = "DRIVER"

class ExpenseStatus(str, enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class MaintenanceType(str, enum.Enum):
    ROUTINE = "ROUTINE"
    REPAIR = "REPAIR"
    INSPECTION = "INSPECTION"

class MaintenanceStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class SettlementStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_PAYMENT = "PENDING_PAYMENT"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class DocumentOwnerType(str, enum.Enum):
    VEHICLE = "VEHICLE"
    DRIVER = "DRIVER"

class DocumentType(str, enum.Enum):
    DRIVING_LICENSE = "DRIVING_LICENSE"
    MEDICAL_CERTIFICATE = "MEDICAL_CERTIFICATE"
    REGISTRATION = "REGISTRATION"
    INSURANCE = "INSURANCE"
    PUC = "PUC"
    PERMIT = "PERMIT"

class DocumentVerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    ARCHIVED = "ARCHIVED"
