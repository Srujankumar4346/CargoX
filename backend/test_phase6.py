import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000/api"
MOBILE_URL = "http://127.0.0.1:8000/api/mobile"

def run_tests():
    print("--- Testing Phase 6 ---")
    
    # 1. Create a Booking (should trigger NEW_BOOKING event)
    booking_data = {
        "customer_id": 1,
        "pickup_address": "Hyderabad",
        "drop_address": "Bangalore",
        "cargo_weight": 5.0,
        "cargo_type": "Electronics",
        "pickup_date": "2026-12-01",
        "expected_delivery_date": "2026-12-03",
        "status": "REQUESTED"
    }
    print("\n1. Creating Booking...")
    resp = requests.post(f"{BASE_URL}/bookings/", json=booking_data)
    if resp.status_code != 200:
        print("Failed:", resp.text)
        return
    booking = resp.json()
    booking_id = booking['id']
    print(f"Booking {booking_id} created.")

    # Check Notification Table via DB
    time.sleep(1)

    # 2. Check Notifications
    print("\n2. Checking Notifications for Customer 1...")
    resp = requests.get(f"{BASE_URL}/notifications/?user_type=CUSTOMER&user_id=1")
    if resp.status_code == 200:
        notifications = resp.json()
        print(f"Customer 1 Notifications: {len(notifications)}")
        for n in notifications:
            print(f" - [{n['channel']}] {n['event_type']}: {n['title']} (Read: {n['is_read']})")
    
    print("\n3. Checking Notifications for Admin...")
    resp = requests.get(f"{BASE_URL}/notifications/?user_type=ADMIN&user_id=0")
    if resp.status_code == 200:
        notifications = resp.json()
        print(f"Admin Notifications: {len(notifications)}")
        for n in notifications:
            print(f" - [{n['channel']}] {n['event_type']}: {n['title']}")

    # 3.5 Create Vehicle and Driver
    v_resp = requests.post(f"{BASE_URL}/vehicles/", json={
        "registration_number": "TEST-1234",
        "vehicle_type": "Truck",
        "capacity": "10 Ton",
        "status": "AVAILABLE"
    })
    vehicle_id = v_resp.json()['id']
    
    d_resp = requests.post(f"{BASE_URL}/drivers/", json={
        "name": "Test Driver",
        "license_number": "LIC-999",
        "phone_number": "9999999999",
        "status": "AVAILABLE"
    })
    driver_id = d_resp.json()['id']

    # 4. Assign Trip
    trip_data = {
        "booking_id": booking_id,
        "vehicle_id": vehicle_id,
        "driver_id": driver_id
    }
    print(f"\n4. Creating Trip for Booking {booking_id}...")
    resp = requests.post(f"{BASE_URL}/trips/", json=trip_data)
    if resp.status_code != 200:
        print("Failed to create trip (Make sure Vehicle 1 and Driver 1 exist and are AVAILABLE):", resp.text)
    else:
        trip = resp.json()
        trip_id = trip['id']
        print(f"Trip {trip_id} created.")
        
        # 5. Mobile API
        print(f"\n5. Testing Mobile API (Get Today's Trips for Driver {driver_id})...")
        resp = requests.get(f"{MOBILE_URL}/trips/today?driver_id={driver_id}")
        if resp.status_code == 200:
            mobile_trips = resp.json()
            print(f"Driver {driver_id} Active Trips: {len(mobile_trips)}")
        
        print("\n6. Testing Mobile API (Update Status to IN TRANSIT)...")
        resp = requests.put(f"{MOBILE_URL}/trips/{trip_id}/status?new_status=IN%20TRANSIT&driver_id={driver_id}")
        if resp.status_code == 200:
            print(f"Status updated to: {resp.json()['status']}")
        else:
            print("Failed:", resp.text)
            
        print("\n7. Testing Mobile API (Update Status to DELIVERED)...")
        requests.put(f"{MOBILE_URL}/trips/{trip_id}/status?new_status=ARRIVED%20AT%20DESTINATION&driver_id={driver_id}")
        resp = requests.put(f"{MOBILE_URL}/trips/{trip_id}/status?new_status=DELIVERED&driver_id={driver_id}")
        if resp.status_code == 200:
            print(f"Status updated to: {resp.json()['status']}")
            
            print("\n8. Testing Mobile API (Submit POD & Complete)...")
            pod_data = {
                "receiver_name": "John Doe",
                "signature_url": "/sig.png",
                "notes": "Delivered intact"
            }
            resp = requests.post(f"{MOBILE_URL}/trips/{trip_id}/pod?driver_id={driver_id}", json=pod_data)
            if resp.status_code == 200:
                print("POD Submitted.")
                requests.put(f"{MOBILE_URL}/trips/{trip_id}/status?new_status=COMPLETED&driver_id={driver_id}")
                print("Trip Completed.")
            else:
                print("POD Failed:", resp.text)
        else:
            print("Failed to deliver:", resp.text)

    # Print final notifications
    print("\n9. Final Notifications Check for Customer 1...")
    resp = requests.get(f"{BASE_URL}/notifications/?user_type=CUSTOMER&user_id=1")
    if resp.status_code == 200:
        for n in resp.json():
            print(f" - [{n['channel']}] {n['event_type']}: {n['title']}")

if __name__ == "__main__":
    run_tests()
