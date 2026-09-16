from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime, timezone
from decimal import Decimal
import uuid
from typing import Dict, Any, List, Optional

from app.models.delivery import DeliveryRequest, Trip, LocationHistory
from app.models.fleet import Vehicle, Driver, VehicleAssignment
from app.models.user import User
from app.models.enums import DeliveryRequestStatus, UserRole
from app.schemas.driver_pwa import LocationUpdate, DriverTripRead
from app.services.authorization import AuthorizationService
from app.services.notification_service import NotificationService
from app.models.notifications import NotificationChannel

class DriverService:
    @staticmethod
    def _build_driver_trip_read(trip: Trip, request: DeliveryRequest, vehicle: Vehicle, assignment: VehicleAssignment) -> Dict[str, Any]:
        return {
            "trip_id": trip.id,
            "request_id": request.id,
            "request_number": request.request_number,
            "status": request.status,
            "goods_type": request.goods_type,
            "goods_description": request.goods_description,
            "weight_tons": Decimal(str(request.weight_tons)),
            "special_instructions": request.special_instructions,
            "pickup_company_name": request.pickup_company_name,
            "pickup_address": request.pickup_address,
            "pickup_contact_person": request.pickup_contact_person,
            "pickup_phone": request.pickup_phone,
            "destination_company_name": request.destination_company_name,
            "destination_address": request.destination_address,
            "destination_contact_person": request.destination_contact_person,
            "destination_phone": request.destination_phone,
            "vehicle_registration": vehicle.registration_number,
            "vehicle_type": vehicle.type,
            "assigned_at": assignment.assigned_at,
            "pickup_started_at": trip.pickup_started_at,
            "started_at": trip.started_at,
            "arrived_at": trip.arrived_at,
            "current_lat": trip.current_lat,
            "current_lng": trip.current_lng
        }

    @staticmethod
    def get_active_trip(db: Session, driver_user: User) -> Dict[str, Any]:
        """
        Fetches the active assigned trip for the authenticated driver where released_at IS NULL.
        """
        if not driver_user.driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        assignment = db.query(VehicleAssignment).filter(
            VehicleAssignment.driver_id == driver_user.driver.id,
            VehicleAssignment.released_at == None
        ).first()

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active trip assigned")

        trip = db.query(Trip).filter(Trip.id == assignment.trip_id).first()
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == trip.request_id).first()
        vehicle = db.query(Vehicle).filter(Vehicle.id == assignment.vehicle_id).first()

        return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

    @staticmethod
    def list_trip_history(db: Session, driver_user: User) -> List[Dict[str, Any]]:
        """
        Returns past historical trips assigned to the driver (where released_at IS NOT NULL).
        """
        if not driver_user.driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        past_assignments = db.query(VehicleAssignment).filter(
            VehicleAssignment.driver_id == driver_user.driver.id,
            VehicleAssignment.released_at != None
        ).all()

        history = []
        for assignment in past_assignments:
            trip = db.query(Trip).filter(Trip.id == assignment.trip_id).first()
            if trip:
                request = db.query(DeliveryRequest).filter(DeliveryRequest.id == trip.request_id).first()
                vehicle = db.query(Vehicle).filter(Vehicle.id == assignment.vehicle_id).first()
                if request and vehicle:
                    history.append(DriverService._build_driver_trip_read(trip, request, vehicle, assignment))
        return history

    @staticmethod
    def update_location(db: Session, trip_id: uuid.UUID, loc_in: LocationUpdate, driver_user: User) -> Dict[str, Any]:
        """
        Updates the latest known location for the trip.
        Enforces active driver assignment verification (raises 404 on released assignment or unauthorized access).
        """
        if not driver_user.driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        trip = db.query(Trip).filter(Trip.id == trip_id).with_for_update().first()
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        assignment = db.query(VehicleAssignment).filter(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        ).first()

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        AuthorizationService.verify_driver_trip_access(driver_user, assignment.driver_id, is_released=False)

        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == trip.request_id).with_for_update().first()
        allowed_statuses = [
            DeliveryRequestStatus.DRIVER_ASSIGNED,
            DeliveryRequestStatus.PICKUP_IN_PROGRESS,
            DeliveryRequestStatus.IN_TRANSIT,
            DeliveryRequestStatus.ARRIVED
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
            id=uuid.uuid4(),
            trip_id=trip.id,
            lat=loc_in.lat,
            lng=loc_in.lng,
            recorded_at=now
        )
        db.add(location_history)
        db.commit()
        return {"status": "ok", "current_lat": loc_in.lat, "current_lng": loc_in.lng}

    @staticmethod
    def start_pickup(db: Session, trip_id: uuid.UUID, driver_user: User) -> Dict[str, Any]:
        """
        Driver starts pickup: transitions status from DRIVER_ASSIGNED to PICKUP_IN_PROGRESS.
        Idempotent against network retries.
        """
        if not driver_user.driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        trip = db.query(Trip).filter(Trip.id == trip_id).with_for_update().first()
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        assignment = db.query(VehicleAssignment).filter(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        ).first()

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        AuthorizationService.verify_driver_trip_access(driver_user, assignment.driver_id, is_released=False)

        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == trip.request_id).with_for_update().first()
        vehicle = db.query(Vehicle).filter(Vehicle.id == assignment.vehicle_id).first()

        # Idempotency check: if already in PICKUP_IN_PROGRESS, return current state without re-mutating timestamps
        if request.status == DeliveryRequestStatus.PICKUP_IN_PROGRESS:
            return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

        if request.status != DeliveryRequestStatus.DRIVER_ASSIGNED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start pickup for delivery request in status '{request.status.value}'"
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        request.status = DeliveryRequestStatus.PICKUP_IN_PROGRESS
        trip.pickup_started_at = now

        # Notification: TRIP_PICKUP_STARTED
        customer_users = NotificationService.resolve_customer_recipients(db, request.customer_company_id)
        for cust_user in customer_users:
            NotificationService.create_notification(
                db=db,
                event_id=f"TRIP_PICKUP_STARTED:{trip.id}:CUST:{cust_user.id}",
                event_type="TRIP_PICKUP_STARTED",
                recipient_user_id=cust_user.id,
                channel=NotificationChannel.IN_APP,
                title="Pickup Started",
                message=f"Driver is on the way to pick up request {request.request_number}."
            )

        db.commit()
        NotificationService.process_pending_notifications(db)
        db.refresh(trip)
        db.refresh(request)
        return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

    @staticmethod
    def start_transit(db: Session, trip_id: uuid.UUID, driver_user: User) -> Dict[str, Any]:
        """
        Driver completes pickup and starts transit: transitions status from PICKUP_IN_PROGRESS to IN_TRANSIT.
        Idempotent against network retries.
        """
        if not driver_user.driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        trip = db.query(Trip).filter(Trip.id == trip_id).with_for_update().first()
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        assignment = db.query(VehicleAssignment).filter(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        ).first()

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        AuthorizationService.verify_driver_trip_access(driver_user, assignment.driver_id, is_released=False)

        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == trip.request_id).with_for_update().first()
        vehicle = db.query(Vehicle).filter(Vehicle.id == assignment.vehicle_id).first()

        # Idempotency check: if already in IN_TRANSIT, return current state without re-mutating timestamps
        if request.status == DeliveryRequestStatus.IN_TRANSIT:
            return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

        if request.status != DeliveryRequestStatus.PICKUP_IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start transit for delivery request in status '{request.status.value}'"
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        request.status = DeliveryRequestStatus.IN_TRANSIT
        trip.picked_up_at = now
        trip.started_at = now

        # Notification: TRIP_IN_TRANSIT
        customer_users = NotificationService.resolve_customer_recipients(db, request.customer_company_id)
        for cust_user in customer_users:
            NotificationService.create_notification(
                db=db,
                event_id=f"TRIP_IN_TRANSIT:{trip.id}:CUST:{cust_user.id}",
                event_type="TRIP_IN_TRANSIT",
                recipient_user_id=cust_user.id,
                channel=NotificationChannel.IN_APP,
                title="Trip In Transit",
                message=f"Request {request.request_number} has been picked up and is in transit."
            )

        db.commit()
        NotificationService.process_pending_notifications(db)
        db.refresh(trip)
        db.refresh(request)
        return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

    @staticmethod
    def arrive(db: Session, trip_id: uuid.UUID, driver_user: User) -> Dict[str, Any]:
        """
        Driver marks arrival at destination: transitions status from IN_TRANSIT to ARRIVED.
        Idempotent against network retries.
        """
        if not driver_user.driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        trip = db.query(Trip).filter(Trip.id == trip_id).with_for_update().first()
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        assignment = db.query(VehicleAssignment).filter(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        ).first()

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        AuthorizationService.verify_driver_trip_access(driver_user, assignment.driver_id, is_released=False)

        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == trip.request_id).with_for_update().first()
        vehicle = db.query(Vehicle).filter(Vehicle.id == assignment.vehicle_id).first()

        # Idempotency check: if already in ARRIVED, return current state without re-mutating timestamps
        if request.status == DeliveryRequestStatus.ARRIVED:
            return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

        if request.status != DeliveryRequestStatus.IN_TRANSIT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot mark arrived for delivery request in status '{request.status.value}'"
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        request.status = DeliveryRequestStatus.ARRIVED
        trip.arrived_at = now

        # Notification: TRIP_ARRIVED
        customer_users = NotificationService.resolve_customer_recipients(db, request.customer_company_id)
        for cust_user in customer_users:
            NotificationService.create_notification(
                db=db,
                event_id=f"TRIP_ARRIVED:{trip.id}:CUST:{cust_user.id}",
                event_type="TRIP_ARRIVED",
                recipient_user_id=cust_user.id,
                channel=NotificationChannel.IN_APP,
                title="Driver Arrived",
                message=f"Driver has arrived at the destination for request {request.request_number}."
            )

        db.commit()
        NotificationService.process_pending_notifications(db)
        db.refresh(trip)
        db.refresh(request)
        return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)
