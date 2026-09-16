from sqlalchemy.orm import Session
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

class TrackingDeliveryService:
    @staticmethod
    def submit_pod(db: Session, trip_id: uuid.UUID, pod_in: PODSubmission, driver_user: User) -> ProofOfDelivery:
        # Check active driver profile
        driver = db.query(Driver).filter(Driver.user_id == driver_user.id).first()
        if not driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a driver")

        # Fetch trip with active assignment (released_at IS NULL)
        trip = db.query(Trip).join(VehicleAssignment, Trip.id == VehicleAssignment.trip_id)\
            .filter(
                Trip.id == trip_id,
                VehicleAssignment.driver_id == driver.id,
                VehicleAssignment.released_at.is_(None)
            ).first()

        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active trip assignment not found")

        # Check duplicate POD first — must always return 409 regardless of current state
        existing_pod = db.query(ProofOfDelivery).filter(ProofOfDelivery.trip_id == trip.id).first()
        if existing_pod:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="POD has already been submitted for this trip")

        # Validate DeliveryRequest status
        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == trip.request_id).with_for_update().first()
        if not request or request.status != DeliveryRequestStatus.ARRIVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot submit POD for request in status '{request.status if request else 'None'}'. Must be in ARRIVED status."
            )

        # Create POD record
        pod = ProofOfDelivery(
            id=uuid.uuid4(),
            trip_id=trip.id,
            file_url=pod_in.pod_photo_url or pod_in.pod_signature_url or "https://storage.cargox.com/default_pod.png",
            notes=pod_in.notes,
            submitted_at=datetime.now(timezone.utc),
            submitted_by=driver_user.id
        )
        db.add(pod)

        # Transition request status ARRIVED -> POD_SUBMITTED
        request.status = DeliveryRequestStatus.POD_SUBMITTED
        db.commit()
        db.refresh(pod)
        return pod

    @staticmethod
    def verify_pod(db: Session, trip_id: uuid.UUID, admin_user: User) -> ProofOfDelivery:
        # Lock Trip & DeliveryRequest
        trip = db.query(Trip).filter(Trip.id == trip_id).with_for_update().first()
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == trip.request_id).with_for_update().first()
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        # Validate transition POD_SUBMITTED -> DELIVERED
        if request.status != DeliveryRequestStatus.POD_SUBMITTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot verify POD for request in status '{request.status}'. Request must be in POD_SUBMITTED status."
            )

        pod = db.query(ProofOfDelivery).filter(ProofOfDelivery.trip_id == trip.id).first()
        if not pod:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proof of Delivery record not found")

        now = datetime.now(timezone.utc)
        trip.delivered_at = now
        request.status = DeliveryRequestStatus.DELIVERED

        db.commit()
        db.refresh(pod)
        return pod

    @staticmethod
    def complete_trip(db: Session, trip_id: uuid.UUID, admin_user: User) -> Trip:
        # Lock Trip and DeliveryRequest
        trip = db.query(Trip).filter(Trip.id == trip_id).with_for_update().first()
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == trip.request_id).with_for_update().first()
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        # Validate transition DELIVERED -> COMPLETED
        if request.status != DeliveryRequestStatus.DELIVERED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot complete trip for request in status '{request.status}'. Request must be in DELIVERED status."
            )

        # Lock active VehicleAssignment
        assignment = db.query(VehicleAssignment).filter(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at.is_(None)
        ).with_for_update().first()

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active vehicle assignment not found for this trip")

        # Lock Vehicle & Driver resources
        vehicle = db.query(Vehicle).filter(Vehicle.id == assignment.vehicle_id).with_for_update().first()
        driver = db.query(Driver).filter(Driver.id == assignment.driver_id).with_for_update().first()

        now = datetime.now(timezone.utc)

        # Transition request status to COMPLETED and set timestamp
        request.status = DeliveryRequestStatus.COMPLETED
        trip.completed_at = now

        # Release resources
        assignment.released_at = now
        if vehicle:
            vehicle.status = VehicleStatus.AVAILABLE
        if driver:
            driver.status = DriverStatus.AVAILABLE

        db.commit()
        db.refresh(trip)
        return trip

    @staticmethod
    def get_customer_tracking(db: Session, request_id: uuid.UUID, customer_user: User) -> CustomerTrackingRead:
        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == request_id).first()
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        # Verify tenant access via AuthorizationService
        AuthorizationService.verify_customer_access(customer_user, request.customer_company_id)


        trip = db.query(Trip).filter(Trip.request_id == request.id).first()

        live_statuses = [
            DeliveryRequestStatus.DRIVER_ASSIGNED,
            DeliveryRequestStatus.PICKUP_IN_PROGRESS,
            DeliveryRequestStatus.IN_TRANSIT,
            DeliveryRequestStatus.ARRIVED
        ]
        is_live = request.status in live_statuses

        breadcrumbs_list = []
        if trip:
            breadcrumbs = db.query(LocationHistory).filter(
                LocationHistory.trip_id == trip.id
            ).order_by(LocationHistory.recorded_at.asc()).limit(500).all()

            breadcrumbs_list = [
                LocationBreadcrumbRead(lat=b.lat, lng=b.lng, recorded_at=b.recorded_at)
                for b in breadcrumbs
            ]

        return CustomerTrackingRead(
            request_id=request.id,
            tracking_number=request.request_number,
            status=request.status.value if hasattr(request.status, 'value') else str(request.status),
            origin_address=request.pickup_address,
            destination_address=request.destination_address,
            current_lat=trip.current_lat if trip else None,
            current_lng=trip.current_lng if trip else None,
            last_location_update=trip.location_history[-1].recorded_at if (trip and trip.location_history) else None,
            is_live=is_live,
            submitted_at=request.created_at,
            quoted_at=request.quotation.created_at if request.quotation else None,
            accepted_at=request.quotation.accepted_at if (request.quotation and hasattr(request.quotation, 'accepted_at')) else None,
            assigned_at=trip.assigned_at if trip else None,
            pickup_started_at=trip.pickup_started_at if trip else None,
            picked_up_at=trip.picked_up_at if trip else None,
            started_at=trip.started_at if trip else None,
            arrived_at=trip.arrived_at if trip else None,
            delivered_at=trip.delivered_at if trip else None,
            completed_at=trip.completed_at if trip else None,
            breadcrumbs=breadcrumbs_list
        )

