import React from 'react';
import { ArrowRight, LogIn } from 'lucide-react';
import CargoExpressLogo from '../components/CargoExpressLogo';

interface DriverWelcomeScreenProps {
  onContinue: () => void;
  onOpenLoginModal?: () => void;
  isAuthenticated?: boolean;
}

export const DriverWelcomeScreen: React.FC<DriverWelcomeScreenProps> = ({
  onContinue,
  onOpenLoginModal,
  isAuthenticated = false,
}) => {
  return (
    <div className="relative min-h-screen w-full bg-[#F8FAFC] flex flex-col justify-between overflow-hidden select-none">
      {/* Brand Header */}
      <div className="w-full flex flex-col items-center justify-center pt-10 pb-4 px-6 z-10 text-center">
        <CargoExpressLogo variant="full" size="xl" showTagline={true} theme="light" />
      </div>

      {/* Hero Visual Container */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 w-full max-w-lg mx-auto z-10">
        <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 bg-white">
          <img
            src="/images/hero/welcome-charminar-truck.png"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/images/hero/welcome-hero-hd.png';
            }}
            alt="CargoExpress Fleet Delivery"
            className="w-full h-72 sm:h-84 object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-5">
            <div>
              <p className="text-white text-xs font-semibold uppercase tracking-wider text-emerald-400">Driver Operations</p>
              <h2 className="text-white font-bold text-lg sm:text-xl">Safe & On-Time Fleet Deliveries</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="relative z-20 w-full max-w-sm mx-auto px-6 pb-10 pt-2 flex flex-col gap-3">
        <button
          onClick={onContinue}
          type="button"
          className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-black active:scale-[0.98] text-white font-bold text-base shadow-xl flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <span>Continue as Driver</span>
          <ArrowRight size={18} className="stroke-[2.5]" />
        </button>

        {!isAuthenticated && onOpenLoginModal && (
          <button
            onClick={onOpenLoginModal}
            type="button"
            className="w-full py-2.5 text-center text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <LogIn size={14} />
            <span>Sign In with ID or Username</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DriverWelcomeScreen;
