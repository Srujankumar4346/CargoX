from fastapi import HTTPException, status
from datetime import datetime, timezone
from decimal import Decimal
import uuid
from typing import Dict, Any, List, Optional

from app.models.delivery import DeliveryRequest, Trip, LocationHistory
from app.models.fleet import Vehicle, Driver, VehicleAssignment
from app.models.finance import Invoice, Payment
from app.models.user import User
from app.models.enums import DeliveryRequestStatus, UserRole, PaymentMethod, InvoiceStatus
from app.schemas.driver_pwa import LocationUpdate, DriverTripRead, DriverCollectionCreate, DriverCollectionRead
from app.services.authorization import AuthorizationService
from app.services.notification_service import NotificationService
from app.models.notifications import NotificationChannel

class DriverService:
    @staticmethod
    async def _build_driver_trip_read(trip: Trip, request: DeliveryRequest, vehicle: Vehicle, assignment: VehicleAssignment) -> Dict[str, Any]:
        # Check associated invoice for Pay on Delivery info
        invoice = await Invoice.find_one(Invoice.request_id == request.id)
        pm = getattr(invoice, "payment_method", None)
        payment_method_val = pm.value if pm else None
        
        collection_status = "NOT_REQUIRED"
        amount_due_col = None
        inv_num = None

        if invoice:
            inv_num = invoice.invoice_number
            if invoice.status == InvoiceStatus.PAID:
                collection_status = "COLLECTED"
                amount_due_col = Decimal("0.00")
            elif payment_method_val == "PAY_ON_DELIVERY" or (not invoice.payment_method and invoice.amount_due > Decimal("0")):
                collection_status = "DUE"
                amount_due_col = Decimal(str(invoice.amount_due))
            else:
                collection_status = "PENDING_VERIFICATION" if invoice.payment_intent_status == "PENDING_CONFIRMATION" else "NOT_REQUIRED"
                amount_due_col = Decimal(str(invoice.amount_due))

        # CargoX Business Payment Details (configured from SystemSettings / PaymentGatewayService)
        from app.services.settings_service import SettingsService
        from app.services.payment_gateway_service import PaymentGatewayService
        from urllib.parse import urlencode

        system_settings = await SettingsService.get_settings()
        cargox_upi = (system_settings.cargox_upi_id or "").strip() or None
        
        qr_image_url = None
        upi_uri = None
        payment_status_display = "Payment Due"
        gateway_order_id = getattr(invoice, "gateway_order_id", None) if invoice else None
        gateway_key_id = PaymentGatewayService.get_public_key_id()

        if invoice:
            if invoice.status == InvoiceStatus.PAID or Decimal(str(invoice.amount_due)) <= Decimal("0.00"):
                payment_status_display = "Paid"
            elif invoice.payment_intent_status == "PENDING_CONFIRMATION":
                payment_status_display = "Payment Confirmation Pending"
            elif invoice.payment_intent_status in ("PROCESSING", "AWAITING_VERIFICATION"):
                payment_status_display = "Processing"
            else:
                payment_status_display = "Payment Due"

            # Generate dynamic QR code if balance remains and UPI ID exists
            exact_due = Decimal(str(invoice.amount_due))
            if exact_due > Decimal("0.00") and cargox_upi:
                upi_uri = "upi://pay?" + urlencode({
                    "pa": cargox_upi,
                    "pn": "CargoX Logistics",
                    "am": f"{exact_due:.2f}",
                    "tr": invoice.invoice_number,
                    "tn": f"Delivery Payment {invoice.invoice_number}",
                    "cu": "INR",
                })
                qr_image_url = "https://api.qrserver.com/v1/create-qr-code/?" + urlencode({
                    "size": "256x256",
                    "data": upi_uri,
                    "color": "0f172a",
                    "bgcolor": "ffffff",
                })

        payment_instructions = (
            f"Present this official CargoX QR code to the customer. Ask them to scan using Google Pay, PhonePe, Paytm, or BHIM. "
            f"Payment goes directly to CargoX corporate account ({cargox_upi or 'CargoX Finance'}). "
            f"If collecting Cash, record it using 'Record Collection' below."
        )

        return {
            "trip_id": trip.id,
            "request_id": request.id,
            "request_number": request.request_number,
            "status": request.status,
            "goods_type": request.goods_type,
            "goods_description": request.goods_description,
            "weight_tons": Decimal(str(request.weight_tons)),
            "distance_km": Decimal(str(request.distance_km)) if request.distance_km is not None else None,
            "special_instructions": request.special_instructions,
            "pickup_company_name": request.pickup_company_name,
            "pickup_address": request.pickup_address,
            "pickup_contact_person": request.pickup_contact_person,
            "pickup_phone": request.pickup_phone,
            "pickup_lat": request.pickup_lat,
            "pickup_lng": request.pickup_lng,
            "destination_company_name": request.destination_company_name,
            "destination_address": request.destination_address,
            "destination_contact_person": request.destination_contact_person,
            "destination_phone": request.destination_phone,
            "destination_lat": request.destination_lat,
            "destination_lng": request.destination_lng,
            "vehicle_registration": vehicle.registration_number,
            "vehicle_type": vehicle.type,
            "assigned_at": assignment.assigned_at,
            "pickup_started_at": trip.pickup_started_at,
            "started_at": trip.started_at,
            "arrived_at": trip.arrived_at,
            "current_lat": trip.current_lat,
            "current_lng": trip.current_lng,
            # Strictly confidential fields (customer charges & internal margins) are NEVER exposed
            "payment_method": payment_method_val,
            "collection_status": collection_status,
            "amount_due_for_collection": amount_due_col,
            "invoice_number": inv_num,
            # CargoX Business Payment Details
            "business_name": "CargoX Logistics",
            "cargox_upi_id": cargox_upi,
            "qr_image_url": qr_image_url,
            "upi_uri": upi_uri,
            "payment_status_display": payment_status_display,
            "gateway_order_id": gateway_order_id,
            "gateway_key_id": gateway_key_id,
            "payment_instructions": payment_instructions,
        }

    @staticmethod
    async def get_active_trip(driver_user: User) -> Dict[str, Any]:
        driver = await Driver.find_one(Driver.user_id == driver_user.id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        assignment = await VehicleAssignment.find_one(
            VehicleAssignment.driver_id == driver.id,
            VehicleAssignment.released_at == None
        )

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active trip assigned")

        trip = await Trip.find_one(Trip.id == assignment.trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        vehicle = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id)

        return await DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

    @staticmethod
    async def list_trip_history(driver_user: User) -> List[Dict[str, Any]]:
        driver = await Driver.find_one(Driver.user_id == driver_user.id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        past_assignments = await VehicleAssignment.find(
            VehicleAssignment.driver_id == driver.id,
            VehicleAssignment.released_at != None
        ).to_list()

        if not past_assignments:
            return []

        trip_ids = [a.trip_id for a in past_assignments]
        trips = await Trip.find({"_id": {"$in": trip_ids}}).to_list() if trip_ids else []
        trip_by_id = {t.id: t for t in trips}

        request_ids = [t.request_id for t in trips]
        requests = await DeliveryRequest.find({"_id": {"$in": request_ids}}).to_list() if request_ids else []
        request_by_id = {r.id: r for r in requests}

        vehicle_ids = [a.vehicle_id for a in past_assignments]
        vehicles = await Vehicle.find({"_id": {"$in": vehicle_ids}}).to_list() if vehicle_ids else []
        vehicle_by_id = {v.id: v for v in vehicles}

        invoices = await Invoice.find({"request_id": {"$in": request_ids}}).to_list() if request_ids else []
        invoice_by_req = {inv.request_id: inv for inv in invoices}

        history = []
        for assignment in past_assignments:
            trip = trip_by_id.get(assignment.trip_id)
            if trip:
                request = request_by_id.get(trip.request_id)
                vehicle = vehicle_by_id.get(assignment.vehicle_id)
                if request and vehicle:
                    # Direct assembly with in-memory invoice lookup
                    invoice = invoice_by_req.get(request.id)
                    pm = getattr(invoice, "payment_method", None)
                    payment_method_val = pm.value if pm else None
                    collection_status = "NOT_REQUIRED"
                    amount_due_col = None
                    inv_num = None

                    if invoice:
                        inv_num = invoice.invoice_number
                        if invoice.status == InvoiceStatus.PAID:
                            collection_status = "COLLECTED"
                            amount_due_col = Decimal("0.00")
                        elif payment_method_val == "PAY_ON_DELIVERY" or (not invoice.payment_method and invoice.amount_due > Decimal("0")):
                            collection_status = "DUE"
                            amount_due_col = Decimal(str(invoice.amount_due))
                        else:
                            collection_status = "PENDING_VERIFICATION" if invoice.payment_intent_status == "PENDING_CONFIRMATION" else "NOT_REQUIRED"
                            amount_due_col = Decimal(str(invoice.amount_due))

                    history.append({
                        "trip_id": trip.id,
                        "request_id": request.id,
                        "request_number": request.request_number,
                        "status": request.status,
                        "goods_type": request.goods_type,
                        "goods_description": request.goods_description,
                        "weight_tons": Decimal(str(request.weight_tons)),
                        "distance_km": Decimal(str(request.distance_km)) if request.distance_km is not None else None,
                        "special_instructions": request.special_instructions,
                        "pickup_company_name": request.pickup_company_name,
                        "pickup_address": request.pickup_address,
                        "pickup_contact_person": request.pickup_contact_person,
                        "pickup_phone": request.pickup_phone,
                        "pickup_lat": request.pickup_lat,
                        "pickup_lng": request.pickup_lng,
                        "destination_company_name": request.destination_company_name,
                        "destination_address": request.destination_address,
                        "destination_contact_person": request.destination_contact_person,
                        "destination_phone": request.destination_phone,
                        "destination_lat": request.destination_lat,
                        "destination_lng": request.destination_lng,
                        "vehicle_registration": vehicle.registration_number,
                        "vehicle_type": vehicle.type,
                        "assigned_at": assignment.assigned_at,
                        "pickup_started_at": trip.pickup_started_at,
                        "started_at": trip.started_at,
                        "arrived_at": trip.arrived_at,
                        "current_lat": trip.current_lat,
                        "current_lng": trip.current_lng,
                        "payment_method": payment_method_val,
                        "collection_status": collection_status,
                        "amount_due_for_collection": amount_due_col,
                        "invoice_number": inv_num
                    })
        return history

    @staticmethod
    async def update_location(trip_id: uuid.UUID, loc_in: LocationUpdate, driver_user: User) -> Dict[str, Any]:
        driver = await Driver.find_one(Driver.user_id == driver_user.id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        assignment = await VehicleAssignment.find_one(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        )

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        await AuthorizationService.verify_driver_trip_access(driver_user, assignment.driver_id, is_released=False)

        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        allowed_statuses = [
            DeliveryRequestStatus.DRIVER_ASSIGNED.value,
            DeliveryRequestStatus.PICKUP_IN_PROGRESS.value,
            DeliveryRequestStatus.IN_TRANSIT.value,
            DeliveryRequestStatus.ARRIVED.value
        ]
        if request.status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot update location for request in status '{request.status.value}'"
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        trip.current_lat = loc_in.lat
        trip.current_lng = loc_in.lng

        location_history = LocationHistory(
            trip_id=trip.id,
            lat=loc_in.lat,
            lng=loc_in.lng,
            recorded_at=now
        )
        await location_history.insert()
        await trip.save()
        return {"status": "ok", "current_lat": loc_in.lat, "current_lng": loc_in.lng}

    @staticmethod
    async def start_pickup(trip_id: uuid.UUID, driver_user: User) -> Dict[str, Any]:
        driver = await Driver.find_one(Driver.user_id == driver_user.id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        assignment = await VehicleAssignment.find_one(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        )

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        await AuthorizationService.verify_driver_trip_access(driver_user, assignment.driver_id, is_released=False)

        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        vehicle = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id)

        if request.status == DeliveryRequestStatus.PICKUP_IN_PROGRESS:
            return await DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

        if request.status != DeliveryRequestStatus.DRIVER_ASSIGNED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start pickup for delivery request in status '{request.status.value}'"
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        request.status = DeliveryRequestStatus.PICKUP_IN_PROGRESS
        trip.pickup_started_at = now

        customer_users = await NotificationService.resolve_customer_recipients(request.customer_company_id)
        for cust_user in customer_users:
            await NotificationService.create_notification(
                event_id=f"TRIP_PICKUP_STARTED:{trip.id}:CUST:{cust_user.id}",
                event_type="TRIP_PICKUP_STARTED",
                recipient_user_id=cust_user.id,
                channel=NotificationChannel.IN_APP,
                title="Pickup Started",
                message=f"Driver is on the way to pick up request {request.request_number}."
            )

        await trip.save()
        await request.save()
        await NotificationService.process_pending_notifications()
        return await DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

    @staticmethod
    async def start_transit(trip_id: uuid.UUID, driver_user: User) -> Dict[str, Any]:
        driver = await Driver.find_one(Driver.user_id == driver_user.id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        assignment = await VehicleAssignment.find_one(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        )

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        await AuthorizationService.verify_driver_trip_access(driver_user, assignment.driver_id, is_released=False)

        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        vehicle = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id)

        if request.status == DeliveryRequestStatus.IN_TRANSIT:
            return await DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

        if request.status != DeliveryRequestStatus.PICKUP_IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start transit for delivery request in status '{request.status.value}'"
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        request.status = DeliveryRequestStatus.IN_TRANSIT
        trip.picked_up_at = now
        trip.started_at = now

        customer_users = await NotificationService.resolve_customer_recipients(request.customer_company_id)
        for cust_user in customer_users:
            await NotificationService.create_notification(
                event_id=f"TRIP_IN_TRANSIT:{trip.id}:CUST:{cust_user.id}",
                event_type="TRIP_IN_TRANSIT",
                recipient_user_id=cust_user.id,
                channel=NotificationChannel.IN_APP,
                title="Trip In Transit",
                message=f"Request {request.request_number} has been picked up and is in transit."
            )

        await trip.save()
        await request.save()
        await NotificationService.process_pending_notifications()
        return await DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

    @staticmethod
    async def arrive(trip_id: uuid.UUID, driver_user: User) -> Dict[str, Any]:
        driver = await Driver.find_one(Driver.user_id == driver_user.id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        assignment = await VehicleAssignment.find_one(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        )

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        await AuthorizationService.verify_driver_trip_access(driver_user, assignment.driver_id, is_released=False)

        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        vehicle = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id)

        if request.status == DeliveryRequestStatus.ARRIVED:
            return await DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

        if request.status != DeliveryRequestStatus.IN_TRANSIT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot mark arrived for delivery request in status '{request.status.value}'"
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        request.status = DeliveryRequestStatus.ARRIVED
        trip.arrived_at = now

        customer_users = await NotificationService.resolve_customer_recipients(request.customer_company_id)
        for cust_user in customer_users:
            await NotificationService.create_notification(
                event_id=f"TRIP_ARRIVED:{trip.id}:CUST:{cust_user.id}",
                event_type="TRIP_ARRIVED",
                recipient_user_id=cust_user.id,
                channel=NotificationChannel.IN_APP,
                title="Driver Arrived",
                message=f"Driver has arrived at the destination for request {request.request_number}."
            )

        await trip.save()
        await request.save()
        await NotificationService.process_pending_notifications()
        return await DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

    @staticmethod
    async def record_trip_collection(
        trip_id: uuid.UUID,
        collection_in: DriverCollectionCreate,
        driver_user: User
    ) -> DriverCollectionRead:
        """
        Secure Pay on Delivery collection recorded by the authorized driver.
        Enforces:
        - Driver must be actively assigned to this trip.
        - Trip must be in ARRIVED, POD_SUBMITTED, DELIVERED, or COMPLETED status.
        - Invoice must exist and outstanding balance must be greater than zero.
        - Collection amount cannot exceed outstanding balance (no arbitrary overpayment).
        - Prevents duplicate reference numbers.
        - Records Payment with method CASH or UPI, recorded_by=driver_user.id.
        - Updates invoice amount_paid, amount_due, status (PAID if balance reached 0).
        - Confidentiality: Does NOT expose CargoX service fees or driver margins.
        """
        driver = await Driver.find_one(Driver.user_id == driver_user.id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        # Verify driver is assigned to this trip
        assignment = await VehicleAssignment.find_one(VehicleAssignment.trip_id == trip.id)
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip assignment not found")

        if assignment.driver_id != driver.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to collect payment for this trip")

        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        # Allowed statuses for collection
        allowed_statuses = [
            DeliveryRequestStatus.ARRIVED,
            DeliveryRequestStatus.POD_SUBMITTED,
            DeliveryRequestStatus.DELIVERED,
            DeliveryRequestStatus.COMPLETED
        ]
        if request.status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot record collection for trip in status '{request.status.value}'. Trip must be arrived or delivered."
            )

        invoice = await Invoice.find_one(Invoice.request_id == request.id)
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No invoice generated for this trip yet. Cannot record collection."
            )

        if invoice.status == InvoiceStatus.PAID or Decimal(str(invoice.amount_due)) <= Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This invoice is already fully settled. No further collection required."
            )

        coll_amount = Decimal(str(collection_in.amount))
        if coll_amount <= Decimal("0"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Collection amount must be greater than zero.")

        due_amount = Decimal(str(invoice.amount_due))
        if coll_amount > due_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Collection amount (₹{coll_amount}) exceeds outstanding balance (₹{due_amount}). Overpayment is not allowed."
            )

        # Validate collection payment method
        meth_str = collection_in.collection_method.upper().strip()
        if meth_str == "UPI":
            chosen_method = PaymentMethod.UPI
        elif meth_str in ("CASH", "PAY_ON_DELIVERY"):
            chosen_method = PaymentMethod.CASH
        else:
            chosen_method = PaymentMethod.CASH

        # Idempotency check if reference number is provided
        ref_num = collection_in.reference_number.strip() if collection_in.reference_number else None
        if ref_num:
            existing_payment = await Payment.find_one(Payment.reference_number == ref_num)
            if existing_payment:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A collection with reference number '{ref_num}' has already been recorded."
                )

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        payment = Payment(
            invoice_id=invoice.id,
            amount=coll_amount,
            method=chosen_method,
            reference_number=ref_num,
            notes=f"Pay on Delivery collected by Driver. {collection_in.notes or ''}".strip(),
            paid_at=now,
            recorded_by=driver_user.id
        )
        await payment.insert()

        # Update invoice
        invoice.amount_paid = Decimal(str(invoice.amount_paid)) + coll_amount
        invoice.amount_due = Decimal(str(invoice.total_amount)) - invoice.amount_paid
        invoice.payment_method = PaymentMethod.PAY_ON_DELIVERY
        if invoice.amount_due <= Decimal("0"):
            invoice.status = InvoiceStatus.PAID
            invoice.payment_intent_status = "COLLECTED"
        else:
            invoice.status = InvoiceStatus.PARTIALLY_PAID
            invoice.payment_intent_status = "PARTIALLY_COLLECTED"
        await invoice.save()

        # If trip is delivered and invoice is paid, complete the trip
        if invoice.status == InvoiceStatus.PAID and request.status == DeliveryRequestStatus.DELIVERED:
            from app.services.tracking_delivery_service import TrackingDeliveryService
            await TrackingDeliveryService.complete_trip(trip.id, driver_user)

        return DriverCollectionRead(
            payment_id=payment.id,
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            trip_id=trip.id,
            amount_collected=coll_amount,
            collection_method=chosen_method.value,
            reference_number=ref_num,
            collected_at=now,
            remaining_balance=invoice.amount_due,
            invoice_status=invoice.status.value,
            message="Payment collection recorded successfully and applied to invoice balance."
        )
