from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.driver import Driver
from app.schemas.driver import DriverCreate, DriverResponse
from app.api.deps import get_current_admin

router = APIRouter()

@router.post("/", response_model=DriverResponse)
def create_driver(driver: DriverCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    db_driver = Driver(**driver.model_dump())
    db.add(db_driver)
    db.commit()
    db.refresh(db_driver)
    return db_driver

@router.get("/", response_model=list[DriverResponse])
def read_drivers(
    skip: int = Query(0, ge=0), 
    limit: int = Query(50, ge=1, le=100), 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin)
):
    return db.query(Driver).offset(skip).limit(limit).all()
