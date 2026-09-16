from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.db.database import get_db
from app.models.vehicle import Vehicle

from app.services.intelligence.vehicle_recommender import recommend_vehicle
from app.services.intelligence.pricing_engine import calculate_estimated_price
from app.services.intelligence.route_engine import recommend_routes
from app.services.ai.llm_service import process_query_and_get_tools, ask_business_assistant
from app.services.ai.tools import execute_tool
from app.api.deps import get_current_active_user, get_current_admin

router = APIRouter()

# Schemas
class VehicleRecommendRequest(BaseModel):
    cargo_weight: float

class PricePredictRequest(BaseModel):
    distance_km: float
    cargo_weight: float

class RouteRecommendRequest(BaseModel):
    pickup_latitude: float
    pickup_longitude: float
    drop_latitude: float
    drop_longitude: float

class AskRequest(BaseModel):
    query: str

@router.post("/recommend-vehicle")
def api_recommend_vehicle(req: VehicleRecommendRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_active_user)):
    vehicles = db.query(Vehicle).all()
    result = recommend_vehicle(req.cargo_weight, vehicles)
    if not result:
        raise HTTPException(status_code=404, detail="No suitable vehicles found")
    return result

@router.post("/predict-price")
def api_predict_price(req: PricePredictRequest, current_user: dict = Depends(get_current_active_user)):
    return calculate_estimated_price(req.distance_km, req.cargo_weight)

@router.post("/recommend-route")
def api_recommend_route(req: RouteRecommendRequest, current_user: dict = Depends(get_current_active_user)):
    return recommend_routes(req.pickup_latitude, req.pickup_longitude, req.drop_latitude, req.drop_longitude)

@router.post("/ask")
def api_ask_assistant(req: AskRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    tools = process_query_and_get_tools(req.query)
    context_lines = []
    
    for t in tools:
        res = execute_tool(db, t, {})
        context_lines.append(f"- {res}")
        
    context_str = "\n".join(context_lines)
    
    response = ask_business_assistant(req.query, context_str)
    return {"answer": response, "context_used": tools}
