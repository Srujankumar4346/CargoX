def calculate_estimated_price(distance_km: float, weight_tons: float) -> dict:
    # Basic algorithmic pricing strategy
    base_cost = 3000
    distance_cost = distance_km * 12.0  # Rs 12 per km
    fuel_cost = (distance_km / 5.0) * 100.0  # Assumes 5kmpl, Rs 100/liter
    weight_cost = weight_tons * 500.0  # Rs 500 per ton
    toll_estimate = (distance_km / 100.0) * 150.0  # Rs 150 every 100km
    
    # Margin is 25% of the total base operational costs
    operational_cost = base_cost + distance_cost + fuel_cost + weight_cost + toll_estimate
    margin = operational_cost * 0.25
    
    total = operational_cost + margin
    
    return {
        "base": round(base_cost, 2),
        "distance": round(distance_cost, 2),
        "fuel": round(fuel_cost, 2),
        "weight": round(weight_cost, 2),
        "toll": round(toll_estimate, 2),
        "margin": round(margin, 2),
        "total": round(total, 2)
    }
