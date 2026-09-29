import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import LandingPage from "./pages/LandingPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import DriverWorkspace from "./pages/driver/DriverWorkspace";
import { api } from "./services/api";

function RoleGate({ allowedRole, children }: { allowedRole: "ADMIN" | "DRIVER"; children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [role, setRole] = useState<"ADMIN" | "DRIVER" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (!isLoaded) return;
    if (!isSignedIn) {
      setRole(null);
      setLoading(false);
      return;
    }

    api.getCurrentUserProfile()
      .then((user) => {
        if (mounted) setRole(user.role);
      })
      .catch(() => {
        if (mounted) setRole(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading workspace…</div>;
  }

  if (!isSignedIn) {
    return <LandingPage />;
  }

  if (role !== allowedRole) {
    if (role === "ADMIN") {
      return <Navigate to="/admin" replace />;
    }
    if (role === "DRIVER") {
      return <Navigate to="/driver" replace />;
    }
    return <LandingPage />;
  }

  return <>{children}</>;
}

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
        <Route path="/admin" element={<RoleGate allowedRole="ADMIN"><AdminDashboard /></RoleGate>} />
        <Route path="/driver" element={<RoleGate allowedRole="DRIVER"><DriverWorkspace /></RoleGate>} />
      </Routes>
    </Router>
  );
}

export default App;

