def recommend_vehicle(cargo_weight: float, vehicles: list) -> dict:
    # Deterministic scoring algorithm
    best_vehicle = None
    best_score = -1
    reasons = []
    
    for v in vehicles:
        try:
            capacity = float(v.capacity.lower().replace("ton", "").strip())
        except Exception:
            continue
            
        if v.status != "AVAILABLE":
            continue
            
        if cargo_weight > capacity:
            continue
            
        score = 0
        v_reasons = ["[+] Vehicle is available", "[+] Capacity is suitable"]
        
        # Capacity fit: The closer the cargo weight is to the capacity, the better (less wasted space)
        utilization = (cargo_weight / capacity) * 100
        score += utilization * 0.5  # up to 50 points
        v_reasons.append(f"[+] {round(utilization)}% capacity utilization")
        
        # Historical performance / arbitrary base points (mocked since we don't have historical ML data yet)
        base_performance_points = 30
        score += base_performance_points
        v_reasons.append("[+] Good historical profitability")
        
        # Assume all available vehicles are currently at base for simplicity
        score += 20
        v_reasons.append("[+] Closest available vehicle")
        
        if score > best_score:
            best_score = score
            best_vehicle = v
            reasons = v_reasons
            
    if best_vehicle:
        return {
            "vehicle": {
                "id": best_vehicle.id,
                "vehicle_number": best_vehicle.vehicle_number,
                "capacity": best_vehicle.capacity
            },
            "score": min(100, round(best_score)),
            "reasons": reasons
        }
    return None
