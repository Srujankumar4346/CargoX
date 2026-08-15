import os
import google.generativeai as genai
import openai
from dotenv import load_dotenv

load_dotenv()

# We will try to get keys from the environment
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

def ask_business_assistant(query: str, db_context_str: str) -> str:
    """
    Sends a query and context to the LLM. 
    If no API key is provided, it falls back to a deterministic regex/mock pattern for demo purposes.
    """
    prompt = f"""You are the CargoX AI Business Assistant. You help admins understand their transport business data.
Based on the following data retrieved from the database, answer the user's question clearly and concisely.

[Database Context]
{db_context_str}

[User Question]
{query}

Answer:"""

    # 1. Try Gemini
    if GEMINI_API_KEY:
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Gemini Error: {str(e)}"
            
    # 2. Try OpenAI
    if OPENAI_API_KEY:
        try:
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"OpenAI Error: {str(e)}"
            
    # 3. Fallback Mock (If no API keys are provided for development)
    # Just format the db_context_str nicely as a response
    return f"(Mock AI Response due to missing API keys)\n\nBased on the data:\n{db_context_str}"

def process_query_and_get_tools(query: str) -> list:
    """
    A simple intent matcher to decide which tools to run before calling the LLM.
    In a full LangChain/Agent implementation, the LLM decides this.
    For Phase 5, we use keyword matching to fetch context safely.
    """
    query_lower = query.lower()
    tools_to_run = []
    
    if "revenue" in query_lower and "month" in query_lower:
        tools_to_run.append("get_total_revenue") # Mapped to total for now
    elif "revenue" in query_lower:
        tools_to_run.append("get_total_revenue")
        
    if "expense" in query_lower:
        tools_to_run.append("get_total_expenses")
        
    if "profit" in query_lower:
        tools_to_run.append("get_net_profit")
        
    if "active" in query_lower or "running" in query_lower:
        tools_to_run.append("get_active_trips")
        
    if "pending" in query_lower or "booking" in query_lower:
        tools_to_run.append("get_pending_bookings")
        
    # Default if no keywords match but we want to provide general financial context
    if not tools_to_run:
        tools_to_run = ["get_total_revenue", "get_total_expenses", "get_net_profit"]
        
    return tools_to_run
