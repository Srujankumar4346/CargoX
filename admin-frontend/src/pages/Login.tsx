import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Truck } from "lucide-react";
import { api } from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@cargox.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(email, password);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      
      // Decode JWT to find role
      const payload = JSON.parse(atob(data.access_token.split('.')[1]));
      const role = payload.role?.toLowerCase() || 'customer';
      
      if (role === 'admin') navigate('/admin');
      else if (role === 'driver') navigate('/driver');
      else navigate('/customer');
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Truck className="h-12 w-12 text-blue-600 mx-auto" />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Email address (or Phone)</label>
              <div className="mt-1">
                <input 
                  type="text" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1">
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                />
              </div>
            </div>

            <div>
               <button 
                 type="submit" 
                 disabled={loading}
                 className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
               >
                 {loading ? "Signing in..." : "Sign In"}
               </button>
            </div>
            
            <div className="text-xs text-gray-500 text-center mt-4">
               Demo accounts: admin@cargox.com | customer1@cargox.com | +919876543210 (Driver)<br/>
               Password: password
            </div>
          </form>
          <div className="mt-6 text-center">
            <Link to="/register" className="text-sm text-blue-600 hover:text-blue-500">Don't have an account? Register</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
