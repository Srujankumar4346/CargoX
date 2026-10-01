import logging
from fastapi import HTTPException, status
from app.models.user import User
from app.models.enums import UserRole
from app.core.config import settings
from datetime import datetime
import uuid
import httpx

logger = logging.getLogger("cargox")

class AdminUserService:
    @staticmethod
    async def get_users():
        users = await User.find_all().to_list()
        from app.models.fleet import Driver

        # Heal placeholder/missing emails by checking Driver table
        for user in users:
            if user.email and ("@placeholder.cargox.com" in user.email or "@missing.cargox.com" in user.email):
                driver = await Driver.find_one(Driver.user_id == user.id)
                if driver and driver.email:
                    user.email = driver.email
                    if user.role != UserRole.DRIVER:
                        user.role = UserRole.DRIVER
                    await user.save()

        if settings.CLERK_SECRET_KEY:
            import asyncio
            
            async def sync_user(client: httpx.AsyncClient, user: User) -> bool:
                if not (user.email and user.email.endswith("@placeholder.cargox.com") and user.clerk_user_id):
                    return False
                try:
                    response = await client.get(
                        f"https://api.clerk.com/v1/users/{user.clerk_user_id}",
                        headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"}
                    )
                    if response.status_code == 200:
                        clerk_data = response.json()
                        primary_email_id = clerk_data.get("primary_email_address_id")
                        for email_obj in clerk_data.get("email_addresses", []):
                            if email_obj.get("id") == primary_email_id:
                                user.email = email_obj.get("email_address")
                                await user.save()
                                return True
                    elif response.status_code == 404:
                        # Prevent endless 404 syncing by altering the placeholder
                        user.email = user.email.replace("@placeholder.cargox.com", "@missing.cargox.com")
                        await user.save()
                        return True
                except Exception as e:
                    logger.error(f"Failed to sync email for user {user.clerk_user_id}: {e}")
                return False

            async with httpx.AsyncClient() as client:
                tasks = [sync_user(client, user) for user in users]
                results = await asyncio.gather(*tasks)
                if any(results):
                    users = await User.find_all().to_list()

        return users

    @staticmethod
    async def update_user_role(target_user_id: str, new_role: UserRole, current_admin: User):
        try:
            target_uuid = uuid.UUID(target_user_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid UUID format")
            
        target_user = await User.find_one(User.id == target_uuid)
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            
        old_role = target_user.role
        
        # Protect primary admin
        if target_user.clerk_user_id == settings.CARGOX_PRIMARY_ADMIN_CLERK_ID:
            if new_role != UserRole.ADMIN:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Primary administrator cannot be demoted."
                )

        if new_role == UserRole.ADMIN and old_role != UserRole.ADMIN:
            admin_count = await User.find(User.role == UserRole.ADMIN).count()
            if admin_count >= 5:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Maximum limit of 5 administrators has been reached."
                )

        target_user.role = new_role
        await target_user.save()

        from app.models.fleet import Driver
        from app.models.enums import DriverStatus

        if new_role == UserRole.DRIVER:
            # Ensure driver record exists and is linked and AVAILABLE
            driver = await Driver.find_one(Driver.user_id == target_user.id)
            if not driver and target_user.email:
                driver = await Driver.find_one(Driver.email == target_user.email)
            if driver:
                driver.user_id = target_user.id
                if driver.status == DriverStatus.INACTIVE:
                    driver.status = DriverStatus.AVAILABLE
                await driver.save()
            else:
                driver = Driver(
                    user_id=target_user.id,
                    email=target_user.email,
                    name=target_user.email.split("@")[0].replace(".", " ").title() if target_user.email else "Driver",
                    phone="0000000000",
                    age=30,
                    license_number=f"DL-{uuid.uuid4().hex[:8].upper()}",
                    aadhaar_number="000000000000",
                    status=DriverStatus.AVAILABLE
                )
                await driver.insert()
        elif old_role == UserRole.DRIVER and new_role != UserRole.DRIVER:
            # When demoted from driver, mark driver record inactive
            driver = await Driver.find_one(Driver.user_id == target_user.id)
            if not driver and target_user.email:
                driver = await Driver.find_one(Driver.email == target_user.email)
            if driver:
                driver.status = DriverStatus.INACTIVE
                await driver.save()
        
        # Structured audit log
        logger.info(
            f"AUDIT_USER_ROLE_CHANGE | admin_user_id={current_admin.id} | "
            f"target_user_id={target_user_id} | old_role={old_role.value} | "
            f"new_role={new_role.value} | timestamp={datetime.utcnow().isoformat()}"
        )
        
        return target_user

    @staticmethod
    async def grant_driver_access_by_email(email: str, current_admin: User):
        from app.models.fleet import Driver
        from app.models.enums import DriverStatus

        clean_email = email.strip().lower()
        if not clean_email or "@" not in clean_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email address")

        user = await User.find_one(User.email == clean_email)
        if not user:
            user = User(
                id=uuid.uuid4(),
                email=clean_email,
                role=UserRole.DRIVER,
                is_active=True
            )
            await user.insert()
        else:
            if user.role != UserRole.DRIVER:
                old_role = user.role
                user.role = UserRole.DRIVER
                await user.save()
                logger.info(
                    f"AUDIT_USER_ROLE_CHANGE | admin_user_id={current_admin.id} | "
                    f"target_user_id={user.id} | old_role={old_role.value} | "
                    f"new_role=DRIVER | timestamp={datetime.utcnow().isoformat()}"
                )

        # Ensure Driver record exists and is AVAILABLE
        driver = await Driver.find_one(Driver.email == clean_email)
        if not driver:
            driver = await Driver.find_one(Driver.user_id == user.id)
            
        if driver:
            driver.user_id = user.id
            driver.email = clean_email
            if driver.status == DriverStatus.INACTIVE:
                driver.status = DriverStatus.AVAILABLE
            await driver.save()
        else:
            driver = Driver(
                user_id=user.id,
                email=clean_email,
                name=clean_email.split("@")[0].replace(".", " ").title(),
                phone="0000000000",
                age=30,
                license_number=f"DL-{uuid.uuid4().hex[:8].upper()}",
                aadhaar_number="000000000000",
                status=DriverStatus.AVAILABLE
            )
            await driver.insert()

        return user
