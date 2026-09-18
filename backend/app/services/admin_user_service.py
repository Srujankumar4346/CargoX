import logging
from fastapi import HTTPException, status
from app.models.user import User
from app.models.enums import UserRole
from app.core.config import settings
from datetime import datetime
import uuid

logger = logging.getLogger("cargox")

class AdminUserService:
    @staticmethod
    async def get_users():
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
        
        if old_role == new_role:
            return target_user
            
        # Protect primary admin
        if target_user.clerk_user_id == settings.CARGOX_PRIMARY_ADMIN_CLERK_ID:
            if new_role != UserRole.ADMIN:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Primary administrator cannot be demoted."
                )

        if new_role == UserRole.ADMIN:
            admin_count = await User.find(User.role == UserRole.ADMIN).count()
            if admin_count >= 5:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Maximum limit of 5 administrators has been reached."
                )

        target_user.role = new_role
        await target_user.save()
        
        # Structured audit log
        logger.info(
            f"AUDIT_USER_ROLE_CHANGE | admin_user_id={current_admin.id} | "
            f"target_user_id={target_user_id} | old_role={old_role.value} | "
            f"new_role={new_role.value} | timestamp={datetime.utcnow().isoformat()}"
        )
        
        return target_user
