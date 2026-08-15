import requests

API_URL = "http://127.0.0.1:8000/api"

def run_verification():
    print("Fetching Financial Dashboard...")
    dash_res = requests.get(f"{API_URL}/financials/dashboard")
    dashboard = dash_res.json()
    print(f"Dashboard Revenue: {dashboard['revenue']}")
    print(f"Dashboard Expenses: {dashboard['expenses']}")
    print(f"Dashboard Profit: {dashboard['profit']}")
    
    queries = [
        "What is our total revenue?",
        "What are our total expenses?",
        "What is our net profit?",
        "How many trips are currently active?"
    ]
    
    print("\nQuerying AI Assistant...")
    for q in queries:
        res = requests.post(f"{API_URL}/intelligence/ask", json={"query": q})
        data = res.json()
        print(f"\nQ: {q}")
        print(f"Context Tools Used: {data['context_used']}")
        print(f"A: {str(data['answer']).encode('ascii', 'ignore').decode('ascii')}")

if __name__ == "__main__":
    run_verification()
