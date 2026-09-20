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

class DispatchService:
    @staticmethod
    async def dispatch_request(
        request_id: uuid.UUID,
        dispatch_in: DispatchRequest,
        admin_user: User
    ) -> Dict[str, Any]:
        """
        Dispatches an ACCEPTED delivery request to a vehicle and driver.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # 1. Lock and validate DeliveryRequest
        request = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)

        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        if request.status != DeliveryRequestStatus.ACCEPTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Delivery request must be in ACCEPTED status to dispatch. Current status: '{request.status.value}'"
            )

        # Single active Trip invariant check
        existing_trip = await Trip.find_one(Trip.request_id == request_id)
        if existing_trip:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A trip has already been dispatched for this delivery request"
            )

        # 2. Lock and validate Vehicle
        vehicle = await Vehicle.find_one(Vehicle.id == dispatch_in.vehicle_id)

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
        driver = await Driver.find_one(Driver.id == dispatch_in.driver_id)

        if not driver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

        if driver.status != DriverStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Driver is currently unavailable for assignment (status: {driver.status.value})"
            )



        # 4. Atomic Execution
        trip = Trip(
            request_id=request_id,
            assigned_at=now
        )
        await trip.insert()

        assignment = VehicleAssignment(
            trip_id=trip.id,
            vehicle_id=vehicle.id,
            driver_id=driver.id,
            assigned_at=now,
            released_at=None
        )
        await assignment.insert()

        request.status = DeliveryRequestStatus.DRIVER_ASSIGNED
        vehicle.status = VehicleStatus.ASSIGNED
        driver.status = DriverStatus.ON_TRIP

        await request.save()
        await vehicle.save()
        await driver.save()

        # Notification: TRIP_DISPATCHED
        # Driver notification (Skipped because Drivers no longer have User accounts for in-app notifications)
        # await NotificationService.create_notification(...)
        
        # Customer notification
        customer_users = await NotificationService.resolve_customer_recipients(request.customer_company_id)
        for cust_user in customer_users:
            await NotificationService.create_notification(
                event_id=f"TRIP_DISPATCHED:{trip.id}:CUST:{cust_user.id}",
                event_type="TRIP_DISPATCHED",
                recipient_user_id=cust_user.id,
                channel=NotificationChannel.IN_APP,
                title="Trip Dispatched",
                message=f"Your request {request.request_number} has been dispatched."
            )
        
        # Process notifications after commit
        await NotificationService.process_pending_notifications()

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
    async def reassign_request(
        request_id: uuid.UUID,
        dispatch_in: DispatchRequest,
        admin_user: User
    ) -> Dict[str, Any]:
        """
        Reassigns vehicle and driver for an unstarted trip.
        Preserves assignment history by setting released_at on the previous assignment.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # 1. Lock DeliveryRequest & Trip
        request = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)

        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        if request.status != DeliveryRequestStatus.DRIVER_ASSIGNED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reassignment requires request status 'DRIVER_ASSIGNED'. Current status: '{request.status.value}'"
            )

        trip = await Trip.find_one(Trip.request_id == request_id)

        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found for request")

        if trip.started_at is not None or trip.picked_up_at is not None or trip.delivered_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reassign dispatch for a trip that has already started"
            )

        # 2. Fetch and release current active assignment
        active_assignment = await VehicleAssignment.find_one(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        )

        if active_assignment:
            active_assignment.released_at = now
            await active_assignment.save()
            # Return old vehicle and driver to AVAILABLE
            old_vehicle = await Vehicle.find_one(Vehicle.id == active_assignment.vehicle_id)
            if old_vehicle:
                old_vehicle.status = VehicleStatus.AVAILABLE
                await old_vehicle.save()
            old_driver = await Driver.find_one(Driver.id == active_assignment.driver_id)
            if old_driver:
                old_driver.status = DriverStatus.AVAILABLE
                await old_driver.save()

        # 3. Lock & validate NEW Vehicle
        new_vehicle = await Vehicle.find_one(Vehicle.id == dispatch_in.vehicle_id)

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
        new_driver = await Driver.find_one(Driver.id == dispatch_in.driver_id)

        if not new_driver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="New driver not found")

        if new_driver.status != DriverStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"New driver is currently unavailable for assignment (status: {new_driver.status.value})"
            )



        # 5. Create new assignment under existing Trip
        new_assignment = VehicleAssignment(
            trip_id=trip.id,
            vehicle_id=new_vehicle.id,
            driver_id=new_driver.id,
            assigned_at=now,
            released_at=None
        )
        await new_assignment.insert()

        new_vehicle.status = VehicleStatus.ASSIGNED
        new_driver.status = DriverStatus.ON_TRIP

        await new_vehicle.save()
        await new_driver.save()

        return {
            "trip_id": trip.id,
            "request_id": request_id,
            "vehicle_id": new_vehicle.id,
            "driver_id": new_driver.id,
            "assigned_at": now,
            "request_status": request.status,
            "assignment": new_assignment
        }
