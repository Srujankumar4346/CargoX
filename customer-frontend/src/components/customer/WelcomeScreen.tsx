import { ArrowRight, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";
import { SignInButton, Show } from "@clerk/react";

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export default function WelcomeScreen({ onGetStarted, onLogin }: WelcomeScreenProps) {
  return (
    <div className="relative min-h-screen w-full bg-[#070d1e] text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Status Bar Placeholder / Brand Header */}
      <div className="pt-10 px-6 z-10 flex flex-col items-start animate-fade-in">
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-black tracking-tight text-white font-display">Cargo</span>
          <span className="text-3xl font-black tracking-tight text-[#1e60ff] font-display">X</span>
        </div>
        <p className="text-base text-slate-300 font-medium mt-1 leading-snug">
          Your Trusted<br />Logistics Partner
        </p>
      </div>

      {/* Center Hero Graphic: Hyderabad / Charminar & White Cargo Truck matching Screen 1 */}
      <div className="relative w-full flex-1 flex items-center justify-center my-1 overflow-hidden">
        <div className="relative w-full max-w-[380px] h-full max-h-[360px] flex items-center justify-center">
          <img
            src="/images/hero/welcome-hero.png"
            alt="CargoX Logistics Fleet"
            className="w-full h-full object-cover object-bottom"
          />
          {/* Subtle gradient vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070d1e] via-transparent to-[#070d1e]/40 pointer-events-none" />
        </div>
      </div>

      {/* Feature Badges: Safe, Reliable, Affordable */}
      <div className="px-6 z-10 flex items-center justify-around text-slate-300 text-xs font-semibold tracking-wide mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[#1e60ff]">✦</span>
          <span>Safe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#1e60ff]" />
          <span>Reliable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#1e60ff]" />
          <span>Affordable</span>
        </div>
      </div>

      {/* Pagination dots */}
      <div className="flex justify-center items-center gap-1.5 mb-5 z-10">
        <div className="w-6 h-1.5 bg-[#1e60ff] rounded-full" />
        <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
      </div>

      {/* Bottom Action Buttons */}
      <div className="px-6 pb-10 z-10 flex flex-col gap-3">
        <button
          onClick={onGetStarted}
          className="w-full bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
        >
          <span>Get Started</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <Show when="signed-out">
          <SignInButton mode="modal">
            <button
              onClick={onLogin}
              className="w-full bg-transparent hover:bg-white/5 active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-base border border-slate-700 transition-all text-center"
            >
              Login
            </button>
          </SignInButton>
        </Show>

        <Show when="signed-in">
          <button
            onClick={onGetStarted}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3.5 px-6 rounded-2xl font-bold text-base border border-slate-700 transition-all text-center flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Continue to Dashboard</span>
          </button>
        </Show>
      </div>
    </div>
  );
}
