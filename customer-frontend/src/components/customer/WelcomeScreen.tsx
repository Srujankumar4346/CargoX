import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  MapPin, 
  BadgePercent, 
  Truck, 
  Sparkles 
} from "lucide-react";
import { SignInButton, Show } from "@clerk/react";

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

interface SlideData {
  id: number;
  tagline: string;
  headlineFirst: string;
  headlineAccent: string;
  subtext: string;
  image: string;
  imageAlt: string;
  feature1: { icon: any; title: string; desc: string };
  feature2: { icon: any; title: string; desc: string };
  feature3: { icon: any; title: string; desc: string };
}

const ONBOARDING_SLIDES: SlideData[] = [
  {
    id: 0,
    tagline: "Your Trusted Logistics Partner",
    headlineFirst: "Move Your Business",
    headlineAccent: "Forward",
    subtext: "Safe, Reliable, Affordable Logistics Solutions Across India",
    image: "/images/hero/welcome-charminar-truck.png",
    imageAlt: "CargoX Fleet in Hyderabad with Charminar",
    feature1: { icon: Sparkles, title: "Safe", desc: "Your cargo our priority" },
    feature2: { icon: ShieldCheck, title: "Reliable", desc: "On time every time" },
    feature3: { icon: Clock, title: "Affordable", desc: "Best rates for business" }
  },
  {
    id: 1,
    tagline: "Precision GPS Tracking",
    headlineFirst: "Track Shipments",
    headlineAccent: "In Real-Time",
    subtext: "Live milestone notifications, verified driver details & instant ETA tracking",
    image: "/images/hero/welcome-hero.png",
    imageAlt: "CargoX Intercity Commercial Logistics Fleet",
    feature1: { icon: MapPin, title: "Live GPS", desc: "Real-time satellite updates" },
    feature2: { icon: ShieldCheck, title: "Verified", desc: "KYC cleared drivers" },
    feature3: { icon: Clock, title: "24/7 ETA", desc: "Precise arrival times" }
  },
  {
    id: 2,
    tagline: "Instant Transparent Pricing",
    headlineFirst: "Transparent Pricing",
    headlineAccent: "Zero Surprises",
    subtext: "Instant automated distance calculation, capacity validation & digital GST invoices",
    image: "/images/vehicles/mahindra-bolero-pikup.png",
    imageAlt: "Mahindra Bolero Pik-Up Goods Carrier",
    feature1: { icon: BadgePercent, title: "Upfront", desc: "Guaranteed locked quotes" },
    feature2: { icon: Truck, title: "Any Cargo", desc: "From 1 to 20+ tons" },
    feature3: { icon: CheckCircle2, title: "GST Ready", desc: "Instant automated bills" }
  }
];

export default function WelcomeScreen({ onGetStarted, onLogin }: WelcomeScreenProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  // Remember onboarding completion flag
  const handleComplete = (action: "get-started" | "login") => {
    try {
      localStorage.setItem("cargox_onboarding_completed", "true");
    } catch {
      // ignore localstorage errors
    }
    if (action === "get-started") {
      onGetStarted();
    } else {
      onLogin();
    }
  };

  const currentSlide = ONBOARDING_SLIDES[currentSlideIndex];

  const handleNextSlide = () => {
    if (currentSlideIndex < ONBOARDING_SLIDES.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
    } else {
      handleComplete("get-started");
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#070d1e] text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[400px] h-60 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Top Header: Logo + Skip Action */}
      <motion.header 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="pt-7 px-6 z-20 flex items-center justify-between"
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-3xl font-black tracking-tight text-white font-display">Cargo</span>
            <span className="text-3xl font-black tracking-tight text-[#1e60ff] font-display">X</span>
          </div>
          <motion.p 
            key={currentSlide.tagline}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-xs text-slate-400 font-medium mt-0.5"
          >
            {currentSlide.tagline}
          </motion.p>
        </div>

        {/* Skip button for quick flow entry */}
        <button
          onClick={() => handleComplete("get-started")}
          className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
        >
          Skip
        </button>
      </motion.header>

      {/* Main Slide Content Area */}
      <div className="relative z-10 flex-1 flex flex-col justify-between px-6 pt-3 pb-2">
        {/* Animated Headlines */}
        <div className="mt-2 min-h-[92px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <h1 className="text-[28px] font-black tracking-tight leading-[1.15] font-display text-white">
                {currentSlide.headlineFirst}{" "}
                <span className="text-[#1e60ff]">{currentSlide.headlineAccent}</span>
              </h1>
              <p className="text-xs text-slate-300 font-normal mt-2 leading-relaxed max-w-[95%]">
                {currentSlide.subtext}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Center Hero Visual with subtle parallax motion */}
        <div className="relative w-full flex-1 flex items-center justify-center my-2 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id}
              initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.03 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative w-full max-w-[360px] h-[260px] flex items-center justify-center rounded-2xl overflow-hidden"
            >
              <motion.img
                src={currentSlide.image}
                alt={currentSlide.imageAlt}
                className="w-full h-full object-cover object-center"
                animate={prefersReducedMotion ? {} : { y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              />
              {/* Cinematic Vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#070d1e] via-transparent to-[#070d1e]/30 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#070d1e] to-transparent pointer-events-none" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 3 Benefit Feature Badges matching Reference Design */}
        <div className="w-full mb-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="grid grid-cols-3 gap-2"
            >
              {/* Feature 1 */}
              <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-1 text-[#1e60ff]">
                  <currentSlide.feature1.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white">{currentSlide.feature1.title}</span>
                <span className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">{currentSlide.feature1.desc}</span>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-1 text-[#1e60ff]">
                  <currentSlide.feature2.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white">{currentSlide.feature2.title}</span>
                <span className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">{currentSlide.feature2.desc}</span>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-1 text-[#1e60ff]">
                  <currentSlide.feature3.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white">{currentSlide.feature3.title}</span>
                <span className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">{currentSlide.feature3.desc}</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Animated Pagination Indicators */}
        <div className="flex justify-center items-center gap-2 mb-4">
          {ONBOARDING_SLIDES.map((slide, index) => {
            const isActive = index === currentSlideIndex;
            return (
              <button
                key={slide.id}
                onClick={() => setCurrentSlideIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
                className="p-1 focus:outline-none"
              >
                <motion.div
                  animate={{
                    width: isActive ? 24 : 6,
                    backgroundColor: isActive ? "#1e60ff" : "#334155"
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-1.5 rounded-full"
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA Actions */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="px-6 pb-8 z-20 flex flex-col gap-3"
      >
        <button
          onClick={handleNextSlide}
          className="w-full bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
        >
          <span>{currentSlideIndex === ONBOARDING_SLIDES.length - 1 ? "Get Started" : "Continue"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <Show when="signed-out">
          <SignInButton mode="modal">
            <button
              onClick={() => handleComplete("login")}
              className="w-full bg-transparent hover:bg-white/5 active:scale-[0.98] text-white py-3 px-6 rounded-2xl font-bold text-sm border border-slate-700/80 transition-all text-center"
            >
              Login
            </button>
          </SignInButton>
        </Show>

        <Show when="signed-in">
          <button
            onClick={() => handleComplete("get-started")}
            className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 py-3 px-6 rounded-2xl font-bold text-sm border border-slate-700 transition-all text-center flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Continue to Dashboard</span>
          </button>
        </Show>
      </motion.div>
    </div>
  );
}
