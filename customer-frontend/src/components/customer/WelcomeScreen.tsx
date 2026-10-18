import { ArrowRight, ShieldCheck, Clock } from "lucide-react";
import CargoExpressLogo from "../common/CargoExpressLogo";

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export default function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <div className="relative min-h-full flex-1 bg-gradient-to-b from-sky-50 via-white to-blue-50/40 text-slate-900 flex flex-col justify-between p-6 select-none overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-20 -left-20 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header / Branding */}
      <div className="relative z-10 pt-4 flex flex-col items-center text-center">
        <CargoExpressLogo variant="full" size="lg" showTagline={true} />
      </div>

      {/* Hero Indian Transport Goods Truck Illustration matching Reference Screen 1 */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center py-4">
        <div className="relative w-full max-w-[340px] flex items-center justify-center">
          <img
            src="/images/hero/customer-home-screen-full.png"
            alt="CargoExpress Commercial Freight Fleet"
            className="w-full max-h-56 object-contain drop-shadow-xl"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/vehicles/screen6_full.png";
            }}
          />
        </div>

        {/* Feature Badges */}
        <div className="flex items-center justify-center gap-4 mt-6 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-full border border-slate-200/60 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verified Fleet</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-full border border-slate-200/60 shadow-2xs">
            <Clock className="w-4 h-4 text-[#0866F5]" />
            <span>Instant Dispatch</span>
          </div>
        </div>
      </div>

      {/* Bottom CTA Area matching Screen 1 */}
      <div className="relative z-10 space-y-3 pb-4">
        <button
          onClick={onGetStarted}
          className="w-full bg-[#0866F5] hover:bg-[#0652c5] active:scale-[0.98] text-white py-4 px-6 rounded-2xl font-extrabold text-base flex items-center justify-center gap-3 shadow-lg shadow-blue-500/25 transition-all"
        >
          <span>Get Started</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        <p className="text-center text-xs text-slate-500 font-medium">
          India's trusted logistics partner for your business and personal cargo
        </p>
      </div>
    </div>
  );
}
