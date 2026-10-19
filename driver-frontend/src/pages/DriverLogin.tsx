import { useState } from "react";
import { AlertCircle, Mail, ArrowLeft, LogIn } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { SignInButton, useAuth } from "@clerk/react";
import CargoExpressLogo from "../components/CargoExpressLogo";
import DriverWelcomeScreen from "../components/DriverWelcomeScreen";

export default function DriverLogin() {
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  // If already signed in via Clerk, can enter driver portal
  if (isSignedIn) {
    navigate("/", { replace: true });
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://cargox-1.onrender.com" : "http://127.0.0.1:8000");
      const res = await fetch(baseUrl.replace(/\/+$/, "") + "/api/v1/auth/driver-login", {
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
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // If user hasn't toggled to sign-in form, show Screen 1 Reference Splash / Welcome
  if (!showLoginForm) {
    return (
      <DriverWelcomeScreen
        onContinue={() => {
          const hasLocalToken = !!localStorage.getItem("access_token");
          if (hasLocalToken || isSignedIn) {
            navigate("/", { replace: true });
          } else {
            setShowLoginForm(true);
          }
        }}
        onOpenLoginModal={() => setShowLoginForm(true)}
        isAuthenticated={isSignedIn || !!localStorage.getItem("access_token")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 text-slate-900">
      <div className="max-w-md w-full flex flex-col items-center text-center mb-6">
        <CargoExpressLogo variant="full" size="md" showTagline={true} theme="light" />
        <h1 className="text-2xl font-black text-slate-950 mt-4 mb-1">Driver Portal Sign In</h1>
        <p className="text-slate-500 text-xs">Sign in with your driver credentials to access assigned fleet orders.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-sm">
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Unique Username or User ID
            </label>
            <input 
              required 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-sm font-medium" 
              placeholder="e.g. pandu or driver ID" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin-Assigned Password
            </label>
            <input 
              required 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-sm" 
              placeholder="Enter password provided by admin" 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 hover:bg-black px-4 py-3 font-extrabold text-white text-sm transition disabled:opacity-50 mt-4 cursor-pointer shadow-md"
          >
            {loading ? "Signing in..." : "Sign In to Driver Workspace"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          Driver credentials are administered by CargoX Dispatch Operations. If you forgot your password, contact your fleet administrator.
        </p>

        <div className="mt-5 text-center flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowLoginForm(false)}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <ArrowLeft size={13} /> Back to Welcome Screen
          </button>
        </div>
      </div>
    </div>
  );
}
