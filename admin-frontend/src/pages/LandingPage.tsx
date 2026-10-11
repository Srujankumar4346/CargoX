import { Link } from "react-router-dom";
import { Truck, Shield, ArrowRight, ExternalLink, Package } from "lucide-react";
import { Show, UserButton, useAuth, useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import { api, setUserEmailGetter } from "../services/api";

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const [role, setRole] = useState<"ADMIN" | "DRIVER" | null>(null);

  const customerPortalUrl = import.meta.env.VITE_CUSTOMER_PORTAL_URL || "https://cargox-frontend.onrender.com";

  useEffect(() => {
    if (clerkUser?.primaryEmailAddress?.emailAddress) {
      setUserEmailGetter(() => clerkUser.primaryEmailAddress?.emailAddress);
    }
  }, [clerkUser]);

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
  }, [isLoaded, isSignedIn, clerkUser]);

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
            <div>
              <span className="text-2xl font-bold tracking-tight text-slate-100">CargoX</span>
              <span className="ml-2.5 text-[11px] font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full hidden sm:inline">
                Operations Suite
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={customerPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
            >
              <Package size={14} />
              <span>Customer Booking Portal</span>
              <ExternalLink size={12} />
            </a>

            <Show when="signed-in">
              <Link to={dashboardLink} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white">
                {normalizedRole === "DRIVER" ? "Driver Dashboard" : "Admin Dashboard"}
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Hero Section */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-300 mb-4">
            <Shield className="h-3.5 w-3.5" />
            CargoX Operations & Fleet Management Terminal
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-100 sm:text-5xl md:text-6xl">
            Command Center for Fleet & Freight Operations
          </h1>
          <p className="text-base text-slate-400 sm:text-lg">
            Dispatch trucks, track active freight in real time, oversee drivers, settle transport balances, and audit logistics with CargoX intelligence.
          </p>
        </div>

        {/* Primary Admin & Driver Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl mb-12">
          {/* PRIMARY: ADMIN PORTAL CARD */}
          <div className="flex flex-col bg-[#071425] border-2 border-blue-500/40 rounded-2xl p-8 text-left transition hover:border-blue-500 hover:shadow-[0_0_35px_rgba(59,130,246,0.2)] relative overflow-hidden group shadow-xl">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-36 w-36 rounded-full bg-blue-500/10 blur-3xl group-hover:bg-blue-500/20 transition"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/15">
                <Shield className="h-7 w-7 text-blue-400" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 rounded-full">
                Primary Terminal
              </span>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Admin Operations Portal</h2>
            <p className="text-slate-400 mb-6 flex-1 text-sm leading-relaxed">
              Full operational console: dispatch freight requests, track active trips, manage vehicle allocation, audit financial invoices, and configure team access.
            </p>
            <ul className="space-y-2 mb-8 text-sm text-slate-400 flex-1">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Dispatch Board & Fleet Allocation</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Real-time GPS Tracking & Trip Telemetry</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Financial Reporting & Settlement Reconciliation</li>
            </ul>

            <Link 
              to={isSignedIn ? "/admin" : "/admin/login"} 
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 w-full"
            >
              Sign In to Admin Portal
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          {/* SECONDARY: DRIVER PORTAL CARD (New Tab Navigation) */}
          <div className="flex flex-col bg-[#071425]/80 border border-slate-800 rounded-2xl p-8 text-left transition hover:border-slate-700 hover:shadow-[0_0_25px_rgba(30,41,59,0.5)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-slate-700/10 blur-3xl group-hover:bg-slate-700/20 transition"></div>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/60 mb-4">
              <Truck className="h-7 w-7 text-slate-300" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Driver Portal</h2>
            <p className="text-slate-400 mb-6 flex-1 text-sm leading-relaxed">
              Dedicated driver workspace for trip navigation, milestone updates, instant UPI QR payments, and proof of delivery (POD) capture.
            </p>
            <ul className="space-y-2 mb-8 text-sm text-slate-400 flex-1">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Assigned Deliveries & Navigation</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Cash & UPI Payment Collection</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Electronic Proof of Delivery (POD)</li>
            </ul>

            <Link 
              to={isSignedIn || localStorage.getItem("access_token") ? "/driver" : "/driver/login"} 
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-6 py-3.5 text-base font-semibold text-slate-200 transition hover:bg-slate-800 hover:border-blue-500/50 w-full"
            >
              Open Driver Portal
              <ExternalLink className="h-4 w-4 text-blue-400" />
            </Link>
          </div>
        </div>

        {/* Looking to book transport? Open Customer Portal */}
        <div className="w-full max-w-2xl bg-[#071425] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Looking to book transport?</p>
              <p className="text-xs text-slate-400">Request instant route quotations, track cargo, and download corporate invoices.</p>
            </div>
          </div>
          <a
            href={customerPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 shrink-0 shadow-lg shadow-amber-500/20"
          >
            Open Customer Portal
            <ExternalLink size={14} />
          </a>
        </div>
      </main>
    </div>
  );
}

