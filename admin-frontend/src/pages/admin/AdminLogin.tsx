import { SignIn } from "@clerk/react";
import { Shield, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminLogin() {
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

        <div className="w-full px-6 pb-4 pt-2 border-t border-slate-800/80 mt-2 text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition">
            <ArrowLeft size={13} /> Back to CargoX Admin Home
          </Link>
        </div>
      </div>
    </div>
  );
}
