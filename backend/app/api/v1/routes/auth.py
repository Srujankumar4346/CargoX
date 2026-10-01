from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import UUID4, BaseModel
from app.api.deps import get_current_user
from app.models.enums import UserRole
from app.models.user import User
from app.models.fleet import Driver
from app.core.security import verify_password, create_driver_token

router = APIRouter()

class DriverLoginRequest(BaseModel):
    username: str
    password: str

class DriverLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


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

@router.post("/driver-login", response_model=DriverLoginResponse)
async def driver_login(req: DriverLoginRequest):
    driver = await Driver.find_one(Driver.username == req.username)
    if not driver:
        driver = await Driver.find_one(Driver.email == req.username.strip().lower())
    if not driver:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not driver.password_hash or not verify_password(req.password, driver.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    if getattr(driver, "status", None) == "INACTIVE":
        raise HTTPException(status_code=403, detail="Your driver account is currently inactive")
        
    if not driver.user_id:
        user = await User.find_one(User.email == driver.email)
        if not user:
            import uuid
            user = User(
                id=uuid.uuid4(),
                email=driver.email,
                role=UserRole.DRIVER,
                is_active=True
            )
            await user.insert()
        elif user.role != UserRole.DRIVER:
            user.role = UserRole.DRIVER
            await user.save()
        driver.user_id = user.id
        await driver.save()
    else:
        user = await User.get(driver.user_id)
        if user and user.role != UserRole.DRIVER:
            user.role = UserRole.DRIVER
            await user.save()
        
    token = create_driver_token(data={"sub": str(driver.user_id), "role": "DRIVER"})
    return {"access_token": token}
