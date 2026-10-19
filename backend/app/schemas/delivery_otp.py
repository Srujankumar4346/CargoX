import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class CustomerActiveOTPResponse(BaseModel):
    has_active_otp: bool
    purpose: Optional[str] = None  # "PICKUP" or "DELIVERY"
    code: Optional[str] = None     # 6-digit code shown ONLY to authorized customer
    recipient_name: Optional[str] = None
    recipient_phone_masked: Optional[str] = None
    expires_at: Optional[datetime] = None
    expires_in_seconds: int = 0
    is_verified: bool = False
    verified_at: Optional[datetime] = None
    stage_label: str
    instruction: str

class StageOTPVerifyRequest(BaseModel):
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit one-time code")
    purpose: Optional[str] = Field("DELIVERY", description="Stage purpose: PICKUP or DELIVERY")

class DeliveryOTPVerifyRequest(BaseModel):
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit one-time code")
    purpose: Optional[str] = Field("DELIVERY", description="Stage purpose: PICKUP or DELIVERY")

class DeliveryOTPVerifyResponse(BaseModel):
    success: bool
    message: str
    verified_at: datetime
    purpose: str = "DELIVERY"
    is_admin_override: bool = False

class DeliveryOTPStatusResponse(BaseModel):
    purpose: str = "DELIVERY"
    is_verified: bool
    verified_at: Optional[datetime] = None
    is_admin_override: bool = False
    override_reason: Optional[str] = None
    expires_at: Optional[datetime] = None
    has_active_otp: bool = False
    attempts_remaining: Optional[int] = None
    can_resend: bool = True
    resend_cooldown_remaining_seconds: int = 0

class DeliveryOTPAdminOverrideRequest(BaseModel):
    purpose: str = Field("DELIVERY", description="PICKUP or DELIVERY")
    reason: str = Field(..., min_length=5, max_length=500, description="Mandatory reason for admin bypass of OTP")

class DeliveryOTPAdminOverrideResponse(BaseModel):
    success: bool
    message: str
    request_id: uuid.UUID
    purpose: str
    override_at: datetime
    override_by_name: str
    reason: str

class AdminEmergencyTransitionRequest(BaseModel):
    override_reason: Optional[str] = Field(None, min_length=5, max_length=500, description="Mandatory justification reason if bypassing OTP requirement")

class AdminForceCompleteRequest(BaseModel):
    override_reason: Optional[str] = Field(None, min_length=5, max_length=500, description="Mandatory justification reason if bypassing POD/delivery verification")

