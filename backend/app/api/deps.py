from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user_token(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload

def get_current_active_user(token_data: dict = Depends(get_current_user_token), db: Session = Depends(get_db)):
    # Need to look up user in DB based on role and verify they are active
    user_id = token_data.get("sub")
    role = token_data.get("role")
    
    if not user_id or not role:
        raise HTTPException(status_code=401, detail="Invalid token payload")
        
    user = None
    profile_id = None
    if role == "ADMIN":
        from app.models.user import User
        from app.models.role import Role
        user = db.query(User).join(Role).filter(User.id == user_id, Role.name == "ADMIN").first()
        if user:
            profile_id = user.id
    elif role == "CUSTOMER":
        from app.models.customer import Customer
        user = db.query(Customer).filter(Customer.user_id == user_id).first()
        if user:
            profile_id = user.id
    elif role == "DRIVER":
        from app.models.driver import Driver
        user = db.query(Driver).filter(Driver.user_id == user_id).first()
        if user:
            profile_id = user.id
        
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    # Check if active
    if hasattr(user, 'status') and user.status == 'INACTIVE':
         raise HTTPException(status_code=403, detail="Inactive user")
         
    return {"id": profile_id, "user_id": int(user_id), "role": role, "user_obj": user}

def get_current_admin(current_user: dict = Depends(get_current_active_user)):
    if current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")
    return current_user

def get_current_customer(current_user: dict = Depends(get_current_active_user)):
    if current_user.get("role") != "CUSTOMER":
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")
    return current_user

def get_current_driver(current_user: dict = Depends(get_current_active_user)):
    if current_user.get("role") != "DRIVER":
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")
    return current_user
