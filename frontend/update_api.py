import re

with open('src/services/api.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all occurrences of fetch(`${API_URL}...` with authFetch(`${API_URL}...`
content = content.replace('fetch(`${API_URL}', 'authFetch(`${API_URL}')

# Add authFetch definition
auth_fetch_def = """const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000") + "/api";

async function authFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('access_token');
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(url, { ...options, headers });
}
"""

content = content.replace('const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000") + "/api";', auth_fetch_def)

# Add login method to api object
login_method = """export const api = {
  // Auth
  login: async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    const res = await authFetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    return res.json();
  },"""

content = content.replace('export const api = {', login_method)
content = content.replace('fetch("http://127.0.0.1:8000/api', 'authFetch(`${API_URL}')

with open('src/services/api.ts', 'w', encoding='utf-8') as f:
    f.write(content)
