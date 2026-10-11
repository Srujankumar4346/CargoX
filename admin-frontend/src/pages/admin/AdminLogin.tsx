import { SignIn } from "@clerk/react";
import { Shield, ExternalLink, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminLogin() {
  const customerPortalUrl = import.meta.env.VITE_CUSTOMER_PORTAL_URL || "http://localhost:5173";

  return (
    <div className="min-h-screen bg-[#020b1a] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center mb-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 mb-4 shadow-lg shadow-blue-500/10">
          <Shield className="h-8 w-8 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-100 tracking-tight mb-2">CargoX Operations</h1>
        <p className="text-slate-400 text-sm">Fleet Dispatch, Live Shipments & Operations Terminal</p>
      </div>

      <div className="bg-[#071425] p-2 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] border border-slate-800 w-full max-w-md flex flex-col items-center">
        <SignIn routing="hash" fallbackRedirectUrl="/admin" />

        {/* Separator and Alternate Portal Links */}
        <div className="w-full px-6 pb-6 pt-2 border-t border-slate-800/80 mt-2 space-y-4">
          {/* Driver Login Link (New Tab) */}
          <div className="text-center">
            <p className="text-xs text-slate-400">
              Are you a driver?{" "}
              <a
                href="/driver/login"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-blue-400 hover:text-blue-300 transition underline underline-offset-4"
              >
                Sign in to Driver Portal
                <ExternalLink size={12} className="inline-block" />
              </a>
            </p>
          </div>

          {/* Customer Portal Link (New Tab) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
            <p className="text-xs text-slate-400">
              Looking to book transport?{" "}
              <a
                href={customerPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-amber-400 hover:text-amber-300 transition"
              >
                Open Customer Portal
                <ExternalLink size={12} className="inline-block" />
              </a>
            </p>
          </div>

          <div className="text-center pt-1">
            <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition">
              <ArrowLeft size={12} /> Back to CargoX Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

