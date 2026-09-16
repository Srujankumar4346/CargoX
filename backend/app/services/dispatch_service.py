from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from decimal import Decimal
from datetime import datetime, timezone
import uuid
from typing import Dict, Any

from app.models.delivery import DeliveryRequest, Trip
from app.models.fleet import Vehicle, Driver, VehicleAssignment
from app.models.user import User
from app.models.enums import DeliveryRequestStatus, VehicleStatus, DriverStatus, UserRole
from app.schemas.dispatch import DispatchRequest
from app.services.notification_service import NotificationService
from app.models.notifications import NotificationChannel
from app.services.compliance_service import ComplianceService

class DispatchService:
    @staticmethod
    def dispatch_request(
        db: Session,
        request_id: uuid.UUID,
        dispatch_in: DispatchRequest,
        admin_user: User
    ) -> Dict[str, Any]:
        """
        Dispatches an ACCEPTED delivery request to a vehicle and driver.
        Acquires row-level locks (.with_for_update()) for request, vehicle, driver, and user.
        Atomically updates request, vehicle, and driver statuses and creates Trip + VehicleAssignment.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Verify Compliance before anything
        ComplianceService.validate_dispatch_eligibility(db, dispatch_in.vehicle_id, dispatch_in.driver_id)

        # 1. Lock and validate DeliveryRequest
        request = db.query(DeliveryRequest).filter(
            DeliveryRequest.id == request_id
        ).with_for_update().first()

        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        if request.status != DeliveryRequestStatus.ACCEPTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Delivery request must be in ACCEPTED status to dispatch. Current status: '{request.status.value}'"
            )

        # Single active Trip invariant check
        existing_trip = db.query(Trip).filter(Trip.request_id == request_id).first()
        if existing_trip:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A trip has already been dispatched for this delivery request"
            )

        # 2. Lock and validate Vehicle
        vehicle = db.query(Vehicle).filter(
            Vehicle.id == dispatch_in.vehicle_id
        ).with_for_update().first()

        if not vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

        if vehicle.status != VehicleStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Vehicle is currently unavailable for assignment (status: {vehicle.status.value})"
            )

        veh_capacity = Decimal(str(vehicle.capacity_tons))
        req_weight = Decimal(str(request.weight_tons))
        if veh_capacity < req_weight:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vehicle capacity ({veh_capacity} tons) is insufficient for cargo weight ({req_weight} tons)"
            )

        # 3. Lock and validate Driver & User
        driver = db.query(Driver).filter(
            Driver.id == dispatch_in.driver_id
        ).with_for_update().first()

        if not driver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

        if driver.status != DriverStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Driver is currently unavailable for assignment (status: {driver.status.value})"
            )

        driver_user = db.query(User).filter(
            User.id == driver.user_id
        ).with_for_update().first()

        if not driver_user or not driver_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Driver user account is inactive or invalid"
            )

        # 4. Atomic Execution
        trip = Trip(
            id=uuid.uuid4(),
            request_id=request_id,
            assigned_at=now
        )
        db.add(trip)
        db.flush()  # obtain trip.id

        assignment = VehicleAssignment(
            id=uuid.uuid4(),
            trip_id=trip.id,
            vehicle_id=vehicle.id,
            driver_id=driver.id,
            assigned_at=now,
            released_at=None
        )
        db.add(assignment)

        request.status = DeliveryRequestStatus.DRIVER_ASSIGNED
        vehicle.status = VehicleStatus.ASSIGNED
        driver.status = DriverStatus.ON_TRIP

        # Notification: TRIP_DISPATCHED
        # Driver notification
        NotificationService.create_notification(
            db=db,
            event_id=f"TRIP_DISPATCHED:{trip.id}:DRIVER",
            event_type="TRIP_DISPATCHED",
            recipient_user_id=driver_user.id,
            channel=NotificationChannel.IN_APP,
            title="Trip Dispatched",
            message=f"You have been assigned to trip {trip.id} for request {request.request_number}."
        )
        
        # Customer notification
        customer_users = NotificationService.resolve_customer_recipients(db, request.customer_company_id)
        for cust_user in customer_users:
            NotificationService.create_notification(
                db=db,
                event_id=f"TRIP_DISPATCHED:{trip.id}:CUST:{cust_user.id}",
                event_type="TRIP_DISPATCHED",
                recipient_user_id=cust_user.id,
                channel=NotificationChannel.IN_APP,
                title="Trip Dispatched",
                message=f"Your request {request.request_number} has been dispatched."
            )

        db.commit()
        
        # Process notifications after commit
        NotificationService.process_pending_notifications(db)
        
        db.refresh(trip)
        db.refresh(assignment)

        return {
            "trip_id": trip.id,
            "request_id": request_id,
            "vehicle_id": vehicle.id,
            "driver_id": driver.id,
            "assigned_at": now,
            "request_status": request.status,
            "assignment": assignment
        }

    @staticmethod
    def reassign_request(
        db: Session,
        request_id: uuid.UUID,
        dispatch_in: DispatchRequest,
        admin_user: User
    ) -> Dict[str, Any]:
        """
        Reassigns vehicle and driver for an unstarted trip.
        Preserves assignment history by setting released_at on the previous assignment.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Verify Compliance before anything
        ComplianceService.validate_dispatch_eligibility(db, dispatch_in.vehicle_id, dispatch_in.driver_id)

        # 1. Lock DeliveryRequest & Trip
        request = db.query(DeliveryRequest).filter(
            DeliveryRequest.id == request_id
        ).with_for_update().first()

        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        if request.status != DeliveryRequestStatus.DRIVER_ASSIGNED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reassignment requires request status 'DRIVER_ASSIGNED'. Current status: '{request.status.value}'"
            )

        trip = db.query(Trip).filter(
            Trip.request_id == request_id
        ).with_for_update().first()

        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found for request")

        if trip.started_at is not None or trip.picked_up_at is not None or trip.delivered_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reassign dispatch for a trip that has already started"
            )

        # 2. Fetch and release current active assignment
        active_assignment = db.query(VehicleAssignment).filter(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        ).with_for_update().first()

        if active_assignment:
            active_assignment.released_at = now
            # Return old vehicle and driver to AVAILABLE
            old_vehicle = db.query(Vehicle).filter(Vehicle.id == active_assignment.vehicle_id).with_for_update().first()
            if old_vehicle:
                old_vehicle.status = VehicleStatus.AVAILABLE
            old_driver = db.query(Driver).filter(Driver.id == active_assignment.driver_id).with_for_update().first()
            if old_driver:
                old_driver.status = DriverStatus.AVAILABLE

        # 3. Lock & validate NEW Vehicle
        new_vehicle = db.query(Vehicle).filter(
            Vehicle.id == dispatch_in.vehicle_id
        ).with_for_update().first()

        if not new_vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="New vehicle not found")

        if new_vehicle.status != VehicleStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"New vehicle is currently unavailable for assignment (status: {new_vehicle.status.value})"
            )

        veh_capacity = Decimal(str(new_vehicle.capacity_tons))
        req_weight = Decimal(str(request.weight_tons))
        if veh_capacity < req_weight:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"New vehicle capacity ({veh_capacity} tons) is insufficient for cargo weight ({req_weight} tons)"
            )

        # 4. Lock & validate NEW Driver & User
        new_driver = db.query(Driver).filter(
            Driver.id == dispatch_in.driver_id
        ).with_for_update().first()

        if not new_driver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="New driver not found")

        if new_driver.status != DriverStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"New driver is currently unavailable for assignment (status: {new_driver.status.value})"
            )

        new_driver_user = db.query(User).filter(
            User.id == new_driver.user_id
        ).with_for_update().first()

        if not new_driver_user or not new_driver_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="New driver user account is inactive or invalid"
            )

        # 5. Create new assignment under existing Trip
        new_assignment = VehicleAssignment(
            id=uuid.uuid4(),
            trip_id=trip.id,
            vehicle_id=new_vehicle.id,
            driver_id=new_driver.id,
            assigned_at=now,
            released_at=None
        )
        db.add(new_assignment)

        new_vehicle.status = VehicleStatus.ASSIGNED
        new_driver.status = DriverStatus.ON_TRIP

        db.commit()
        db.refresh(new_assignment)

        return {
            "trip_id": trip.id,
            "request_id": request_id,
            "vehicle_id": new_vehicle.id,
            "driver_id": new_driver.id,
            "assigned_at": now,
            "request_status": request.status,
            "assignment": new_assignment
        }
