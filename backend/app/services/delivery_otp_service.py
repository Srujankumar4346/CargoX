import hashlib
import hmac
import secrets
import base64
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, Any, List

from cryptography.fernet import Fernet
from fastapi import HTTPException, status
from app.models.user import User
from app.models.delivery import DeliveryRequest, Trip
from app.models.fleet import Driver, VehicleAssignment
from app.models.delivery_otp import DeliveryOTP
from app.models.enums import DeliveryRequestStatus, UserRole
from app.core.config import settings
from app.services.authorization import AuthorizationService

logger = logging.getLogger(__name__)

class DeliveryOTPService:
    @staticmethod
    def _get_encryption_secret() -> str:
        """
        Retrieves the encryption secret.
        Fails closed in production if SECRET_KEY is missing, empty, or default.
        """
        secret = (settings.SECRET_KEY or "").strip()
        env = (settings.ENVIRONMENT or "development").lower()
        if env in ["production", "prod"]:
            if not secret or secret in ["unsafe_default_key", "cargox_otp_fernet_secret_salt"]:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Server configuration error: Production encryption secret is not securely configured."
                )
        if not secret:
            secret = "cargox_otp_dev_secret_key"
        return secret

    @staticmethod
    def _get_fernet_cipher() -> Fernet:
        """
        Derives a consistent 32-byte url-safe base64 key from SECRET_KEY for customer-retrieval encryption.
        Key derivation is deterministic across all backend instances sharing the configured SECRET_KEY.
        If SECRET_KEY is rotated, active OTP ciphertexts fail decryption gracefully, triggering
        invalidation and automatic re-keying on the customer's next active stage refresh.
        """
        secret = DeliveryOTPService._get_encryption_secret()
        key_32 = hashlib.sha256(secret.encode("utf-8")).digest()
        fernet_key = base64.urlsafe_b64encode(key_32)
        return Fernet(fernet_key)

    @staticmethod
    def _encrypt_otp(code: str) -> str:
        f = DeliveryOTPService._get_fernet_cipher()
        return f.encrypt(code.encode("utf-8")).decode("utf-8")

    @staticmethod
    def _decrypt_otp(encrypted_token: str) -> Optional[str]:
        try:
            f = DeliveryOTPService._get_fernet_cipher()
            return f.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
        except Exception:
            # Handles key rotation or corrupted token safely
            return None

    @staticmethod
    def _hash_otp(otp_code: str, salt: str = "") -> str:
        """
        Hashes the OTP using SHA-256 with secret salt.
        Never store raw OTP codes in plaintext.
        """
        secret_salt = salt or DeliveryOTPService._get_encryption_secret()
        return hashlib.sha256(f"{secret_salt}:{otp_code.strip()}".encode("utf-8")).hexdigest()

    @staticmethod
    def _verify_otp_hash(provided_code: str, hashed_value: str, salt: str = "") -> bool:
        calculated = DeliveryOTPService._hash_otp(provided_code, salt)
        return hmac.compare_digest(calculated, hashed_value)

    @staticmethod
    def generate_secure_otp() -> str:
        """
        Generates a 6-digit cryptographically secure random number string.
        Uses secrets.randbelow to satisfy OWASP one-time code generation standards.
        """
        code_int = secrets.randbelow(900000) + 100000
        return str(code_int)

    @staticmethod
    def determine_active_stage(status_val: str) -> Optional[str]:
        """
        Maps request status to the applicable OTP purpose:
        - DRIVER_ASSIGNED or PICKUP_IN_PROGRESS -> "PICKUP"
        - ARRIVED -> "DELIVERY"
        - Others -> None
        """
        norm = str(status_val).upper().strip()
        if norm in ["DRIVER_ASSIGNED", "ASSIGNED", "PICKUP_IN_PROGRESS"]:
            return "PICKUP"
        elif norm == "ARRIVED":
            return "DELIVERY"
        return None

    # -------------------------------------------------------------------------
    # CUSTOMER OTP RETRIEVAL
    # -------------------------------------------------------------------------
    @staticmethod
    async def get_or_create_customer_otp(
        request_id: uuid.UUID,
        customer_user: User
    ) -> Dict[str, Any]:
        """
        Allows authorized customer to retrieve the active OTP code for the current stage.
        If an unexpired code exists, returns the same code (decrypted from server-side encrypted storage).
        If expired or non-existent, atomically creates a new 6-digit OTP code.
        Never exposed to driver or admin.
        """
        request = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        # Tenant isolation
        AuthorizationService.verify_customer_access(customer_user, request.customer_company_id)

        req_status = request.status.value if hasattr(request.status, "value") else str(request.status)
        purpose = DeliveryOTPService.determine_active_stage(req_status)

        if not purpose:
            # Check if this booking completed pickup or delivery
            return {
                "has_active_otp": False,
                "purpose": None,
                "code": None,
                "expires_at": None,
                "expires_in_seconds": 0,
                "is_verified": False,
                "stage_label": "No Active Stage",
                "instruction": "Verification codes appear when a driver is assigned for pickup or arrives at delivery.",
            }

        trip = await Trip.find_one(Trip.request_id == request.id)
        trip_id = trip.id if trip else request.id

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # 1. Check if purpose is already verified
        verified_record = await DeliveryOTP.find_one(
            DeliveryOTP.request_id == request.id,
            DeliveryOTP.purpose == purpose,
            DeliveryOTP.is_consumed == True,
            sort=[("consumed_at", -1)]
        )
        if verified_record and (verified_record.verified_by_user_id is not None or verified_record.is_admin_override):
            stage_name = "Pickup" if purpose == "PICKUP" else "Delivery"
            return {
                "has_active_otp": False,
                "purpose": purpose,
                "code": None,
                "expires_at": None,
                "expires_in_seconds": 0,
                "is_verified": True,
                "verified_at": verified_record.consumed_at or verified_record.created_at,
                "stage_label": f"{stage_name} Handover Verified",
                "instruction": f"{stage_name} verification completed successfully.",
            }

        # 2. Check for active unexpired code
        active_record = await DeliveryOTP.find_one(
            DeliveryOTP.request_id == request.id,
            DeliveryOTP.purpose == purpose,
            DeliveryOTP.is_consumed == False,
            DeliveryOTP.expires_at > now,
            sort=[("created_at", -1)]
        )

        code_to_display: Optional[str] = None
        expires_at: datetime
        expires_in_seconds: int

        if active_record and active_record.encrypted_otp:
            code_to_display = DeliveryOTPService._decrypt_otp(active_record.encrypted_otp)
            expires_at = active_record.expires_at
            expires_in_seconds = max(0, int((active_record.expires_at - now).total_seconds()))

        # 3. If no valid active code or decryption failed, create a fresh one
        if not code_to_display:
            # Invalidate any old/expired codes for this request & purpose
            old_otps = await DeliveryOTP.find(
                DeliveryOTP.request_id == request.id,
                DeliveryOTP.purpose == purpose,
                DeliveryOTP.is_consumed == False
            ).to_list()
            for old in old_otps:
                old.is_consumed = True
                old.consumed_at = now
                await old.save()

            fresh_code = DeliveryOTPService.generate_secure_otp()
            hashed_code = DeliveryOTPService._hash_otp(fresh_code)
            encrypted_code = DeliveryOTPService._encrypt_otp(fresh_code)
            expiry_secs = settings.DELIVERY_OTP_EXPIRY_SECONDS
            expires_at = now + timedelta(seconds=expiry_secs)

            new_record = DeliveryOTP(
                request_id=request.id,
                trip_id=trip_id,
                purpose=purpose,
                recipient_phone=request.pickup_phone if purpose == "PICKUP" else request.destination_phone,
                hashed_otp=hashed_code,
                encrypted_otp=encrypted_code,
                expires_at=expires_at,
                attempts=0,
                max_attempts=settings.DELIVERY_OTP_MAX_ATTEMPTS,
                resend_count=0,
                max_resends=settings.DELIVERY_OTP_MAX_RESENDS,
                is_consumed=False,
                created_at=now,
                last_sent_at=now
            )
            await new_record.insert()
            code_to_display = fresh_code
            expires_in_seconds = expiry_secs

        stage_title = "Pickup Verification Code" if purpose == "PICKUP" else "Delivery Verification Code"
        instruction = (
            "Share this 6-digit code with your CargoX driver upon freight handover at pickup."
            if purpose == "PICKUP"
            else "Share this 6-digit code with your driver to confirm delivery handover."
        )

        return {
            "has_active_otp": True,
            "purpose": purpose,
            "code": code_to_display,
            "expires_at": expires_at,
            "expires_in_seconds": expires_in_seconds,
            "is_verified": False,
            "verified_at": None,
            "stage_label": stage_title,
            "instruction": instruction,
        }

    # -------------------------------------------------------------------------
    # DRIVER VERIFICATION
    # -------------------------------------------------------------------------
    @staticmethod
    async def get_verified_trip_and_request(
        trip_id: uuid.UUID,
        driver_user: User,
        purpose: str
    ) -> Tuple[Trip, DeliveryRequest, Driver]:
        """
        Validates driver assignment and ensures trip is in valid state for the requested stage.
        """
        driver = await Driver.find_one(Driver.user_id == driver_user.id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")

        assignment = await VehicleAssignment.find_one(
            VehicleAssignment.trip_id == trip_id,
            VehicleAssignment.driver_id == driver.id,
            VehicleAssignment.released_at == None
        )
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized: You are not the active assigned driver for this trip."
            )

        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        req_status = request.status.value if hasattr(request.status, "value") else str(request.status)
        norm_status = req_status.upper().strip()

        if purpose == "PICKUP":
            if norm_status not in ["DRIVER_ASSIGNED", "ASSIGNED", "PICKUP_IN_PROGRESS"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot verify pickup OTP for request in status '{norm_status}'. Must be in pickup phase."
                )
        elif purpose == "DELIVERY":
            if norm_status != "ARRIVED":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot verify delivery OTP for request in status '{norm_status}'. Must be in ARRIVED status."
                )
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid OTP purpose: {purpose}")

        return trip, request, driver

    @staticmethod
    async def verify_otp(
        trip_id: uuid.UUID,
        otp_code: str,
        driver_user: User,
        purpose: str = "DELIVERY"
    ) -> Dict[str, Any]:
        """
        Validates the 6-digit OTP entered by the driver for the given stage (PICKUP or DELIVERY).
        Uses atomic MongoDB updates ($set and $inc) to guarantee single-use consumption and
        exact attempt counting even under concurrent submission requests.
        """
        purpose_norm = str(purpose or "DELIVERY").upper().strip()
        trip, request, driver = await DeliveryOTPService.get_verified_trip_and_request(
            trip_id, driver_user, purpose_norm
        )

        code_str = str(otp_code).strip()
        if len(code_str) != 6 or not code_str.isdigit():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP must be a 6-digit number."
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # 1. Check if already verified
        already_verified = await DeliveryOTP.find_one(
            DeliveryOTP.request_id == request.id,
            DeliveryOTP.purpose == purpose_norm,
            DeliveryOTP.is_consumed == True,
            sort=[("consumed_at", -1)]
        )
        if already_verified and (already_verified.verified_by_user_id or already_verified.is_admin_override):
            return {
                "success": True,
                "message": f"{purpose_norm} verification already confirmed.",
                "verified_at": already_verified.consumed_at or now,
                "purpose": purpose_norm,
                "is_admin_override": already_verified.is_admin_override,
            }

        # 2. Find active pending OTP
        active_otp = await DeliveryOTP.find_one(
            DeliveryOTP.request_id == request.id,
            DeliveryOTP.purpose == purpose_norm,
            DeliveryOTP.is_consumed == False,
            sort=[("created_at", -1)]
        )

        if not active_otp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active {purpose_norm} OTP found. Customer must view the code on their dashboard."
            )

        # 3. Check hash match
        is_match = DeliveryOTPService._verify_otp_hash(code_str, active_otp.hashed_otp)
        if not is_match:
            # Atomic conditional update: increment ONLY IF still unconsumed, unexpired, and strictly attempts < max_attempts
            atomic_inc = await DeliveryOTP.find_one(
                DeliveryOTP.id == active_otp.id,
                DeliveryOTP.is_consumed == False,
                DeliveryOTP.expires_at > now,
                DeliveryOTP.attempts < active_otp.max_attempts
            ).update({"$inc": {"attempts": 1}})

            if not atomic_inc or getattr(atomic_inc, "modified_count", 0) == 0:
                # Document was either consumed, expired, or already hit max_attempts
                await DeliveryOTP.find_one(
                    DeliveryOTP.id == active_otp.id,
                    DeliveryOTP.is_consumed == False
                ).update({"$set": {"is_consumed": True, "encrypted_otp": None, "consumed_at": now}})
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Maximum invalid attempts reached or OTP already invalidated."
                )

            # Fetch fresh document to determine updated count
            fresh = await DeliveryOTP.find_one(DeliveryOTP.id == active_otp.id)
            new_attempts = fresh.attempts if fresh else (active_otp.attempts + 1)
            remaining = max(0, active_otp.max_attempts - new_attempts)

            if remaining == 0:
                # Code reached limit on this attempt: atomically consume and delete encrypted OTP
                await DeliveryOTP.find_one(
                    DeliveryOTP.id == active_otp.id,
                    DeliveryOTP.is_consumed == False
                ).update({"$set": {"is_consumed": True, "encrypted_otp": None, "consumed_at": now}})
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Incorrect OTP. Maximum attempts reached; this code is now invalidated."
                )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Incorrect OTP code. {remaining} attempt(s) remaining."
            )

        # 6. ATOMIC CONSUMPTION:
        # Match only if still unconsumed and within attempt limits to defeat race conditions
        update_query = DeliveryOTP.find_one(
            DeliveryOTP.id == active_otp.id,
            DeliveryOTP.is_consumed == False,
            DeliveryOTP.attempts < active_otp.max_attempts
        )
        res = await update_query.update({
            "$set": {
                "is_consumed": True,
                "consumed_at": now,
                "verified_by_user_id": driver_user.id,
                "encrypted_otp": None  # Delete encrypted copy immediately upon successful verification
            }
        })

        if not res or getattr(res, "modified_count", 0) == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="OTP was already consumed or invalidated by another request."
            )

        logger.info(
            f"[{purpose_norm} OTP] Verified successfully for Request {request.request_number} by driver {driver_user.id}"
        )

        return {
            "success": True,
            "message": f"{purpose_norm} OTP verified successfully!",
            "verified_at": now,
            "purpose": purpose_norm,
            "is_admin_override": False,
        }

    # -------------------------------------------------------------------------
    # STAGE STATUS FOR DRIVER & ADMIN
    # -------------------------------------------------------------------------
    @staticmethod
    async def get_otp_status(
        trip_id: uuid.UUID,
        current_user: User,
        purpose: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Returns verification status for driver or admin, without revealing raw or encrypted OTP.
        """
        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        req_status = request.status.value if hasattr(request.status, "value") else str(request.status)
        stage_purpose = purpose or DeliveryOTPService.determine_active_stage(req_status) or "DELIVERY"
        stage_purpose = stage_purpose.upper().strip()

        # Check if already verified or overridden
        verified_otp = await DeliveryOTP.find_one(
            DeliveryOTP.request_id == request.id,
            DeliveryOTP.purpose == stage_purpose,
            DeliveryOTP.is_consumed == True,
            sort=[("consumed_at", -1)]
        )
        if verified_otp and (verified_otp.verified_by_user_id or verified_otp.is_admin_override):
            return {
                "purpose": stage_purpose,
                "is_verified": True,
                "verified_at": verified_otp.consumed_at or verified_otp.created_at,
                "is_admin_override": verified_otp.is_admin_override,
                "override_reason": verified_otp.override_reason,
                "expires_at": None,
                "has_active_otp": False,
                "attempts_remaining": 0,
                "can_resend": False,
                "resend_cooldown_remaining_seconds": 0,
            }

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        active_otp = await DeliveryOTP.find_one(
            DeliveryOTP.request_id == request.id,
            DeliveryOTP.purpose == stage_purpose,
            DeliveryOTP.is_consumed == False,
            DeliveryOTP.expires_at > now,
            sort=[("created_at", -1)]
        )

        has_active = bool(active_otp)
        attempts_rem = max(0, active_otp.max_attempts - active_otp.attempts) if active_otp else None

        return {
            "purpose": stage_purpose,
            "is_verified": False,
            "verified_at": None,
            "is_admin_override": False,
            "override_reason": None,
            "expires_at": active_otp.expires_at if active_otp else None,
            "has_active_otp": has_active,
            "attempts_remaining": attempts_rem,
            "can_resend": True,
            "resend_cooldown_remaining_seconds": 0,
        }

    # -------------------------------------------------------------------------
    # ADMIN OVERRIDE
    # -------------------------------------------------------------------------
    @staticmethod
    async def admin_override_otp(
        request_id: uuid.UUID,
        reason: str,
        admin_user: User,
        purpose: str = "DELIVERY"
    ) -> Dict[str, Any]:
        """
        Creates an immutable audit record overriding OTP verification.
        Requires ADMIN role and a mandatory explanation reason.
        """
        if getattr(admin_user, "role", None) != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required to perform OTP exception override."
            )

        if not reason or len(reason.strip()) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A detailed justification reason (min 5 characters) is mandatory for admin override."
            )

        request = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        trip = await Trip.find_one(Trip.request_id == request.id)
        trip_id = trip.id if trip else request.id
        purpose_norm = str(purpose or "DELIVERY").upper().strip()

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Invalidate any pending codes
        pending = await DeliveryOTP.find(
            DeliveryOTP.request_id == request.id,
            DeliveryOTP.purpose == purpose_norm,
            DeliveryOTP.is_consumed == False
        ).to_list()
        for p in pending:
            p.is_consumed = True
            p.consumed_at = now
            p.encrypted_otp = None
            await p.save()

        # Insert audit record
        override_record = DeliveryOTP(
            request_id=request.id,
            trip_id=trip_id,
            purpose=purpose_norm,
            recipient_phone=request.destination_phone,
            hashed_otp="ADMIN_OVERRIDE_HASH",
            encrypted_otp=None,
            expires_at=now,
            is_consumed=True,
            consumed_at=now,
            is_admin_override=True,
            override_reason=reason.strip(),
            override_by_user_id=admin_user.id,
            verified_by_user_id=None
        )
        await override_record.insert()

        admin_name = getattr(admin_user, "name", None) or admin_user.email

        logger.warning(
            f"[ADMIN OVERRIDE] {purpose_norm} OTP overridden for Request {request.request_number} "
            f"by {admin_name}. Reason: {reason}"
        )

        return {
            "success": True,
            "message": f"Successfully authorized {purpose_norm} OTP override.",
            "request_id": request.id,
            "purpose": purpose_norm,
            "override_at": now,
            "override_by_name": admin_name,
            "reason": reason.strip(),
        }
