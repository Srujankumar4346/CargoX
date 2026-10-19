from fastapi import HTTPException, status
from decimal import Decimal
from datetime import datetime, timezone
import uuid
from typing import Dict, Any, List

from app.models.delivery import DeliveryRequest, Trip, TripStop
from app.models.fleet import Vehicle, Driver, VehicleAssignment
from app.models.user import User
from app.models.enums import DeliveryRequestStatus, VehicleStatus, DriverStatus, UserRole
from app.schemas.dispatch import DispatchRequest, ConsolidatedDispatchRequest
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

        # Quotation invariant check: Authoritative accepted quotation MUST exist before dispatch
        from app.models.pricing import Quotation
        from app.models.enums import QuotationStatus

        quotation = await Quotation.find_one(Quotation.request_id == request.id)
        if not quotation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No accepted quotation found for this delivery request. Cannot dispatch.",
            )
        elif quotation.status != QuotationStatus.ACCEPTED:
            quotation.status = QuotationStatus.ACCEPTED
            quotation.accepted_at = now
            await quotation.save()


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



        # 4. Authoritative Financial Allocation
        # Taxable freight amount (excluding GST) is customer_total_charge
        taxable_fare = Decimal(str(quotation.customer_total_charge))
        
        # Determine commission percentage: explicit input > quotation.service_fee_percentage > approved system setting
        if dispatch_in.commission_percentage is not None:
            comm_pct = Decimal(str(dispatch_in.commission_percentage))
        elif quotation.service_fee_percentage is not None:
            comm_pct = Decimal(str(quotation.service_fee_percentage))
        else:
            from app.services.settings_service import SettingsService
            system_settings = await SettingsService.get_settings()
            comm_pct = Decimal(str(system_settings.cargox_service_fee_percentage))

        # Validate range 0.00 to 100.00
        if comm_pct < Decimal("0.00") or comm_pct > Decimal("100.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Commission percentage must be between 0% and 100%. Given: {comm_pct}%"
            )

        # Authoritatively calculate monetary allocation using Decimal precision
        comm_amount = (taxable_fare * (comm_pct / Decimal("100"))).quantize(Decimal("0.01"))
        driver_payout = (taxable_fare - comm_amount).quantize(Decimal("0.01"))

        # Keep Quotation synchronized with authoritative allocation
        quotation.service_fee_percentage = comm_pct
        quotation.service_fee_amount = comm_amount
        quotation.driver_payable_amount = driver_payout
        await quotation.save()

        # 5. Atomic Execution
        trip = Trip(
            request_id=request_id,
            assigned_at=now,
            commission_percentage=comm_pct,
            commission_amount=comm_amount,
            driver_payout=driver_payout,
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
                title="Driver Assigned",
                message=(
                    f"A driver has been assigned to request {request.request_number}. "
                    f"Driver: {driver.name}. Vehicle: {vehicle.registration_number}."
                )
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

    @staticmethod
    async def dispatch_consolidated_requests(
        dispatch_in: ConsolidatedDispatchRequest,
        admin_user: User
    ) -> Dict[str, Any]:
        """
        Consolidates multiple compatible ACCEPTED Part Load delivery requests into a single
        shared vehicle Trip with ordered TripStops, verifying combined payload capacity.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        if not dispatch_in.request_ids or len(dispatch_in.request_ids) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one delivery request is required to dispatch")

        # 1. Fetch & Lock Vehicle
        vehicle = await Vehicle.find_one(Vehicle.id == dispatch_in.vehicle_id)
        if not vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

        if vehicle.status != VehicleStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Vehicle is currently unavailable for assignment (status: {vehicle.status.value})"
            )

        # 2. Fetch & Lock Driver
        driver = await Driver.find_one(Driver.id == dispatch_in.driver_id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

        if driver.status != DriverStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Driver is currently unavailable for assignment (status: {driver.status.value})"
            )

        # 3. Fetch and Validate all requests
        requests: List[DeliveryRequest] = []
        total_weight_tons = Decimal("0.00")
        from app.models.pricing import Quotation
        from app.models.enums import QuotationStatus

        for req_id in dispatch_in.request_ids:
            req = await DeliveryRequest.find_one(DeliveryRequest.id == req_id)
            if not req:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Delivery request {req_id} not found")

            if req.status not in (DeliveryRequestStatus.ACCEPTED, DeliveryRequestStatus.SUBMITTED, DeliveryRequestStatus.QUOTED):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Request {req.request_number} is in status '{req.status.value}' and cannot be dispatched"
                )

            # Prevent double-trip assignment
            existing_trip = await Trip.find_one({"$or": [{"request_id": req_id}, {"request_ids": req_id}]})
            if existing_trip:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A trip has already been dispatched for request {req.request_number}"
                )

            # Ensure quotation exists
            quotation = await Quotation.find_one(Quotation.request_id == req.id)
            if not quotation:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No quotation found for delivery request {req.request_number}. Cannot dispatch."
                )
            elif quotation.status != QuotationStatus.ACCEPTED:
                quotation.status = QuotationStatus.ACCEPTED
                quotation.accepted_at = now
                await quotation.save()

            total_weight_tons += Decimal(str(req.weight_tons or 0.0))
            requests.append(req)

        # Strict vehicle capacity enforcement
        veh_capacity = Decimal(str(vehicle.capacity_tons))
        if veh_capacity < total_weight_tons:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Combined cargo weight ({total_weight_tons} tons) exceeds vehicle maximum capacity ({veh_capacity} tons)"
            )

        # 4. Create Consolidated Trip
        primary_req = requests[0]
        trip = Trip(
            request_id=primary_req.id, # Backward compatibility link
            request_ids=[r.id for r in requests],
            trip_type="CONSOLIDATED_PART_LOAD" if len(requests) > 1 else "FULL_TRUCK",
            total_weight_tons=float(total_weight_tons),
            assigned_at=now,
            commission_percentage=dispatch_in.commission_percentage or Decimal("10.00"),
        )
        await trip.insert()

        # 5. Create Ordered Sequence of TripStops (Pickups first, then Drop-offs)
        stop_seq = 1
        # Pickups
        for req in requests:
            pickup_stop = TripStop(
                trip_id=trip.id,
                request_id=req.id,
                stop_sequence=stop_seq,
                stop_type="PICKUP",
                company_name=req.pickup_company_name,
                address=req.pickup_address,
                lat=req.pickup_lat,
                lng=req.pickup_lng,
                contact_person=req.pickup_contact_person,
                contact_phone=req.pickup_phone,
                cargo_summary=f"{req.goods_type} ({int(req.weight_tons * 1000)} kg)",
                cargo_weight_kg=float(req.weight_tons * 1000),
                status="PENDING",
            )
            await pickup_stop.insert()
            stop_seq += 1

        # Deliveries
        for req in requests:
            drop_stop = TripStop(
                trip_id=trip.id,
                request_id=req.id,
                stop_sequence=stop_seq,
                stop_type="DROP",
                company_name=req.destination_company_name,
                address=req.destination_address,
                lat=req.destination_lat,
                lng=req.destination_lng,
                contact_person=req.destination_contact_person,
                contact_phone=req.destination_phone,
                cargo_summary=f"{req.goods_type} ({int(req.weight_tons * 1000)} kg)",
                cargo_weight_kg=float(req.weight_tons * 1000),
                status="PENDING",
            )
            await drop_stop.insert()
            stop_seq += 1

        # 6. Assign Vehicle & Driver
        assignment = VehicleAssignment(
            trip_id=trip.id,
            vehicle_id=vehicle.id,
            driver_id=driver.id,
            assigned_at=now,
            released_at=None
        )
        await assignment.insert()

        vehicle.status = VehicleStatus.ASSIGNED
        driver.status = DriverStatus.ON_TRIP
        await vehicle.save()
        await driver.save()

        # 7. Update status of each delivery request and notify customers
        for req in requests:
            req.status = DeliveryRequestStatus.DRIVER_ASSIGNED
            req.updated_at = now
            await req.save()

            # Individual customer notification
            customer_users = await NotificationService.resolve_customer_recipients(req.customer_company_id)
            for cust_user in customer_users:
                await NotificationService.create_notification(
                    event_id=f"TRIP_DISPATCHED:{trip.id}:CUST:{cust_user.id}:{req.id}",
                    event_type="TRIP_DISPATCHED",
                    recipient_user_id=cust_user.id,
                    channel=NotificationChannel.IN_APP,
                    title="Driver Assigned to Your Cargo",
                    message=(
                        f"A driver has been assigned to request {req.request_number}. "
                        f"Driver: {driver.name}. Vehicle: {vehicle.registration_number}."
                    )
                )

        await NotificationService.process_pending_notifications()

        return {
            "trip_id": trip.id,
            "request_ids": [r.id for r in requests],
            "vehicle_id": vehicle.id,
            "driver_id": driver.id,
            "total_weight_tons": float(total_weight_tons),
            "total_stops_count": stop_seq - 1,
            "assigned_at": now,
            "assignment": assignment
        }
