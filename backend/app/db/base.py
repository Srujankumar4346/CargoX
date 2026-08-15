from sqlalchemy.orm import declarative_base

Base = declarative_base()

from app.models.invoice import Invoice
from app.models.expense import Expense
from app.models.payment import Payment
from app.models.tracking import LocationUpdate, ProofOfDelivery
from app.models.notification import Notification
