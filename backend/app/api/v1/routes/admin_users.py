from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, UUID4

from app.api.deps import get_current_admin
from app.models.user import User
from app.models.enums import UserRole
from app.services.admin_user_service import AdminUserService

router = APIRouter()

class UserResponse(BaseModel):
    id: UUID4
    clerk_user_id: Optional[str]
    email: str
    role: UserRole
    customer_company_id: Optional[UUID4]
    is_active: bool

    class Config:
        from_attributes = True

class RoleUpdateRequest(BaseModel):
    role: UserRole

@router.get("/", response_model=List[UserResponse])
async def get_users(current_admin: User = Depends(get_current_admin)):
    """
    List all users (Admin only). Returns safe information for management UI.
    """
    return await AdminUserService.get_users()

@router.put("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: str,
    request: RoleUpdateRequest,
    current_admin: User = Depends(get_current_admin)
):
    """
    Update a user's role (Admin only). Cannot demote primary admin.
    """
    return await AdminUserService.update_user_role(user_id, request.role, current_admin)
