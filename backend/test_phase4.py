import requests
import time
import sys

API_URL = "http://127.0.0.1:8000/api"

def print_step(msg):
    print(f"\n{'-'*50}\n> {msg}\n{'-'*50}")

def print_result(msg):
    print(f"  -> {msg}")

def test_tracking():
    try:
        # ---------------------------------------------------------
        # Pre-requisite: Create Booking & Trip
        # ---------------------------------------------------------
        print_step("Pre-requisite: Creating Booking and Trip")
        booking_data = {
            "customer_id": 1,
            "pickup_address": "Hyderabad, Telangana",
            "pickup_latitude": 17.3850,
            "pickup_longitude": 78.4867,
            "drop_address": "Vijayawada, Andhra Pradesh",
            "drop_latitude": 16.5062,
            "drop_longitude": 80.6480,
            "cargo_type": "Electronics",
            "cargo_weight": 2.5
        }
        res = requests.post(f"{API_URL}/bookings/", json=booking_data)
        booking_id = res.json()['id']
        print_result(f"Booking ID: {booking_id}")
        
        trip_data = {
            "booking_id": booking_id,
            "vehicle_id": 1, 
            "driver_id": 1
        }
        res = requests.post(f"{API_URL}/trips/", json=trip_data)
        trip_id = res.json()['id']
        print_result(f"Trip ID: {trip_id}")
        
        # ---------------------------------------------------------
        # Test E: Submit POD too early (Should be rejected)
        # ---------------------------------------------------------
        print_step("Test E: Submitting POD too early (TRIP CREATED)")
        pod_data = {
            "receiver_name": "Test Receiver",
            "signature_url": "simulated_file.png",
            "notes": "Delivered early"
        }
        res = requests.post(f"{API_URL}/tracking/{trip_id}/pod", json=pod_data)
        assert res.status_code == 400
        print_result(f"Rejected as expected: {res.json()['detail']}")
        
        # ---------------------------------------------------------
        # Transition to IN TRANSIT
        # ---------------------------------------------------------
        print_step("Transitioning to IN TRANSIT")
        res = requests.put(f"{API_URL}/trips/{trip_id}/status?new_status=IN%20TRANSIT")
        assert res.status_code == 200
        print_result(f"Trip Status: IN TRANSIT")
        
        # ---------------------------------------------------------
        # Test A: POST location
        # ---------------------------------------------------------
        print_step("Test A: POST location (GPS Simulator)")
        loc_data1 = {"latitude": 17.3850, "longitude": 78.4867}
        res = requests.post(f"{API_URL}/tracking/{trip_id}/location", json=loc_data1)
        assert res.status_code == 200
        print_result("Location 1 stored successfully")
        
        # ---------------------------------------------------------
        # Test B & C: Multiple locations and breadcrumbs
        # ---------------------------------------------------------
        print_step("Test B & C: Multiple locations and GET tracking")
        loc_data2 = {"latitude": 17.0, "longitude": 79.5}
        requests.post(f"{API_URL}/tracking/{trip_id}/location", json=loc_data2)
        
        loc_data3 = {"latitude": 16.5062, "longitude": 80.6480}
        requests.post(f"{API_URL}/tracking/{trip_id}/location", json=loc_data3)
        
        res = requests.get(f"{API_URL}/tracking/{trip_id}/location")
        locations = res.json()
        assert len(locations) == 3
        assert locations[0]['latitude'] == 17.3850
        assert locations[-1]['latitude'] == 16.5062
        print_result(f"Retrieved {len(locations)} locations in correct order")
        
        # ---------------------------------------------------------
        # Transition to ARRIVED AT DESTINATION
        # ---------------------------------------------------------
        print_step("Transitioning to ARRIVED AT DESTINATION")
        res = requests.put(f"{API_URL}/trips/{trip_id}/status?new_status=ARRIVED%20AT%20DESTINATION")
        assert res.status_code == 200
        print_result(f"Trip Status: ARRIVED AT DESTINATION")
        
        # ---------------------------------------------------------
        # Test D: Submit POD -> COMPLETED -> Vehicle Available
        # ---------------------------------------------------------
        print_step("Test D: Submit POD & Complete Trip")
        
        # First transition to DELIVERED
        res = requests.put(f"{API_URL}/trips/{trip_id}/status?new_status=DELIVERED")
        assert res.status_code == 200
        print_result("Trip Status: DELIVERED")
        
        # Submit POD
        res = requests.post(f"{API_URL}/tracking/{trip_id}/pod", json=pod_data)
        assert res.status_code == 200
        print_result("Proof of Delivery submitted successfully")
        
        # Mark as COMPLETED
        res = requests.put(f"{API_URL}/trips/{trip_id}/status?new_status=COMPLETED")
        assert res.status_code == 200
        
        # Verify driver and vehicle are available
        v_res = requests.get(f"{API_URL}/vehicles/")
        vehicle = [v for v in v_res.json() if v['id'] == 1][0]
        assert vehicle['status'] == "AVAILABLE"
        
        d_res = requests.get(f"{API_URL}/drivers/")
        driver = [d for d in d_res.json() if d['id'] == 1][0]
        assert driver['status'] == "AVAILABLE"
        
        print_result("Trip COMPLETED. Vehicle and Driver are AVAILABLE.")
        print_step("ALL PHASE 4 TRACKING TESTS PASSED!")
        
    except Exception as e:
        import traceback
        print_result(f"Exception during test:")
        traceback.print_exc()

if __name__ == "__main__":
    test_tracking()
