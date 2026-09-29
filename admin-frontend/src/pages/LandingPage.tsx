import { Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { Show, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [role, setRole] = useState<"ADMIN" | "DRIVER" | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setRole(null);
      return;
    }

    let mounted = true;
    api.getCurrentUserProfile()
      .then((user) => {
        if (mounted) setRole(user.role);
      })
      .catch(() => {
        if (mounted) setRole(null);
      });

    return () => {
      mounted = false;
    };
  }, [isLoaded, isSignedIn]);

  const dashboardLink = role === "DRIVER" ? "/driver" : "/admin";
  const dashboardLabel = role === "DRIVER" ? "Go to Driver Dashboard" : "Go to Admin Dashboard";

  return (
    <div className="min-h-screen bg-[#020b1a] text-slate-100">
      <header className="border-b border-slate-800 bg-[#071425] shadow-[0_8px_20px_rgba(15,23,42,0.35)] sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10">
              <Truck className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-100">CargoX</span>
          </div>
          <div className="flex items-center gap-4">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white">Login</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500">Register</button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link to={dashboardLink} className="mr-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white">
                {role === "DRIVER" ? "Driver Dashboard" : "Dashboard"}
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <h1 className="mb-6 text-5xl font-bold tracking-[-0.06em] text-slate-100 sm:text-6xl md:text-7xl">
          Move Goods. Manage Everything.
        </h1>
        <p className="mx-auto mb-10 max-w-3xl text-lg text-slate-400 sm:text-xl">
          CargoX makes goods transportation simple with smart booking, fleet management, real-time tracking, and intelligent logistics.
        </p>
        <div className="flex justify-center">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="rounded-xl border border-blue-500/60 bg-slate-950/40 px-8 py-3 text-lg font-bold text-blue-400 shadow-[0_0_0_1px_rgba(59,130,246,0.2)] transition hover:border-blue-400 hover:bg-slate-900/80 hover:text-blue-300">
                Admin Login
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link to={dashboardLink} className="rounded-xl border border-blue-500/60 bg-slate-950/40 px-8 py-3 text-lg font-bold text-blue-400 shadow-[0_0_0_1px_rgba(59,130,246,0.2)] transition hover:border-blue-400 hover:bg-slate-900/80 hover:text-blue-300">
              {dashboardLabel}
            </Link>
          </Show>
        </div>
      </main>
    </div>
  );
}
