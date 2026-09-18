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

        return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

    @staticmethod
    async def list_trip_history(driver_user: User) -> List[Dict[str, Any]]:
        driver = await Driver.find_one(Driver.user_id == driver_user.id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        past_assignments = await VehicleAssignment.find(
            VehicleAssignment.driver_id == driver.id,
            VehicleAssignment.released_at != None
        ).to_list()

        history = []
        for assignment in past_assignments:
            trip = await Trip.find_one(Trip.id == assignment.trip_id)
            if trip:
                request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
                vehicle = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id)
                if request and vehicle:
                    history.append(DriverService._build_driver_trip_read(trip, request, vehicle, assignment))
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
            return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

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
        return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

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
        return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

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
            return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)

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
        return DriverService._build_driver_trip_read(trip, request, vehicle, assignment)
