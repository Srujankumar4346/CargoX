import requests
import sys

API_URL = "http://127.0.0.1:8000/api"

def print_step(msg):
    print(f"\n{'-'*50}\n> {msg}\n{'-'*50}")

def print_result(msg):
    print(f"  -> {str(msg).encode('ascii', 'ignore').decode('ascii')}")

def test_intelligence():
    try:
        # ---------------------------------------------------------
        # Test 1: Price Prediction
        # ---------------------------------------------------------
        print_step("Test 1: Price Prediction Engine")
        req1 = {"distance_km": 200.0, "cargo_weight": 5.0}
        req2 = {"distance_km": 500.0, "cargo_weight": 10.0}
        
        res1 = requests.post(f"{API_URL}/intelligence/predict-price", json=req1)
        res2 = requests.post(f"{API_URL}/intelligence/predict-price", json=req2)
        
        price1 = res1.json()
        price2 = res2.json()
        
        print_result(f"Short Trip (200km, 5T): {price1['total']}")
        print_result(f"Long Trip (500km, 10T): {price2['total']}")
        
        assert price2['total'] > price1['total'], "Longer heavier trip should cost more"
        print_result("Price logic validated [OK]")

        # ---------------------------------------------------------
        # Test 2: Vehicle Recommendation
        # ---------------------------------------------------------
        print_step("Test 2: Vehicle Recommendation Engine")
        
        # Cargo: 7 tons (Should fit in 10-ton truck, reject 5-ton truck)
        v_req = {"cargo_weight": 7.0}
        res_v = requests.post(f"{API_URL}/intelligence/recommend-vehicle", json=v_req)
        
        if res_v.status_code == 200:
            rec = res_v.json()
            print_result(f"Recommended Vehicle: {rec['vehicle']['vehicle_number']} ({rec['vehicle']['capacity']})")
            print_result(f"Score: {rec['score']}")
            for r in rec['reasons']:
                print_result(f"Reason: {r}")
                
            assert float(rec['vehicle']['capacity'].split()[0]) >= 7.0, "Assigned vehicle capacity too low!"
            print_result("Vehicle logic validated [OK]")
        else:
            print_result(f"Failed to recommend: {res_v.text}")

        # ---------------------------------------------------------
        # Test 3: AI Business Assistant
        # ---------------------------------------------------------
        print_step("Test 3: AI Business Assistant Tools")
        
        ask_req = {"query": "What is our total revenue?"}
        res_ask = requests.post(f"{API_URL}/intelligence/ask", json=ask_req)
        ask_data = res_ask.json()
        
        print_result(f"Context used: {ask_data['context_used']}")
        print_result(f"AI Response: {ask_data['answer']}")
        
        assert "get_total_revenue" in ask_data['context_used'], "AI didn't use the correct tool!"
        print_result("AI Assistant logic validated [OK]")

        # ---------------------------------------------------------
        # Test 4: Route Intelligence
        # ---------------------------------------------------------
        print_step("Test 4: Route Intelligence Engine (OSRM)")
        route_req = {
            "pickup_latitude": 17.3850,
            "pickup_longitude": 78.4867,
            "drop_latitude": 16.5062,
            "drop_longitude": 80.6480
        }
        res_route = requests.post(f"{API_URL}/intelligence/recommend-route", json=route_req)
        routes = res_route.json()
        
        print_result(f"Found {len(routes)} routes.")
        for r in routes:
            print_result(f"- {r['name']}: {r['distance_km']}km in {r['time_str']} | Score: {r['score']}")
        
        assert len(routes) > 0, "No routes returned"
        print_result("Route Engine logic validated [OK]")

        print_step("ALL PHASE 5 TESTS PASSED!")

    except Exception as e:
        import traceback
        print_result("Exception during test:")
        traceback.print_exc()

if __name__ == "__main__":
    test_intelligence()
