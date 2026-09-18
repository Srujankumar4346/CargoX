import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User
from app.models.enums import UserRole
from app.core.config import settings
from datetime import datetime

logger = logging.getLogger("cargox")

class AdminUserService:
    @staticmethod
    def get_users(db: Session):
        users = db.query(User).all()
        return users
        
    @staticmethod
    def update_user_role(db: Session, target_user_id: str, new_role: UserRole, current_admin: User):
        target_user = db.query(User).filter(User.id == target_user_id).first()
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

        target_user.role = new_role
        db.commit()
        db.refresh(target_user)
        
        # Structured audit log
        logger.info(
            f"AUDIT_USER_ROLE_CHANGE | admin_user_id={current_admin.id} | "
            f"target_user_id={target_user_id} | old_role={old_role.value} | "
            f"new_role={new_role.value} | timestamp={datetime.utcnow().isoformat()}"
        )
        
        return target_user
