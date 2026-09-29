from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import UUID4, BaseModel

from app.api.deps import get_current_user
from app.models.enums import UserRole
from app.models.user import User

router = APIRouter()


class CurrentUserResponse(BaseModel):
    id: UUID4
    email: str
    role: UserRole


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Returns the authenticated internal CargoX user identity and safe role only.
    This is used by the admin frontend to decide the correct workspace without
    relying on client-supplied role claims.
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
    }
