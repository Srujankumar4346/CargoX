from typing import Optional
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
    name: Optional[str] = None
    phone: Optional[str] = None
    license_number: Optional[str] = None
    username: Optional[str] = None
    driver_id: Optional[str] = None
    avatar_url: Optional[str] = None
    vehicle_registration: Optional[str] = None
    vehicle_type: Optional[str] = None


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Returns the authenticated internal CargoX user identity and profile details.
    If the user is a driver, pulls authoritative name, phone, license, and assigned vehicle.
    """
    resp = {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
    }
    
    if current_user.role == UserRole.DRIVER:
        driver = await Driver.find_one(Driver.user_id == current_user.id)
        if not driver:
            driver = await Driver.find_one(Driver.email == current_user.email)
        if driver:
            resp.update({
                "name": driver.name,
                "phone": driver.phone,
                "license_number": driver.license_number,
                "username": driver.username,
                "driver_id": driver.driver_id,
                "avatar_url": driver.avatar_url,
            })
            
            # Find assigned vehicle if any
            from app.models.fleet import VehicleAssignment, Vehicle
            assignment = await VehicleAssignment.find_one(
                VehicleAssignment.driver_id == driver.id,
                VehicleAssignment.released_at == None
            )
            if assignment:
                veh = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id)
                if veh:
                    resp["vehicle_registration"] = veh.registration_number
                    resp["vehicle_type"] = veh.type.value if hasattr(veh.type, "value") else str(veh.type)

    return resp

@router.post("/driver-login", response_model=DriverLoginResponse)
async def driver_login(req: DriverLoginRequest):
    identifier = req.username.strip()
    # Check by driver_id (case-insensitive or exact), username, email, or phone
    driver = await Driver.find_one(Driver.username == identifier.lower())
    if not driver:
        driver = await Driver.find_one(Driver.driver_id == identifier.upper())
    if not driver:
        driver = await Driver.find_one(Driver.driver_id == identifier)
    if not driver:
        driver = await Driver.find_one(Driver.email == identifier.lower())
    if not driver:
        driver = await Driver.find_one(Driver.phone == identifier)
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
