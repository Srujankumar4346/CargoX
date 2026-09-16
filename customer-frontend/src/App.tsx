import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import DriverDashboard from "./pages/driver/DriverDashboard";

function App() {
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
        <Route path="/driver" element={<DriverDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;

