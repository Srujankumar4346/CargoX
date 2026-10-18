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
    <div className="relative min-h-screen w-full bg-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Status Bar Placeholder (iOS/Android mobile safe padding) */}
      <div className="w-full flex justify-between items-center px-6 pt-3 text-xs font-semibold text-slate-800 z-20">
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">5G</span>
          <div className="w-5 h-2.5 border border-slate-700 rounded-xs p-0.5 flex items-center">
            <div className="h-full w-full bg-slate-800 rounded-2xs"></div>
          </div>
        </div>
      </div>

      {/* Upper-Middle Brand Section */}
      <div className="flex-1 flex flex-col items-center justify-center pt-8 pb-4 px-6 z-10 text-center">
        <CargoExpressLogo variant="full" size="xl" showTagline={true} theme="light" />
      </div>

      {/* Lower Portion: Realistic Transport Scene with Road & Sky Gradient */}
      <div className="relative w-full h-[52vh] min-h-[380px] flex flex-col justify-end">
        {/* Sky gradient background */}
        <div className="absolute inset-0 bg-gradient-to-t from-sky-100/80 via-sky-50/50 to-white pointer-events-none" />

        {/* City skyline and road background illustration / image */}
        <div className="absolute inset-x-0 bottom-0 h-full overflow-hidden flex items-end justify-center pointer-events-none">
          <img
            src="/images/hero/welcome-hero-hd.png"
            onError={(e) => {
              // Fallback to customer hero or high quality truck preview if needed
              (e.currentTarget as HTMLImageElement).src = '/images/hero/welcome-hero.png';
            }}
            alt="CargoExpress Commercial Fleet Truck"
            className="w-full max-w-lg object-contain object-bottom drop-shadow-2xl translate-y-4"
          />
        </div>

        {/* Bottom Action Area */}
        <div className="relative z-20 w-full max-w-md mx-auto px-6 pb-10 pt-4 flex flex-col gap-3">
          <button
            onClick={onContinue}
            type="button"
            className="w-full py-4 px-6 rounded-full bg-[#0F172A] hover:bg-black active:scale-[0.98] text-white font-bold text-base shadow-xl flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>Continue as Driver</span>
            <ArrowRight size={18} className="stroke-[2.5]" />
          </button>

          {!isAuthenticated && onOpenLoginModal && (
            <button
              onClick={onOpenLoginModal}
              type="button"
              className="w-full py-2.5 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <LogIn size={13} />
              <span>Sign in with password or Clerk</span>
            </button>
          )}

          {/* iOS Bottom Indicator Bar */}
          <div className="w-32 h-1 bg-slate-300 rounded-full mx-auto mt-2" />
        </div>
      </div>
    </div>
  );
};

export default DriverWelcomeScreen;
