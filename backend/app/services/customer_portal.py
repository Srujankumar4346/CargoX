import uuid
import datetime
import random
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError
from app.models.user import User
from app.models.delivery import DeliveryRequest
from app.models.company import RecipientCompany
from app.models.enums import DeliveryRequestStatus
from app.schemas.delivery_request import DeliveryRequestCreate, DeliveryRequestUpdate
from app.schemas.recipient import RecipientCompanyCreate, RecipientCompanyUpdate

class CustomerPortalService:
    @staticmethod
    def _generate_request_number() -> str:
        date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d")
        rand_id = "".join([str(random.randint(0, 9)) for _ in range(4)])
        return f"CRG-{date_str}-{rand_id}"

    @staticmethod
    async def create_delivery_request(user: User, payload: DeliveryRequestCreate) -> DeliveryRequest:
        # 1. Start processing the destination snapshot
        dest_kwargs = {}
        
        if payload.recipient_company_id:
            recipient = await RecipientCompany.find_one(RecipientCompany.id == payload.recipient_company_id)
            if not recipient:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Recipient not found")
            
            # Authorize ownership
            if recipient.customer_company_id != user.customer_company_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")
            
            dest_kwargs = {
                "recipient_company_id": recipient.id,
                "destination_company_name": recipient.name,
                "destination_address": recipient.address,
                "destination_contact_person": recipient.contact_person,
                "destination_phone": recipient.phone,
                "destination_lat": recipient.lat,
                "destination_lng": recipient.lng,
            }
        else:
            dest_kwargs = {
                "recipient_company_id": None,
                "destination_company_name": payload.destination_company_name,
                "destination_address": payload.destination_address,
                "destination_contact_person": payload.destination_contact_person,
                "destination_phone": payload.destination_phone,
                "destination_lat": payload.destination_lat,
                "destination_lng": payload.destination_lng,
            }

        # Update customer company details if pending/placeholder
        if user.customer_company_id:
            from app.models.company import CustomerCompany
            comp = await CustomerCompany.find_one(CustomerCompany.id == user.customer_company_id)
            if comp and ("Pending" in (comp.billing_address or "") or "Logistics Co" in (comp.name or "")):
                if payload.pickup_company_name and payload.pickup_company_name != "Unknown Company":
                    comp.name = payload.pickup_company_name
                if payload.pickup_address and payload.pickup_address != "Unknown Address":
                    comp.billing_address = payload.pickup_address
                try:
                    await comp.save()
                except Exception:
                    pass

        # 2. Retry loop for request number collision
        max_retries = 5
        for attempt in range(max_retries):
            req_number = CustomerPortalService._generate_request_number()
            now = datetime.datetime.now(datetime.timezone.utc)
            
            new_req = DeliveryRequest(
                request_number=req_number,
                customer_company_id=user.customer_company_id,
                
                # Cargo
                goods_type=payload.goods_type,
                goods_description=payload.goods_description,
                weight_tons=payload.weight_tons,
                special_instructions=payload.special_instructions,
                
                # Pickup
                pickup_company_name=payload.pickup_company_name,
                pickup_address=payload.pickup_address,
                pickup_contact_person=payload.pickup_contact_person,
                pickup_phone=payload.pickup_phone,
                pickup_lat=payload.pickup_lat,
                pickup_lng=payload.pickup_lng,
                
                # Destination
                **dest_kwargs,
                
                # Metrics / State
                distance_km=None,
                status=DeliveryRequestStatus.SUBMITTED,
                created_at=now,
                updated_at=now
            )
            
            try:
                await new_req.insert()
                return new_req
            except DuplicateKeyError:
                if attempt == max_retries - 1:
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate unique request number")
                # Retry

    @staticmethod
    async def cancel_delivery_request(user: User, request_id: uuid.UUID, reason: str = None) -> DeliveryRequest:
        req = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
        if not req or req.customer_company_id != user.customer_company_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
            
        # Allowed before IN_TRANSIT
        if req.status in [DeliveryRequestStatus.IN_TRANSIT, DeliveryRequestStatus.DELIVERED, DeliveryRequestStatus.COMPLETED]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot cancel request in state {req.status.value}")
            
        # Require reason if accepted
        if req.status not in [DeliveryRequestStatus.SUBMITTED, DeliveryRequestStatus.UNDER_REVIEW]:
            if not reason:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"A cancellation reason is required for state {req.status.value}")
            
        req.status = DeliveryRequestStatus.CUSTOMER_CANCELLED
        if reason:
            req.cancellation_reason = reason
        req.updated_at = datetime.datetime.now(datetime.timezone.utc)
        await req.save()
        return req

    @staticmethod
    async def update_delivery_request(user: User, request_id: uuid.UUID, payload: DeliveryRequestUpdate) -> DeliveryRequest:
        req = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
        if not req or req.customer_company_id != user.customer_company_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
            
        # Only allow edits if SUBMITTED or UNDER_REVIEW
        if req.status not in [DeliveryRequestStatus.SUBMITTED, DeliveryRequestStatus.UNDER_REVIEW]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot edit request in state {req.status.value}")
            
        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(req, key, value)
            
        req.updated_at = datetime.datetime.now(datetime.timezone.utc)
        await req.save()
        return req

