import requests
import time
import sys

API_URL = "http://127.0.0.1:8000/api"

def print_step(msg):
    print(f"\n{'-'*50}\n> {msg}\n{'-'*50}")

def print_result(msg):
    print(f"  -> {msg}")

def test_integration():
    try:
        # ---------------------------------------------------------
        # Test 1 — Customer booking (5 tons)
        # ---------------------------------------------------------
        print_step("Test 1: Customer Booking (5 tons)")
        booking_data = {
            "customer_id": 1,
            "pickup_location": "Hyderabad",
            "drop_location": "Vijayawada",
            "cargo_type": "Furniture",
            "cargo_weight": 5.0
        }
        res = requests.post(f"{API_URL}/bookings/", json=booking_data)
        if res.status_code == 200:
            booking = res.json()
            booking_id = booking['id']
            print_result(f"Booking created successfully! ID: {booking_id}")
            print_result(f"Status: {booking['status']}")
            assert booking['status'] == "REQUESTED", "Booking status should be REQUESTED"
        else:
            print_result(f"Failed to create booking: {res.text}")
            sys.exit(1)

        # ---------------------------------------------------------
        # Test 2 — Admin assignment
        # ---------------------------------------------------------
        print_step("Test 2: Admin Assignment (Assign 10 ton vehicle to 5 ton cargo)")
        trip_data = {
            "booking_id": booking_id,
            "vehicle_id": 1, # 10 ton vehicle
            "driver_id": 1
        }
        res = requests.post(f"{API_URL}/trips/", json=trip_data)
        if res.status_code == 200:
            trip = res.json()
            trip_id = trip['id']
            print_result(f"Trip created successfully! ID: {trip_id}")
            
            # Verify Statuses
            book_res = requests.get(f"{API_URL}/bookings/")
            book = [b for b in book_res.json() if b['id'] == booking_id][0]
            print_result(f"Booking Status -> {book['status']}")
            assert book['status'] == "VEHICLE + DRIVER ASSIGNED"
            
            veh_res = requests.get(f"{API_URL}/vehicles/")
            veh = [v for v in veh_res.json() if v['id'] == 1][0]
            print_result(f"Vehicle Status -> {veh['status']}")
            assert veh['status'] == "ASSIGNED"
            
            drv_res = requests.get(f"{API_URL}/drivers/")
            drv = [d for d in drv_res.json() if d['id'] == 1][0]
            print_result(f"Driver Status -> {drv['status']}")
            assert drv['status'] == "ASSIGNED"
            
            print_result(f"Trip Status -> {trip['status']}")
            assert trip['status'] == "TRIP CREATED"
            
        else:
            print_result(f"Failed to create trip: {res.text}")
            sys.exit(1)

        # ---------------------------------------------------------
        # Test 3 — Driver workflow (Status Updates)
        # ---------------------------------------------------------
        print_step("Test 3: Driver Trip Status Workflow")
        statuses = ["IN TRANSIT", "DELIVERED", "COMPLETED"]
        for s in statuses:
            time.sleep(0.5)
            res = requests.put(f"{API_URL}/trips/{trip_id}/status?new_status={requests.utils.quote(s)}")
            if res.status_code == 200:
                print_result(f"Trip status successfully updated to -> {s}")
            else:
                print_result(f"Failed to update trip status to {s}: {res.text}")
                sys.exit(1)
        
        # Verify resources freed after completed
        veh_res = requests.get(f"{API_URL}/vehicles/")
        veh = [v for v in veh_res.json() if v['id'] == 1][0]
        assert veh['status'] == "AVAILABLE", "Vehicle should be AVAILABLE after trip completion"
        print_result("Vehicle is back to AVAILABLE status.")
        
        # ---------------------------------------------------------
        # Test 4 — Capacity Validation (10 tons cargo vs 5 tons vehicle)
        # ---------------------------------------------------------
        print_step("Test 4: Capacity Validation (10 ton cargo -> 5 ton vehicle)")
        booking_data_2 = {
            "customer_id": 1,
            "pickup_location": "Hyderabad",
            "drop_location": "Vizag",
            "cargo_type": "Steel",
            "cargo_weight": 10.0
        }
        res2 = requests.post(f"{API_URL}/bookings/", json=booking_data_2)
        booking2_id = res2.json()['id']
        print_result(f"Created Booking ID: {booking2_id} (10 Tons)")
        
        trip_data_invalid_cap = {
            "booking_id": booking2_id,
            "vehicle_id": 2, # 5 ton vehicle
            "driver_id": 1
        }
        res_cap = requests.post(f"{API_URL}/trips/", json=trip_data_invalid_cap)
        if res_cap.status_code == 400:
            print_result(f"SUCCESS: Assignment rejected! Reason: {res_cap.json()['detail']}")
        else:
            print_result(f"FAIL: Should have rejected due to capacity. Status: {res_cap.status_code}")
            
        # ---------------------------------------------------------
        # Test 5 — Availability Validation (Assign same vehicle twice)
        # ---------------------------------------------------------
        print_step("Test 5: Availability Validation")
        # First assign 10 ton vehicle (id=1) to the 10 ton booking
        trip_data_valid = {
            "booking_id": booking2_id,
            "vehicle_id": 1, 
            "driver_id": 1
        }
        res_valid = requests.post(f"{API_URL}/trips/", json=trip_data_valid)
        if res_valid.status_code == 200:
            print_result("Assigned Vehicle 1 to Booking 2 successfully.")
        
        # Now create another booking and try to assign Vehicle 1 again
        booking_data_3 = {
            "customer_id": 1, "pickup_location": "A", "drop_location": "B", "cargo_type": "Box", "cargo_weight": 1.0
        }
        res3 = requests.post(f"{API_URL}/bookings/", json=booking_data_3)
        booking3_id = res3.json()['id']
        
        trip_data_invalid_avail = {
            "booking_id": booking3_id,
            "vehicle_id": 1, # Already assigned
            "driver_id": 2
        }
        res_avail = requests.post(f"{API_URL}/trips/", json=trip_data_invalid_avail)
        if res_avail.status_code == 400:
            print_result(f"SUCCESS: Assignment rejected! Reason: {res_avail.json()['detail']}")
        else:
            print_result(f"FAIL: Should have rejected due to availability. Status: {res_avail.status_code}")

        print_step("ALL INTEGRATION TESTS PASSED 🎉")
        
    except Exception as e:
        print_result(f"Exception during test: {str(e)}")

if __name__ == "__main__":
    test_integration()
