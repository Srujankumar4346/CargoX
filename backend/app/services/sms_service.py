import re
import logging
import urllib.parse
from typing import Tuple
from app.core.config import settings

logger = logging.getLogger(__name__)

class SMSDeliveryError(Exception):
    pass

class SMSService:
    @staticmethod
    def normalize_phone(phone: str) -> str:
        """
        Normalizes a phone number to standard E.164-like format (e.g. +919876543210).
        Removes spaces, hyphens, and brackets. Assumes Indian +91 if 10 digits provided.
        """
        if not phone:
            raise ValueError("Phone number is required.")
        
        cleaned = re.sub(r"[\s\-\(\)\.]+", "", str(phone).strip())
        if cleaned.startswith("0") and len(cleaned) == 11:
            cleaned = "+91" + cleaned[1:]
        elif not cleaned.startswith("+"):
            if len(cleaned) == 10:
                cleaned = "+91" + cleaned
            elif len(cleaned) == 12 and cleaned.startswith("91"):
                cleaned = "+" + cleaned
            else:
                cleaned = "+" + cleaned
                
        # Validate format: + followed by 10-15 digits
        if not re.match(r"^\+[1-9]\d{9,14}$", cleaned):
            raise ValueError(f"Invalid phone number format: {phone}. Must be a valid 10-digit mobile number.")
            
        return cleaned

    @staticmethod
    def mask_phone(phone: str) -> str:
        """
        Masks phone number for secure client presentation without exposing raw digits.
        Example: +919876543210 -> +91 98*** **210
        """
        try:
            norm = SMSService.normalize_phone(phone)
            # Example +919876543210 -> +91 98*** **210
            country_code = norm[:3]  # +91
            rest = norm[3:]
            if len(rest) == 10:
                return f"{country_code} {rest[:2]}*** **{rest[-3:]}"
            elif len(rest) >= 6:
                return f"{country_code} {rest[:2]}****{rest[-2:]}"
            return f"{norm[:3]}******"
        except Exception:
            return "******"

    @staticmethod
    async def send_delivery_otp_sms(
        phone: str,
        otp_code: str,
        request_number: str,
        driver_name: str = "CargoX Carrier"
    ) -> Tuple[bool, str]:
        """
        Sends OTP to authorized recipient phone number.
        Uses configured provider (Twilio / Fast2SMS / Sandbox fallback).
        Never logs the actual OTP code to plain application logs in production.
        """
        normalized_phone = SMSService.normalize_phone(phone)
        masked = SMSService.mask_phone(normalized_phone)
        
        provider = (settings.SMS_PROVIDER or "sandbox").lower()
        sms_enabled = settings.SMS_ENABLED
        
        message_text = (
            f"Your CargoX delivery handover OTP for shipment {request_number} is {otp_code}. "
            f"Valid for 5 minutes. Share this ONLY with driver {driver_name} upon physical inspection."
        )

        # Sandbox / Dev mode fallback (or when live SMS disabled)
        if not sms_enabled or provider == "sandbox":
            logger.info(
                f"[SMS SANDBOX] Dispatched OTP SMS to recipient {masked} for shipment {request_number} (Provider: Sandbox)"
            )
            return True, f"OTP dispatched to recipient {masked} (Dev/Sandbox Mode)"

        # Provider: Twilio
        if provider == "twilio":
            if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER):
                logger.warning("[SMS] Twilio credentials incomplete. Falling back to sandbox simulation.")
                return True, f"OTP dispatched to recipient {masked} (Sandbox Mode - Twilio credentials incomplete)"
            try:
                import httpx
                twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        twilio_url,
                        data={
                            "From": settings.TWILIO_FROM_NUMBER,
                            "To": normalized_phone,
                            "Body": message_text,
                        },
                        auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    )
                    if resp.status_code in (200, 201):
                        logger.info(f"[SMS TWILIO] Successfully sent OTP SMS to {masked} for shipment {request_number}")
                        return True, f"OTP SMS sent to {masked} via Twilio"
                    else:
                        logger.error(f"[SMS TWILIO] Provider error {resp.status_code}: {resp.text}")
                        raise SMSDeliveryError(f"Twilio SMS gateway returned error {resp.status_code}")
            except Exception as e:
                logger.error(f"[SMS TWILIO] Failed to send SMS: {str(e)}")
                raise SMSDeliveryError(f"SMS delivery failed: {str(e)}")

        # Provider: Fast2SMS (Indian SMS Gateway)
        if provider == "fast2sms":
            if not settings.FAST2SMS_API_KEY:
                logger.warning("[SMS] Fast2SMS API key missing. Falling back to sandbox.")
                return True, f"OTP dispatched to recipient {masked} (Sandbox Mode)"
            try:
                import httpx
                # Fast2SMS Quick Transactional SMS API
                fast2sms_url = "https://www.fast2sms.com/dev/bulkV2"
                headers = {"authorization": settings.FAST2SMS_API_KEY}
                payload = {
                    "route": "otp",
                    "variables_values": otp_code,
                    "numbers": normalized_phone.replace("+91", "").replace("+", ""),
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(fast2sms_url, json=payload, headers=headers)
                    res_data = resp.json()
                    if resp.status_code == 200 and res_data.get("return") is True:
                        logger.info(f"[SMS FAST2SMS] Successfully sent OTP to {masked} for shipment {request_number}")
                        return True, f"OTP SMS sent to {masked} via Fast2SMS"
                    else:
                        err_msg = res_data.get("message", "Unknown Fast2SMS failure")
                        logger.error(f"[SMS FAST2SMS] Error: {err_msg}")
                        raise SMSDeliveryError(f"Fast2SMS error: {err_msg}")
            except Exception as e:
                logger.error(f"[SMS FAST2SMS] Failed to send SMS: {str(e)}")
                raise SMSDeliveryError(f"Fast2SMS delivery failed: {str(e)}")

        # Fallback simulation
        logger.info(f"[SMS] Simulated SMS delivery to {masked} for shipment {request_number}")
        return True, f"OTP dispatched to {masked} (Sandbox Mode)"
