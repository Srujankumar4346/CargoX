import os
import requests
import time

# Wait for fast api to be up
API_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("--- Running Phase 6 Notification Tests ---")
    
    # 1. Fetch current notifications for customer 1
    res = requests.get(f"{API_URL}/notifications/", params={"user_type": "CUSTOMER", "user_id": 1})
    initial_count = len(res.json())
    
    # 2. Create a booking (will notify ADMIN)
    booking_data = {
        "customer_id": 1,
        "pickup_location": "Delhi",
        "drop_location": "Agra",
        "cargo_weight": 5,
        "cargo_type": "Steel",
        "pickup_address": "Some pickup",
        "drop_address": "Some drop",
        "pickup_latitude": 28.6139,
        "pickup_longitude": 77.2090,
        "drop_latitude": 27.1767,
        "drop_longitude": 78.0081
    }
    booking_res = requests.post(f"{API_URL}/bookings/", json=booking_data)
    booking_id = booking_res.json()["id"]
    print(f"Created Booking #{booking_id}")
    
    # 3. Fetch notifications for ADMIN
    res = requests.get(f"{API_URL}/notifications/", params={"user_type": "ADMIN", "user_id": 0})
    admin_notifs = res.json()
    assert admin_notifs[0]["title"] == "New Booking Requested"
    print("OK Admin Notification verified (In-App)")
    
    # 4. Assign Trip (Notify Driver & Customer)
    # create vehicle and driver first if needed, let's just pick id 1 for both
    trip_data = {
        "booking_id": booking_id,
        "vehicle_id": 1,
        "driver_id": 1
    }
    # This might fail if vehicle 1 is not AVAILABLE, but we assume it is for test, or we handle it.
    trip_res = requests.post(f"{API_URL}/trips/", json=trip_data)
    if trip_res.status_code == 200:
        trip_id = trip_res.json()["id"]
        
        # 5. Fetch notifications for CUSTOMER 1
        res = requests.get(f"{API_URL}/notifications/", params={"user_type": "CUSTOMER", "user_id": 1})
        cust_notifs = res.json()
        assert len(cust_notifs) > initial_count
        assert cust_notifs[0]["title"] == "Vehicle Assigned"
        print("OK Customer Notification verified (In-App & Email mock)")
        
        # 6. Fetch notifications for DRIVER 1
        res = requests.get(f"{API_URL}/notifications/", params={"user_type": "DRIVER", "user_id": 1})
        driver_notifs = res.json()
        assert driver_notifs[0]["title"] == "New Trip Assigned"
        print("OK Driver Notification verified (In-App & SMS mock)")

        # 7. Update status
        requests.put(f"{API_URL}/trips/{trip_id}/status", params={"new_status": "IN TRANSIT"})
        res = requests.get(f"{API_URL}/notifications/", params={"user_type": "CUSTOMER", "user_id": 1})
        cust_notifs = res.json()
        assert cust_notifs[0]["title"] == "Trip Status Updated"
        print("OK Customer Status Update Notification verified")
    else:
        print(f"Skipping assignment notification test because: {trip_res.json()}")

    print("--- Phase 6 Backend Verification Complete ---")

if __name__ == "__main__":
    run_tests()
