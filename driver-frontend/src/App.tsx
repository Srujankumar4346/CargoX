import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import { useAuth, useUser, useClerk } from "@clerk/react";
import DriverWorkspace from "./pages/DriverWorkspace";
import DriverLogin from "./pages/DriverLogin";
import { api, setTokenGetter, setUserEmailGetter } from "./services/api";

function RoleGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [role, setRole] = useState<"ADMIN" | "DRIVER" | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (getToken) {
      setTokenGetter(getToken);
    }
  }, [getToken]);

  useEffect(() => {
    if (clerkUser?.primaryEmailAddress?.emailAddress) {
      setUserEmailGetter(() => clerkUser.primaryEmailAddress?.emailAddress);
    }
  }, [clerkUser]);

  const checkRole = () => {
    setLoading(true);
    setFetchError(null);
    api.getCurrentUserProfile()
      .then((user) => {
        setRole(user.role);
      })
      .catch((err) => {
        setRole(null);
        setFetchError(err?.message || "Failed to connect to backend");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isLoaded) return;
    const hasLocalToken = !!localStorage.getItem("access_token");
    if (!isSignedIn && !hasLocalToken) {
      setRole(null);
      setLoading(false);
      return;
    }

    checkRole();
  }, [isLoaded, isSignedIn, clerkUser]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#020b1a] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400">Loading driver workspace…</span>
        </div>
      </div>
    );
  }

  const hasLocalToken = !!localStorage.getItem("access_token");
  if (!isSignedIn && !hasLocalToken) {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = role ? role.toUpperCase() : null;

  if (normalizedRole !== "DRIVER") {
    const signedInEmail = clerkUser?.primaryEmailAddress?.emailAddress || "your account";
    return (
      <div className="min-h-screen bg-[#020b1a] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-[#071425] border border-slate-800 rounded-2xl max-w-md w-full p-8 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-5 text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">
            {fetchError ? "Backend Connection Error" : "Driver Access Required"}
          </h2>
          <p className="text-slate-300 text-sm font-medium mb-1">
            Signed in as: <span className="text-blue-400 font-semibold">{signedInEmail}</span>
          </p>
          <p className="text-slate-400 text-xs leading-relaxed mb-6">
            {fetchError ? (
              <span>Could not connect to CargoX backend API. Please verify server connectivity and retry.</span>
            ) : (
              <span>This account does not currently have <span className="font-semibold text-slate-300">DRIVER</span> privileges. If an administrator recently provisioned your driver account, please click Refresh.</span>
            )}
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => checkRole()}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
            >
              {fetchError ? "Retry Connection" : "Refresh Status"}
            </button>
            <button
              onClick={async () => {
                localStorage.removeItem("access_token");
                if (isSignedIn) {
                  await signOut();
                }
                window.location.href = "/login";
              }}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold border border-slate-700 transition cursor-pointer"
            >
              Sign Out & Switch Account
            </button>
            <Link
              to="/login"
              className="text-xs text-slate-500 hover:text-slate-300 mt-2 transition"
            >
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();

  useEffect(() => {
    if (getToken) {
      setTokenGetter(getToken);
    }
  }, [getToken]);

  useEffect(() => {
    if (clerkUser?.primaryEmailAddress?.emailAddress) {
      setUserEmailGetter(() => clerkUser.primaryEmailAddress?.emailAddress);
    }
  }, [clerkUser]);

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
        <Route path="/login" element={<DriverLogin />} />
        <Route path="/" element={<RoleGate><DriverWorkspace /></RoleGate>} />
        {/* Support legacy /driver route gracefully */}
        <Route path="/driver" element={<Navigate to="/" replace />} />
        <Route path="/driver/login" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
