from fastapi import HTTPException, status
from datetime import datetime, timezone
import uuid
from typing import List

from app.models.user import User
from app.models.delivery import DeliveryRequest, Trip, ProofOfDelivery, LocationHistory
from app.models.fleet import Vehicle, Driver, VehicleAssignment
from app.models.enums import DeliveryRequestStatus, VehicleStatus, DriverStatus
from app.schemas.tracking_delivery import PODSubmission, CustomerTrackingRead, LocationBreadcrumbRead
from app.services.authorization import AuthorizationService
from app.services.notification_service import NotificationService
from app.models.notifications import NotificationChannel
from app.services.invoice_service import InvoiceService
from app.schemas.invoice import InvoiceCreate

class TrackingDeliveryService:
    @staticmethod
    async def submit_pod(trip_id: uuid.UUID, pod_in: PODSubmission, driver_user: User) -> ProofOfDelivery:
        # Check active driver profile
        driver = await Driver.find_one(Driver.user_id == driver_user.id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a driver")

        # Fetch active assignment
        assignment = await VehicleAssignment.find_one(
            VehicleAssignment.trip_id == trip_id,
            VehicleAssignment.driver_id == driver.id,
            VehicleAssignment.released_at == None
        )
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active trip assignment not found")

        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        # Check duplicate POD first — must always return 409 regardless of current state
        existing_pod = await ProofOfDelivery.find_one(ProofOfDelivery.trip_id == trip.id)
        if existing_pod:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="POD has already been submitted for this trip")

        # Validate DeliveryRequest status
        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        if not request or request.status != DeliveryRequestStatus.ARRIVED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot submit POD for request in status '{request.status if request else 'None'}'. Must be in ARRIVED status."
            )

        # Coerce AnyHttpUrl to str (Pydantic v2 AnyHttpUrl is not a plain str)
        pod_photo = str(pod_in.pod_photo_url) if pod_in.pod_photo_url else None
        pod_sig = str(pod_in.pod_signature_url) if pod_in.pod_signature_url else None

        # Create POD record
        pod = ProofOfDelivery(
            trip_id=trip.id,
            file_url=pod_photo or pod_sig or "https://storage.cargox.com/default_pod.png",
            notes=pod_in.notes,
            submitted_at=datetime.now(timezone.utc),
            submitted_by=driver_user.id
        )

        await pod.insert()

        # Transition request status ARRIVED -> POD_SUBMITTED
        request.status = DeliveryRequestStatus.POD_SUBMITTED
        await request.save()
        
        # Notification: POD_SUBMITTED (to Admins)
        admin_users = await NotificationService.resolve_admin_recipients()
        for admin in admin_users:
            await NotificationService.create_notification(
                event_id=f"POD_SUBMITTED:{trip.id}:ADMIN:{admin.id}",
                event_type="POD_SUBMITTED",
                recipient_user_id=admin.id,
                channel=NotificationChannel.IN_APP,
                title="POD Submitted",
                message=f"POD submitted for request {request.request_number} and needs verification."
            )
            
        await NotificationService.process_pending_notifications()
        return pod

    @staticmethod
    async def verify_pod(trip_id: uuid.UUID, admin_user: User) -> ProofOfDelivery:
        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        # Validate transition POD_SUBMITTED -> DELIVERED
        if request.status != DeliveryRequestStatus.POD_SUBMITTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot verify POD for request in status '{request.status}'. Request must be in POD_SUBMITTED status."
            )

        pod = await ProofOfDelivery.find_one(ProofOfDelivery.trip_id == trip.id)
        if not pod:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proof of Delivery record not found")

        now = datetime.now(timezone.utc)
        trip.delivered_at = now
        request.status = DeliveryRequestStatus.DELIVERED

        # Notification: TRIP_DELIVERED (to Customer)
        customer_users = await NotificationService.resolve_customer_recipients(request.customer_company_id)
        for cust_user in customer_users:
            await NotificationService.create_notification(
                event_id=f"TRIP_DELIVERED:{trip.id}:CUST:{cust_user.id}",
                event_type="TRIP_DELIVERED",
                recipient_user_id=cust_user.id,
                channel=NotificationChannel.IN_APP,
                title="Trip Delivered",
                message=f"Request {request.request_number} has been delivered."
            )

        await trip.save()
        await request.save()
        await NotificationService.process_pending_notifications()
        return pod

    @staticmethod
    async def complete_trip(trip_id: uuid.UUID, admin_user: User) -> Trip:
        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        # Validate transition DELIVERED -> COMPLETED
        if request.status != DeliveryRequestStatus.DELIVERED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot complete trip for request in status '{request.status}'. Request must be in DELIVERED status."
            )

        # Lock active VehicleAssignment
        assignment = await VehicleAssignment.find_one(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        )

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active vehicle assignment not found for this trip")

        # Lock Vehicle & Driver resources
        vehicle = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id)
        driver = await Driver.find_one(Driver.id == assignment.driver_id)

        now = datetime.now(timezone.utc)

        # Transition request status to COMPLETED and set timestamp
        request.status = DeliveryRequestStatus.COMPLETED
        trip.completed_at = now

        # Release resources
        assignment.released_at = now
        if vehicle:
            vehicle.status = VehicleStatus.AVAILABLE
            await vehicle.save()
        if driver:
            driver.status = DriverStatus.AVAILABLE
            await driver.save()

        # Notification: TRIP_COMPLETED (to Customer)
        customer_users = await NotificationService.resolve_customer_recipients(request.customer_company_id)
        for cust_user in customer_users:
            await NotificationService.create_notification(
                event_id=f"TRIP_COMPLETED:{trip.id}:CUST:{cust_user.id}",
                event_type="TRIP_COMPLETED",
                recipient_user_id=cust_user.id,
                channel=NotificationChannel.IN_APP,
                title="Trip Completed",
                message=f"Request {request.request_number} trip is now completed."
            )

        await trip.save()
        await assignment.save()
        await request.save()
        await NotificationService.process_pending_notifications()
        
        # Auto-generate Invoice
        try:
            await InvoiceService.generate_invoice(trip.id, InvoiceCreate(), admin_user)
        except Exception as e:
            import logging
            logging.getLogger("cargox").error(f"Failed to auto-generate invoice for trip {trip.id}: {e}", exc_info=True)
            
        return trip

    @staticmethod
    async def get_customer_tracking(request_id: uuid.UUID, customer_user: User) -> CustomerTrackingRead:
        request = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        # Verify tenant access via AuthorizationService
        AuthorizationService.verify_customer_access(customer_user, request.customer_company_id)


        trip = await Trip.find_one(Trip.request_id == request.id)

        live_statuses = [
            DeliveryRequestStatus.DRIVER_ASSIGNED.value,
            DeliveryRequestStatus.PICKUP_IN_PROGRESS.value,
            DeliveryRequestStatus.IN_TRANSIT.value,
            DeliveryRequestStatus.ARRIVED.value
        ]
        is_live = request.status in live_statuses

        breadcrumbs_list = []
        last_loc = None
        if trip:
            breadcrumbs = await LocationHistory.find(
                LocationHistory.trip_id == trip.id
            ).sort("+recorded_at").limit(500).to_list()

            breadcrumbs_list = [
                LocationBreadcrumbRead(lat=b.lat, lng=b.lng, recorded_at=b.recorded_at)
                for b in breadcrumbs
            ]
            if len(breadcrumbs) > 0:
                last_loc = breadcrumbs[-1].recorded_at

        # Fetch quotation if exists for timestamps
        from app.models.pricing import Quotation
        quotation = await Quotation.find_one(Quotation.request_id == request.id)

        driver_name = None
        driver_phone = None
        vehicle_registration = None
        vehicle_type = None
        vehicle_capacity_tons = None
        if trip:
            assignment = await VehicleAssignment.find_one(
                VehicleAssignment.trip_id == trip.id,
                sort=[("assigned_at", -1)],
            )
            if assignment:
                driver = await Driver.find_one(Driver.id == assignment.driver_id)
                vehicle = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id)
                driver_name = driver.name if driver else None
                driver_phone = driver.phone if driver else None
                vehicle_registration = vehicle.registration_number if vehicle else None
                vehicle_type = vehicle.type.value if vehicle and hasattr(vehicle.type, "value") else (str(vehicle.type) if vehicle else None)
                vehicle_capacity_tons = vehicle.capacity_tons if vehicle else None

        return CustomerTrackingRead(
            request_id=request.id,
            tracking_number=request.request_number,
            status=request.status.value if hasattr(request.status, 'value') else str(request.status),
            origin_address=request.pickup_address,
            destination_address=request.destination_address,
            current_lat=trip.current_lat if trip else None,
            current_lng=trip.current_lng if trip else None,
            last_location_update=last_loc,
            is_live=is_live,
            submitted_at=request.created_at,
            quoted_at=quotation.created_at if quotation else None,
            accepted_at=quotation.accepted_at if quotation else None,
            assigned_at=trip.assigned_at if trip else None,
            pickup_started_at=trip.pickup_started_at if trip else None,
            picked_up_at=trip.picked_up_at if trip else None,
            started_at=trip.started_at if trip else None,
            arrived_at=trip.arrived_at if trip else None,
            delivered_at=trip.delivered_at if trip else None,
            completed_at=trip.completed_at if trip else None,
            driver_name=driver_name,
            driver_phone=driver_phone,
            vehicle_registration=vehicle_registration,
            vehicle_type=vehicle_type,
            vehicle_capacity_tons=vehicle_capacity_tons,
            breadcrumbs=breadcrumbs_list
        )
