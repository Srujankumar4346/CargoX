import requests
import time
import sys

BASE_URL = "http://localhost"
# If running via Docker Compose, wait for Nginx and backend to be up
print("Waiting for CargoX Backend to become available...")
for _ in range(30):
    try:
        r = requests.get(f"{BASE_URL}/api/docs")
        if r.status_code == 200:
            print("Backend is up!")
            break
    except requests.exceptions.ConnectionError:
        pass
    time.sleep(2)
else:
    print("Backend did not start in time. Exiting.")
    sys.exit(1)

def get_token(username, password):
    res = requests.post(f"{BASE_URL}/api/auth/login", data={"username": username, "password": password})
    res.raise_for_status()
    return res.json()["access_token"]

def run_e2e():
    print("1. Customer Login")
    cust_token = get_token("cust_e2e@cargox.test", "pass")
    
    # We assume setup data is seeded by Alembic/startup scripts for E2E tests.
    # We will simulate fetching the customer ID directly from token or just know it's 2.
    
    # In a real Docker env, we might need a dedicated endpoint to fetch our own profile.
    # For now, let's just make the booking assuming customer_id = 2 (if seeded).
    # To be robust, let's just rely on the API.

    print("2. Customer Creates Booking")
    res = requests.post(
        f"{BASE_URL}/api/bookings/", 
        headers={"Authorization": f"Bearer {cust_token}"},
        json={
            "customer_id": 2, # Assuming seeded customer
            "pickup_address": "Point A",
            "drop_address": "Point B",
            "cargo_type": "Electronics",
            "cargo_weight": 5
        }
    )
    if res.status_code != 200:
        print("Booking creation failed:", res.text)
        sys.exit(1)
    
    booking_id = res.json()["id"]
    print(f"Booking {booking_id} created successfully.")

    print("3. Admin Login & Assign Vehicle/Driver")
    admin_token = get_token("admin_e2e@cargox.test", "pass")
    res = requests.post(
        f"{BASE_URL}/api/trips/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "booking_id": booking_id,
            "vehicle_id": 1, # Assuming seeded vehicle
            "driver_id": 1   # Assuming seeded driver
        }
    )
    if res.status_code != 200:
        print("Trip creation failed:", res.text)
        sys.exit(1)
        
    trip_id = res.json()["id"]
    print(f"Trip {trip_id} created successfully.")

    print("4. Driver Login & Trip Flow")
    drv_token = get_token("drv_e2e@cargox.test", "pass")
    
    print("Driver starts trip (IN TRANSIT)")
    res = requests.put(
        f"{BASE_URL}/api/mobile/trips/{trip_id}/status?new_status=IN TRANSIT",
        headers={"Authorization": f"Bearer {drv_token}"}
    )
    res.raise_for_status()

    print("Driver sends GPS update")
    res = requests.post(
        f"{BASE_URL}/api/tracking/{trip_id}/location",
        headers={"Authorization": f"Bearer {drv_token}"},
        json={"latitude": 10.0, "longitude": 20.0}
    )
    res.raise_for_status()

    print("Driver arrives")
    res = requests.put(
        f"{BASE_URL}/api/mobile/trips/{trip_id}/status?new_status=ARRIVED AT DESTINATION",
        headers={"Authorization": f"Bearer {drv_token}"}
    )
    res.raise_for_status()

    print("Driver submits POD data")
    res = requests.post(
        f"{BASE_URL}/api/mobile/trips/{trip_id}/pod",
        headers={"Authorization": f"Bearer {drv_token}"},
        json={
            "receiver_name": "John Doe",
            "signature_url": "/uploads/test.png",
            "notes": "Delivered intact"
        }
    )
    res.raise_for_status()

    print("Driver marks delivered")
    res = requests.put(
        f"{BASE_URL}/api/mobile/trips/{trip_id}/status?new_status=DELIVERED",
        headers={"Authorization": f"Bearer {drv_token}"}
    )
    res.raise_for_status()

    print("5. Admin marks complete")
    res = requests.put(
        f"{BASE_URL}/api/trips/{trip_id}/status?new_status=COMPLETED",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    res.raise_for_status()
    
    print("E2E Docker execution passed successfully! ✅")

if __name__ == "__main__":
    run_e2e()
