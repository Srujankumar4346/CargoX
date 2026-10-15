import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import MasterCustomerApp from "./components/customer/MasterCustomerApp";
import CustomerSettings from "./pages/customer/CustomerSettings";
import WelcomePreview from "./components/WelcomePreview";
import { setTokenGetter, setUserEmailGetter } from "./services/api";

function App() {
  const { getToken } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (getToken) setTokenGetter(getToken);
  }, [getToken]);

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      setUserEmailGetter(() => user.primaryEmailAddress?.emailAddress);
    }
  }, [user]);

  return (
    <Router>
      <Routes>
        {/* Root URL http://localhost:5173/ opens with the 5-second Welcome preview, then transitions to /customer */}
        <Route path="/" element={<WelcomePreview />} />
        <Route path="/welcome" element={<WelcomePreview />} />
        <Route path="/login" element={<MasterCustomerApp />} />
        <Route path="/register" element={<MasterCustomerApp />} />
        <Route path="/customer" element={<MasterCustomerApp />} />
        <Route path="/customer/settings" element={<CustomerSettings />} />
        {/* Direct preview route */}
        <Route path="/preview-welcome" element={<WelcomePreview />} />
        {/* If user navigates to /admin on customer-frontend, redirect or route cleanly */}
        <Route path="/admin" element={
          <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-2xl font-bold mb-2">CargoX Admin Operations</h1>
            <p className="text-sm text-slate-400 mb-6 max-w-md">
              The Admin Operations portal runs on port <strong>5174</strong>.
            </p>
            <a 
              href="http://localhost:5174/admin" 
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl transition shadow-lg"
            >
              Open Admin Portal (Port 5174)
            </a>
            <a 
              href="/customer" 
              className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline"
            >
              Return to Customer Dashboard
            </a>
          </div>
        } />
        {/* Catch-all fallback */}
        <Route path="*" element={
          <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
            <p className="text-sm text-slate-400 mb-6">The requested path does not exist on the Customer Portal.</p>
            <a href="/customer" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl transition">
              Go to Customer Dashboard
            </a>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;


