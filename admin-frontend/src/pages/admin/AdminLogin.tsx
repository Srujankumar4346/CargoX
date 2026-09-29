import { SignIn } from "@clerk/react";
import { Shield } from "lucide-react";

export default function AdminLogin() {
  return (
    <div className="min-h-screen bg-[#020b1a] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center mb-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 mb-6">
          <Shield className="h-8 w-8 text-indigo-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Admin Portal</h1>
        <p className="text-slate-400">Sign in to manage CargoX operations.</p>
      </div>
      <div className="bg-[#071425] p-2 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-slate-800">
        <SignIn routing="hash" fallbackRedirectUrl="/admin" />
      </div>
    </div>
  );
}
