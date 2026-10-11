import { Link } from "react-router-dom";
import { Shield, ArrowRight } from "lucide-react";
import { Show, UserButton, useAuth, useUser } from "@clerk/react";
import { useEffect } from "react";
import { setUserEmailGetter } from "../services/api";

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();

  useEffect(() => {
    if (clerkUser?.primaryEmailAddress?.emailAddress) {
      setUserEmailGetter(() => clerkUser.primaryEmailAddress?.emailAddress);
    }
  }, [clerkUser]);

  return (
    <div className="min-h-screen bg-[#020b1a] text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-[#071425] shadow-[0_8px_20px_rgba(15,23,42,0.35)] sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10">
              <Shield className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight text-slate-100">CargoX</span>
              <span className="ml-2.5 text-[11px] font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full hidden sm:inline">
                Admin Operations Suite
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Show when="signed-in">
              <Link to="/admin" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white">
                Admin Dashboard
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        {/* Hero Section */}
        <div className="max-w-3xl mb-10">
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

        {/* Dedicated Admin Portal Card */}
        <div className="w-full max-w-xl">
          <div className="flex flex-col bg-[#071425] border-2 border-blue-500/40 rounded-2xl p-8 sm:p-10 text-left transition hover:border-blue-500 hover:shadow-[0_0_35px_rgba(59,130,246,0.2)] relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl group-hover:bg-blue-500/20 transition"></div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/15">
                <Shield className="h-7 w-7 text-blue-400" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/15 border border-blue-500/30 px-3 py-1 rounded-full">
                Admin Terminal
              </span>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Admin Operations Portal</h2>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              Full operational console: dispatch freight requests, track active trips, manage vehicle allocation, audit financial invoices, and configure team access.
            </p>
            <ul className="space-y-3 mb-8 text-sm text-slate-300">
              <li className="flex items-center gap-2.5"><div className="w-2 h-2 rounded-full bg-blue-400" /> Dispatch Board & Fleet Allocation</li>
              <li className="flex items-center gap-2.5"><div className="w-2 h-2 rounded-full bg-blue-400" /> Real-time GPS Tracking & Trip Telemetry</li>
              <li className="flex items-center gap-2.5"><div className="w-2 h-2 rounded-full bg-blue-400" /> Financial Reporting & Settlement Reconciliation</li>
            </ul>

            <Link 
              to={isSignedIn ? "/admin" : "/admin/login"} 
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 w-full"
            >
              Sign In to Admin Portal
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
