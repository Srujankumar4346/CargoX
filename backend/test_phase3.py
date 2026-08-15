import requests
import time
import sys

API_URL = "http://127.0.0.1:8000/api"

def print_step(msg):
    print(f"\n{'-'*50}\n> {msg}\n{'-'*50}")

def print_result(msg):
    print(f"  -> {msg}")

def test_financials():
    try:
        # ---------------------------------------------------------
        # Pre-requisite: Create Booking & Trip
        # ---------------------------------------------------------
        print_step("Pre-requisite: Creating Booking and Trip")
        booking_data = {
            "customer_id": 1,
            "pickup_location": "Hyderabad",
            "drop_location": "Vijayawada",
            "cargo_type": "Furniture",
            "cargo_weight": 5.0 # 5 Tons
        }
        res = requests.post(f"{API_URL}/bookings/", json=booking_data)
        booking_id = res.json()['id']
        print_result(f"Booking ID: {booking_id}")
        
        trip_data = {
            "booking_id": booking_id,
            "vehicle_id": 1, # Assuming vehicle 1 has capacity >= 5
            "driver_id": 1
        }
        res = requests.post(f"{API_URL}/trips/", json=trip_data)
        trip_id = res.json()['id']
        print_result(f"Trip ID: {trip_id}")
        
        # ---------------------------------------------------------
        # Test 1 — Auto-generated Invoice
        # ---------------------------------------------------------
        print_step("Test 1: Auto-generated Invoice Check")
        inv_res = requests.get(f"{API_URL}/financials/invoices")
        invoices = inv_res.json()
        invoice = [i for i in invoices if i['booking_id'] == booking_id][0]
        
        # 5 tons * 3000 = 15000, + 10% tax (1500) = 16500
        assert float(invoice['base_charge']) == 15000.0
        assert float(invoice['taxes']) == 1500.0
        assert float(invoice['total_amount']) == 16500.0
        assert invoice['status'] == "PENDING"
        print_result(f"Invoice ID {invoice['id']} auto-generated successfully!")
        print_result(f"Total Amount: Rs. {invoice['total_amount']}")
        
        # ---------------------------------------------------------
        # Test 2 — Advance Payment
        # ---------------------------------------------------------
        print_step("Test 2: Making Advance Payment (Rs. 5000)")
        payment_data = {
            "invoice_id": invoice['id'],
            "amount": 5000.0,
            "payment_method": "BANK_TRANSFER",
            "payment_type": "ADVANCE",
            "recorded_by": "Admin"
        }
        pay_res = requests.post(f"{API_URL}/financials/payments", json=payment_data)
        
        inv_res2 = requests.get(f"{API_URL}/financials/invoices")
        invoice_updated = [i for i in inv_res2.json() if i['id'] == invoice['id']][0]
        
        assert float(invoice_updated['amount_paid']) == 5000.0
        assert float(invoice_updated['amount_due']) == 11500.0
        assert invoice_updated['status'] == "PARTIALLY_PAID"
        print_result(f"Status updated to: {invoice_updated['status']}")
        print_result(f"Amount Due: Rs. {invoice_updated['amount_due']}")
        
        # ---------------------------------------------------------
        # Test 3 — Driver Logging Expenses
        # ---------------------------------------------------------
        print_step("Test 3: Logging Trip Expenses (Fuel, Toll, Allowance)")
        expenses = [
            {"trip_id": trip_id, "expense_type": "FUEL", "amount": 3500.0, "recorded_by": "Driver1"},
            {"trip_id": trip_id, "expense_type": "TOLL", "amount": 800.0, "recorded_by": "Driver1"},
            {"trip_id": trip_id, "expense_type": "ALLOWANCE", "amount": 700.0, "recorded_by": "Driver1"}
        ]
        
        for exp in expenses:
            requests.post(f"{API_URL}/financials/expenses", json=exp)
            print_result(f"Logged {exp['expense_type']} expense: Rs. {exp['amount']}")
            
        # ---------------------------------------------------------
        # Test 4 — Financial Dashboard / Profitability
        # ---------------------------------------------------------
        print_step("Test 4: Admin Financial Dashboard / Profitability")
        dash_res = requests.get(f"{API_URL}/financials/dashboard")
        dashboard = dash_res.json()
        
        # Expected Revenue = 16500 (Invoice Total)
        # Expected Expenses = 3500 + 800 + 700 = 5000
        # Expected Profit = 16500 - 5000 = 11500
        print_result(f"Total Revenue: Rs. {dashboard['revenue']}")
        print_result(f"Total Expenses: Rs. {dashboard['expenses']}")
        print_result(f"Net Profit: Rs. {dashboard['profit']}")
        
        assert dashboard['revenue'] == 16500.0
        assert dashboard['expenses'] == 5000.0
        assert dashboard['profit'] == 11500.0
        
        print_step("ALL PHASE 3 FINANCIAL TESTS PASSED!")
        
    except Exception as e:
        import traceback
        print_result(f"Exception during test:")
        traceback.print_exc()

if __name__ == "__main__":
    test_financials()
