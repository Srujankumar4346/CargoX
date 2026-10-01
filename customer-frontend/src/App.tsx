import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import LandingPage from "./pages/LandingPage";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import CustomerSettings from "./pages/customer/CustomerSettings";
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

  // Enforce dark mode by default unless user has saved 'light'
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LandingPage />} />
        <Route path="/register" element={<LandingPage />} />
        <Route path="/customer" element={<CustomerDashboard />} />
        <Route path="/customer/settings" element={<CustomerSettings />} />
      </Routes>
    </Router>
  );
}

export default App;


