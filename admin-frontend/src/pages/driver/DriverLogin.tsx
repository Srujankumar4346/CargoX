import { SignIn } from "@clerk/react";
import { Truck } from "lucide-react";

export default function DriverLogin() {
  return (
    <div className="min-h-screen bg-[#020b1a] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center mb-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 mb-6">
          <Truck className="h-8 w-8 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Driver Portal</h1>
        <p className="text-slate-400">Sign in to access your assigned deliveries and delivery tools.</p>
      </div>
      <div className="bg-[#071425] p-2 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-slate-800">
        <SignIn routing="hash" fallbackRedirectUrl="/driver" />
      </div>
    </div>
  );
}
