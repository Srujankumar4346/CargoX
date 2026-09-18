from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_token
from app.models.user import User
from app.models.enums import UserRole
from app.core.config import settings

# We can use OAuth2PasswordBearer for dependency injection parsing of the Authorization header,
# but we do not use its tokenUrl in our actual logic since Clerk handles tokens.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="mock")

def get_current_user_token(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    try:
        payload = decode_token(token)
        return payload
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(token_data: dict = Depends(get_current_user_token)) -> User:
    clerk_user_id = token_data.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = await User.find_one(User.clerk_user_id == clerk_user_id)
    if not user:
        email = token_data.get("email") or f"{clerk_user_id}@placeholder.cargox.com"
        role = UserRole.CUSTOMER_USER
        if settings.CARGOX_PRIMARY_ADMIN_CLERK_ID and clerk_user_id == settings.CARGOX_PRIMARY_ADMIN_CLERK_ID:
            role = UserRole.ADMIN
            
        user = User(
            clerk_user_id=clerk_user_id,
            email=email,
            role=role,
            customer_company_id=None
        )
        try:
            await user.insert()
        except Exception:
            # Handle unique constraint or duplicate insert gracefully
            user = await User.find_one(User.clerk_user_id == clerk_user_id)
            if not user:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to provision user")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    # If configured as primary admin, promote role to ADMIN
    if settings.CARGOX_PRIMARY_ADMIN_CLERK_ID and user.clerk_user_id == settings.CARGOX_PRIMARY_ADMIN_CLERK_ID and user.role != UserRole.ADMIN:
        user.role = UserRole.ADMIN
        try:
            await user.save()
        except Exception:
            pass

    return user

async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        if settings.CARGOX_PRIMARY_ADMIN_CLERK_ID and current_user.clerk_user_id == settings.CARGOX_PRIMARY_ADMIN_CLERK_ID:
            return current_user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough privileges")
    return current_user

async def get_current_customer_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.CUSTOMER_USER, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough privileges")
    if not current_user.customer_company_id:
        from app.models.company import CustomerCompany
        from app.models.enums import CompanyStatus
        import uuid
        
        company_name = f"{current_user.email.split('@')[0].replace('.', ' ').title()} Co" if current_user.email and '@' in current_user.email else "Customer Logistics Co"
        company = CustomerCompany(
            name=company_name,
            billing_address="Address Pending",
            status=CompanyStatus.ACTIVE
        )
        try:
            await company.insert()
            current_user.customer_company_id = company.id
            await current_user.save()
            return current_user
        except Exception:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer company not assigned")
            
    return current_user

async def get_current_driver(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough privileges")
    return current_user
