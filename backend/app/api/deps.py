from typing import Annotated
from fastapi import Depends, HTTPException, status, Request
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

async def get_current_user(
    token_data: dict = Depends(get_current_user_token),
    request: Request = None,
) -> User:
    if token_data.get("iss") == "cargox_local":
        # It's a local driver token. The `sub` is the user_id.
        user_id = token_data.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid local token payload")
        import uuid
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user_id format in token")
        user = await User.get(user_uuid)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Local user not found")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
        return user

    clerk_user_id = token_data.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    from app.models.fleet import Driver
    import uuid

    # Extract email from token claims or from client X-User-Email header
    email = token_data.get("email") or token_data.get("email_address")
    if not email and request:
        email = request.headers.get("x-user-email")
    if email:
        email = email.strip().lower()

    user_by_clerk = await User.find_one(User.clerk_user_id == clerk_user_id)
    user_by_email = await User.find_one(User.email == email) if email else None
    driver_by_email = await Driver.find_one(Driver.email == email) if email else None

    user = None

    if user_by_email:
        # Email matches an authoritative user account (e.g. provisioned by admin as DRIVER)
        user = user_by_email
        if user_by_clerk and user_by_clerk.id != user_by_email.id:
            # Re-link: delete/decouple any placeholder user previously generated for this clerk ID
            if user_by_clerk.role == UserRole.ADMIN:
                user.role = UserRole.ADMIN
            try:
                await user_by_clerk.delete()
            except Exception:
                user_by_clerk.clerk_user_id = None
                await user_by_clerk.save()
        user.clerk_user_id = clerk_user_id
        await user.save()
    elif user_by_clerk:
        user = user_by_clerk
        if email and (user.email != email or "@placeholder.cargox.com" in user.email or "@missing.cargox.com" in user.email):
            user.email = email
            await user.save()
    else:
        # First time seeing this user
        effective_email = email or f"{clerk_user_id}@placeholder.cargox.com"
        role = UserRole.CUSTOMER_USER
        if driver_by_email:
            role = UserRole.DRIVER
        elif (settings.CARGOX_PRIMARY_ADMIN_CLERK_ID and clerk_user_id == settings.CARGOX_PRIMARY_ADMIN_CLERK_ID) or (settings.CARGOX_PRIMARY_ADMIN_EMAIL and effective_email.lower() == settings.CARGOX_PRIMARY_ADMIN_EMAIL.lower()):
            role = UserRole.ADMIN

        user = User(
            clerk_user_id=clerk_user_id,
            email=effective_email,
            role=role,
            customer_company_id=None
        )
        try:
            await user.insert()
        except Exception:
            # Handle unique constraint race condition
            user = await User.find_one(User.clerk_user_id == clerk_user_id)
            if not user and email:
                user = await User.find_one(User.email == email)
            if not user:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to provision user")

    if user and settings.CARGOX_PRIMARY_ADMIN_EMAIL and user.email and user.email.lower() == settings.CARGOX_PRIMARY_ADMIN_EMAIL.lower() and user.role != UserRole.ADMIN:
        user.role = UserRole.ADMIN
        await user.save()

    # If a driver profile exists by email or user role is DRIVER, ensure bidirectional link
    if driver_by_email:
        if user.role != UserRole.DRIVER and user.role != UserRole.ADMIN:
            user.role = UserRole.DRIVER
            await user.save()
        if driver_by_email.user_id != user.id:
            driver_by_email.user_id = user.id
            await driver_by_email.save()
    elif user.role == UserRole.DRIVER:
        driver_record = await Driver.find_one(Driver.user_id == user.id)
        if not driver_record and user.email:
            driver_record = await Driver.find_one(Driver.email == user.email)
            if driver_record:
                driver_record.user_id = user.id
                await driver_record.save()
        if not driver_record:
            from app.models.enums import DriverStatus
            driver_record = Driver(
                user_id=user.id,
                email=user.email,
                name=user.email.split("@")[0].replace(".", " ").title() if user.email else "Driver",
                phone="0000000000",
                age=30,
                license_number=f"DL-{uuid.uuid4().hex[:8].upper()}",
                aadhaar_number="000000000000",
                status=DriverStatus.AVAILABLE
            )
            await driver_record.insert()

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
        
    from app.models.fleet import Driver
    import uuid
    from app.models.enums import DriverStatus

    # 1. Search by user_id
    driver_record = await Driver.find_one(Driver.user_id == current_user.id)
    # 2. Search by email fallback
    if not driver_record and current_user.email:
        driver_record = await Driver.find_one(Driver.email == current_user.email)
        if driver_record:
            driver_record.user_id = current_user.id
            await driver_record.save()
            
    # 3. Auto-activate driver record if admin granted DRIVER role to this user
    if not driver_record:
        driver_record = Driver(
            user_id=current_user.id,
            email=current_user.email,
            name=current_user.email.split("@")[0].replace(".", " ").title() if current_user.email else "Driver",
            phone="0000000000",
            age=30,
            license_number=f"DL-{uuid.uuid4().hex[:8].upper()}",
            aadhaar_number="000000000000",
            status=DriverStatus.AVAILABLE
        )
        await driver_record.insert()
        
    if getattr(driver_record, "status", None) == "INACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your driver account is currently inactive. Please contact CargoX administration.")
        
    return current_user
