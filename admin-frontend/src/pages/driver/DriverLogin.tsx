import { useState } from "react";
import { Truck, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";

export default function DriverLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || "http://127.0.0.1:8000") + "/api/v1/auth/driver-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Invalid username or password");
      }
      
      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      navigate("/driver", { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020b1a] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center mb-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 mb-6">
          <Truck className="h-8 w-8 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Driver Portal</h1>
        <p className="text-slate-400">Sign in to access your assigned deliveries and delivery tools.</p>
      </div>
      <div className="bg-[#071425] p-6 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-slate-800 w-full max-w-sm">
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input 
              required 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" 
              placeholder="Enter your username" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input 
              required 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" 
              placeholder="Enter your password" 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-bold text-white transition hover:bg-blue-500 disabled:opacity-50 mt-4"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
