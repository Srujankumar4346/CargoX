import requests

def fetch_osrm_routes(pickup_lat: float, pickup_lng: float, drop_lat: float, drop_lng: float):
    url = f"http://router.project-osrm.org/route/v1/driving/{pickup_lng},{pickup_lat};{drop_lng},{drop_lat}?overview=full&alternatives=true"
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "routes" in data:
                return data["routes"]
    except Exception as e:
        print("OSRM Fetch Error:", e)
    return []

def recommend_routes(pickup_lat: float, pickup_lng: float, drop_lat: float, drop_lng: float):
    routes = fetch_osrm_routes(pickup_lat, pickup_lng, drop_lat, drop_lng)
    
    if not routes:
        # Fallback if OSRM fails or has no route
        return [{
            "name": "Fallback Direct Route",
            "distance_km": 500.0,
            "time_str": "10h 0m",
            "fuel_cost": 5000.0,
            "score": 100,
            "reasons": ["Fallback heuristic route due to API failure"]
        }]
        
    scored_routes = []
    
    for i, route in enumerate(routes):
        dist_km = route.get("distance", 0) / 1000.0
        duration_s = route.get("duration", 0)
        
        # Format time
        hours = int(duration_s // 3600)
        mins = int((duration_s % 3600) // 60)
        
        fuel_cost = (dist_km / 5.0) * 100.0
        
        # Score calculation: Lower distance and lower duration = better score
        # For simplicity, we just use a formula where shorter dist/time gets higher score.
        score = max(0, 100 - (dist_km * 0.1) - (hours * 2))
        
        name = f"Route {chr(65+i)}"
        
        reasons = []
        if i == 0:
            reasons.append("[+] Fastest time")
            reasons.append("[+] Default OSRM suggestion")
        
        scored_routes.append({
            "name": name,
            "distance_km": round(dist_km, 1),
            "time_str": f"{hours}h {mins}m",
            "fuel_cost": round(fuel_cost, 2),
            "score": round(score),
            "reasons": reasons
        })
        
    # Sort by highest score
    scored_routes = sorted(scored_routes, key=lambda x: x["score"], reverse=True)
    return scored_routes
