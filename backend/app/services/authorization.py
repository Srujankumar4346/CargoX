from fastapi import HTTPException, status
from app.models.user import User
from app.models.enums import UserRole
import uuid

class AuthorizationService:
    """
    Enforces object-level isolation rules across the application.
    """
    
    @staticmethod
    def verify_customer_access(current_user: User, resource_company_id: uuid.UUID):
        """
        Ensures a Customer User can only access resources belonging to their company.
        """
        if current_user.role == UserRole.ADMIN:
            return  # Admins have global access
            
        if current_user.role != UserRole.CUSTOMER_USER:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access customer resources")
            
        if current_user.customer_company_id != resource_company_id:
            # Mask the existence of the resource
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
            
    @staticmethod
    def verify_driver_trip_access(current_user: User, assigned_driver_id: uuid.UUID, is_released: bool = False):
        """
        Ensures a Driver can only access trips they are actively assigned to.
        """
        if current_user.role == UserRole.ADMIN:
            return
            
        if current_user.role != UserRole.DRIVER:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access driver resources")
            
        if not current_user.driver:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver profile not found")
            
        if current_user.driver.id != assigned_driver_id or is_released:
            # Mask existence
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
