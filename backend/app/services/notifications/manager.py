from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.booking import Booking
from app.models.trip import Trip
from app.models.invoice import Invoice
from app.services.notifications.channels.in_app import send_in_app
from app.services.notifications.channels.email import send_email
from app.services.notifications.channels.sms import send_sms
from app.services.notifications.channels.whatsapp import send_whatsapp
from app.domain.events import event_dispatcher, DomainEvent

class NotificationManager:
    @staticmethod
    def _dispatch(db: Session, event_type: str, recipients: list, title: str, message: str, metadata: dict = None):
        entity_id = metadata.get("entity_id") if metadata else None

        for recipient in recipients:
            user_type = recipient.get("user_type")
            user_id = recipient.get("user_id")
            channels = recipient.get("channels", ["IN_APP"])

            for channel in channels:
                # Deduplication logic
                if entity_id:
                    # Check if notification already exists for this event + entity + recipient + channel
                    existing = db.query(Notification).filter(
                        Notification.event_type == event_type,
                        Notification.user_type == user_type,
                        Notification.user_id == user_id,
                        Notification.channel == channel,
                        Notification.metadata_payload.op('->>')('entity_id') == str(entity_id)
                    ).first()
                    if existing:
                        continue # Skip duplicate

                # Actually dispatch
                if channel == "IN_APP":
                    send_in_app(db, user_type, user_id, event_type, title, message, metadata)
                elif channel == "EMAIL":
                    send_email(user_type, user_id, event_type, title, message, metadata)
                elif channel == "SMS":
                    send_sms(user_type, user_id, event_type, title, message, metadata)
                elif channel == "WHATSAPP":
                    send_whatsapp(user_type, user_id, event_type, title, message, metadata)

    @classmethod
    def setup_subscriptions(cls):
        event_dispatcher.subscribe("NEW_BOOKING", cls.handle_new_booking)
        event_dispatcher.subscribe("VEHICLE_ASSIGNED", cls.handle_vehicle_assigned)
        event_dispatcher.subscribe("TRIP_STARTED", cls.handle_trip_started)
        event_dispatcher.subscribe("DELIVERY_COMPLETED", cls.handle_delivery_completed)
        event_dispatcher.subscribe("INVOICE_GENERATED", cls.handle_invoice_generated)

    @classmethod
    def handle_new_booking(cls, db: Session, event: DomainEvent):
        booking = db.query(Booking).filter(Booking.id == event.entity_id).first()
        if not booking: return
        cls._dispatch(
            db=db,
            event_type="NEW_BOOKING",
            recipients=[
                {"user_type": "ADMIN", "user_id": 0, "channels": ["IN_APP"]},
                {"user_type": "CUSTOMER", "user_id": booking.customer_id, "channels": ["IN_APP", "EMAIL"]}
            ],
            title="Booking Created",
            message=f"Booking #{booking.id} created.",
            metadata={"entity_id": booking.id}
        )

    @classmethod
    def handle_vehicle_assigned(cls, db: Session, event: DomainEvent):
        trip = db.query(Trip).filter(Trip.id == event.entity_id).first()
        if not trip: return
        # Notify Customer
        cls._dispatch(
            db=db,
            event_type="VEHICLE_ASSIGNED",
            recipients=[
                {"user_type": "CUSTOMER", "user_id": trip.booking.customer_id, "channels": ["IN_APP", "EMAIL"]}
            ],
            title="Vehicle Assigned",
            message=f"Vehicle has been assigned to your booking #CX100{trip.booking_id}.",
            metadata={"entity_id": trip.booking_id} # duplicate prevention uses booking_id for customer
        )
        # Notify Driver
        cls._dispatch(
            db=db,
            event_type="TRIP_ASSIGNED", # Could be VEHICLE_ASSIGNED as well, but using TRIP_ASSIGNED
            recipients=[
                {"user_type": "DRIVER", "user_id": trip.driver_id, "channels": ["IN_APP", "SMS"]}
            ],
            title="New Trip Assigned",
            message=f"You have been assigned to Trip #{trip.id}.",
            metadata={"entity_id": trip.id}
        )

    @classmethod
    def handle_trip_started(cls, db: Session, event: DomainEvent):
        trip = db.query(Trip).filter(Trip.id == event.entity_id).first()
        if not trip: return
        cls._dispatch(
            db=db,
            event_type="TRIP_STARTED",
            recipients=[
                {"user_type": "CUSTOMER", "user_id": trip.booking.customer_id, "channels": ["IN_APP", "SMS"]},
                {"user_type": "ADMIN", "user_id": 0, "channels": ["IN_APP"]}
            ],
            title="Trip Started",
            message=f"Trip #{trip.id} has started (IN TRANSIT).",
            metadata={"entity_id": trip.id}
        )

    @classmethod
    def handle_delivery_completed(cls, db: Session, event: DomainEvent):
        trip = db.query(Trip).filter(Trip.id == event.entity_id).first()
        if not trip: return
        cls._dispatch(
            db=db,
            event_type="DELIVERY_COMPLETED",
            recipients=[
                {"user_type": "CUSTOMER", "user_id": trip.booking.customer_id, "channels": ["IN_APP", "SMS"]},
                {"user_type": "ADMIN", "user_id": 0, "channels": ["IN_APP"]}
            ],
            title="Delivery Completed",
            message=f"Trip #{trip.id} delivery is completed.",
            metadata={"entity_id": trip.id}
        )

    @classmethod
    def handle_invoice_generated(cls, db: Session, event: DomainEvent):
        invoice = db.query(Invoice).filter(Invoice.id == event.entity_id).first()
        if not invoice: return
        cls._dispatch(
            db=db,
            event_type="INVOICE_GENERATED",
            recipients=[
                {"user_type": "CUSTOMER", "user_id": invoice.customer_id, "channels": ["IN_APP", "EMAIL"]}
            ],
            title="Invoice Generated",
            message=f"Invoice {invoice.invoice_number} has been generated for your booking.",
            metadata={"entity_id": invoice.id}
        )

# Initialize subscriptions when the module is imported
NotificationManager.setup_subscriptions()
