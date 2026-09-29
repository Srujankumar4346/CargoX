import { Link } from "react-router-dom";
import { Truck, Shield, ArrowRight } from "lucide-react";
import { Show, UserButton, useAuth } from "@clerk/react";
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

  const normalizedRole = role ? role.toUpperCase() : null;
  const dashboardLink = normalizedRole === "DRIVER" ? "/driver" : "/admin";

  return (
    <div className="min-h-screen bg-[#020b1a] text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-[#071425] shadow-[0_8px_20px_rgba(15,23,42,0.35)] sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10">
              <Truck className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-100">CargoX</span>
          </div>
          <div className="flex items-center gap-4">
            <Show when="signed-in">
              <Link to={dashboardLink} className="mr-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white">
                {normalizedRole === "DRIVER" ? "Driver Dashboard" : "Admin Dashboard"}
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="max-w-3xl mb-16">
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-slate-100 sm:text-6xl md:text-7xl">
            Move Goods. Manage Everything.
          </h1>
          <p className="text-lg text-slate-400 sm:text-xl">
            CargoX makes goods transportation simple with smart booking, fleet management, real-time tracking, and intelligent logistics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
          {/* DRIVER PORTAL CARD */}
          <div className="flex flex-col bg-[#071425] border border-slate-800 rounded-2xl p-8 text-left transition hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-blue-500/5 blur-3xl group-hover:bg-blue-500/10 transition"></div>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 mb-6">
              <Truck className="h-7 w-7 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-100 mb-3">Driver Portal</h2>
            <p className="text-slate-400 mb-8 flex-1">
              Access your assigned deliveries, navigation, tracking, payment information, and delivery updates.
            </p>
            <ul className="space-y-2 mb-8 text-sm text-slate-500 flex-1">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" /> Assigned trips</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" /> Tracking & Navigation</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" /> Payments & POD</li>
            </ul>
            <Link 
              to={isSignedIn || localStorage.getItem("access_token") ? "/driver" : "/driver/login"} 
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 w-full"
            >
              Enter Driver Portal
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          {/* ADMIN PORTAL CARD */}
          <div className="flex flex-col bg-[#071425] border border-slate-800 rounded-2xl p-8 text-left transition hover:border-indigo-500/50 hover:shadow-[0_0_30px_rgba(99,102,241,0.1)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/10 transition"></div>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 mb-6">
              <Shield className="h-7 w-7 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-100 mb-3">Admin Portal</h2>
            <p className="text-slate-400 mb-8 flex-1">
              Manage customers, bookings, dispatch, fleet, drivers, payments, analytics, and CargoX operations.
            </p>
            <ul className="space-y-2 mb-8 text-sm text-slate-500 flex-1">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" /> Full management</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" /> Customers & Fleet</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" /> Dispatch & Finance</li>
            </ul>
            <Link 
              to={isSignedIn ? "/admin" : "/admin/login"} 
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-slate-900/50 px-6 py-3.5 text-base font-semibold text-indigo-300 transition hover:bg-slate-800 hover:text-indigo-200 hover:border-indigo-500/50 w-full"
            >
              Enter Admin Portal
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
