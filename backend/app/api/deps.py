from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.models.enums import UserRole

# We can use OAuth2PasswordBearer for dependency injection parsing of the Authorization header,
# but we do not use its tokenUrl in our actual logic since Clerk handles tokens.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="mock")

def get_current_user_token(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    try:
        payload = decode_token(token)
        return payload
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(token_data: dict = Depends(get_current_user_token), db: Session = Depends(get_db)) -> User:
    clerk_user_id = token_data.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    return user

def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough privileges")
    return current_user

def get_current_customer_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.CUSTOMER_USER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough privileges")
    if not current_user.customer_company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer company not assigned")
    return current_user

def get_current_driver(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough privileges")
    return current_user
