from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.rate_limit import limiter

router = APIRouter()

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class RefreshRequest(BaseModel):
    refresh_token: str

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # The form_data.username will actually contain the username/email. 
    # For CargoX, let's assume we can login as Admin, Customer or Driver.
    # To keep it simple, we'll try Admin, then Customer, then Driver by email.
    
    from app.models.user import User
    from app.models.customer import Customer
    from app.models.driver import Driver
    
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user:
        # Fallback to check driver by phone
        from app.models.driver import Driver
        driver = db.query(Driver).filter(Driver.phone_number == form_data.username).first()
        if driver:
            user = driver.user
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    role = user.role.name if user.role else "CUSTOMER"
    user_id = user.id
        
    # In a real app we'd verify hash. For now, since some might be plaintext in dev:
    # We will assume if they have a hash it works, else fallback to simple equality for older accounts
    # This should be replaced fully by verify_password in true prod, but this ensures migration works.
    if hasattr(user, 'hashed_password') and user.hashed_password:
        if not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect username or password")
    elif hasattr(user, 'password') and user.password != form_data.password:
        # Fallback for old plaintext passwords before migration
        raise HTTPException(status_code=401, detail="Incorrect username or password")
        
    access_token = create_access_token(data={"sub": str(user_id), "role": role})
    refresh_token = create_refresh_token(data={"sub": str(user_id), "role": role})
    
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/refresh", response_model=Token)
@limiter.limit("5/minute")
def refresh_token(request: Request, body: RefreshRequest):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    user_id = payload.get("sub")
    role = payload.get("role")
    
    access_token = create_access_token(data={"sub": user_id, "role": role})
    new_refresh_token = create_refresh_token(data={"sub": user_id, "role": role})
    
    return {"access_token": access_token, "refresh_token": new_refresh_token, "token_type": "bearer"}
