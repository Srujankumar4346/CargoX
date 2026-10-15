import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const ONBOARDING_SLIDES = [
  {
    id: 0,
    tagline: "Your Trusted Logistics Partner",
    headlineFirst: "Move Your Business",
    headlineAccent: "Forward",
    subtext: "Safe, Reliable, Affordable Logistics Solutions Across India",
    image: "/images/hero/welcome-charminar-truck.png",
    imageAlt: "CargoX Fleet in Hyderabad with Charminar",
    features: [
      { icon: Sparkles,   title: "Safe",       desc: "Your cargo our priority" },
      { icon: ShieldCheck, title: "Reliable",   desc: "On time every time" },
      { icon: Clock,       title: "Affordable", desc: "Best rates for business" },
    ],
  },
  {
    id: 1,
    tagline: "Precision GPS Tracking",
    headlineFirst: "Track Shipments",
    headlineAccent: "In Real-Time",
    subtext: "Live milestone notifications, verified driver details & instant ETA tracking",
    image: "/images/hero/onboarding_gps_tracking.jpg",
    imageAlt: "Live Satellite & GPS Route Tracking across India",
    features: [
      { icon: MapPin,      title: "Live GPS",  desc: "Real-time satellite updates" },
      { icon: ShieldCheck, title: "Verified",  desc: "KYC cleared drivers" },
      { icon: Clock,       title: "24/7 ETA",  desc: "Precise arrival times" },
    ],
  },
  {
    id: 2,
    tagline: "Instant Transparent Pricing",
    headlineFirst: "Transparent Pricing",
    headlineAccent: "Zero Surprises",
    subtext: "Instant automated distance calculation & digital GST invoices",
    image: "/images/hero/onboarding_pricing_calc.jpg",
    imageAlt: "Instant locked quotation with automated GST invoice",
    features: [
      { icon: BadgePercent, title: "Upfront",    desc: "Guaranteed locked quotes" },
      { icon: Truck,        title: "Any Cargo",  desc: "From 1 to 20+ tons" },
      { icon: CheckCircle2, title: "GST Ready",  desc: "Instant automated bills" },
    ],
  },
];

// Duration each slide is shown during the auto-intro (ms) ~ 1.7s x 3 = 5.1s total intro
const SLIDE_DURATION_MS = 1700;
// Total slides × duration = 4.8 s intro, then stops on last slide with CTA
const TOTAL_SLIDES = ONBOARDING_SLIDES.length;

export default function WelcomeScreen({ onGetStarted, onLogin }: WelcomeScreenProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(true);  // true = intro cycle, false = user in control
  const [imgError, setImgError] = useState<Record<number, boolean>>({});
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Lock dark background so body #f1f5f9 never bleeds through ──
  useEffect(() => {
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = "#070d1e";
    document.documentElement.style.backgroundColor = "#070d1e";
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, []);

  // ── Preload all slide images so they appear instantly when slide changes ──
  useEffect(() => {
    ONBOARDING_SLIDES.forEach((slide) => {
      const img = new Image();
      img.src = slide.image;
    });
  }, []);

  // ── Auto-cycling intro: advance slide every SLIDE_DURATION_MS ──
  useEffect(() => {
    if (!autoPlaying) return;

    autoTimerRef.current = setTimeout(() => {
      setSlideIndex((prev) => {
        const next = prev + 1;
        if (next >= TOTAL_SLIDES) {
          setAutoPlaying(false);   // intro done
          // Automatically transition to customer portal after the 5s intro completes
          handleComplete("get-started");
          return prev;
        }
        return next;
      });
    }, SLIDE_DURATION_MS);

    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [slideIndex, autoPlaying]);

  // ── Completion handlers ──
  const handleComplete = (action: "get-started" | "login") => {
    try { localStorage.setItem("cargox_onboarding_completed", "true"); } catch {}
    if (action === "get-started") onGetStarted();
    else onLogin();
  };

  const handleDotClick = (index: number) => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setAutoPlaying(false);
    setSlideIndex(index);
  };

  const handleContinue = () => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setAutoPlaying(false);
    if (slideIndex < TOTAL_SLIDES - 1) {
      setSlideIndex((prev) => prev + 1);
    } else {
      handleComplete("get-started");
    }
  };

  const currentSlide = ONBOARDING_SLIDES[slideIndex];

  return (
    <div
      style={{ backgroundColor: "#070d1e" }}
      className="fixed inset-0 flex justify-center items-center overflow-hidden select-none"
    >
      {/* Mobile Frame Container: 430px max width on desktop with rounded edges, full-bleed on mobile */}
      <div className="relative w-full max-w-[430px] h-full flex flex-col overflow-hidden md:max-h-[880px] md:rounded-3xl md:border md:border-slate-800 md:shadow-2xl bg-[#070d1e]">
      {/* ── Ambient gradient glow blobs ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0 }}
          className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 2.0, delay: 0.4 }}
          className="absolute top-1/3 -right-28 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 2.5, delay: 0.8 }}
          className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[380px] h-52 bg-blue-500/15 rounded-full blur-3xl"
        />
      </div>

      {/* ── Scrollable content ── */}
      <div className="relative z-10 flex flex-col h-full overflow-y-auto overflow-x-hidden">

        {/* ── HEADER: Logo + Skip ── */}
        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as any }}
          className="flex items-center justify-between px-6 pt-[max(env(safe-area-inset-top),20px)] pb-2 flex-shrink-0"
        >
          <div className="flex flex-col">
            <div className="flex items-baseline gap-0.5">
              <span className="text-3xl font-black tracking-tight text-white font-display">Cargo</span>
              <span className="text-3xl font-black tracking-tight text-[#1e60ff] font-display">X</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={currentSlide.tagline}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="text-[11px] text-slate-400 font-medium mt-0.5"
              >
                {currentSlide.tagline}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Skip — always tappable, no delay */}
          <button
            onClick={() => handleComplete("get-started")}
            className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all active:scale-95"
          >
            Skip
          </button>
        </motion.header>

        {/* ── HEADLINE + SUBTEXT ── */}
        <div className="px-6 pt-1 flex-shrink-0" style={{ minHeight: 80 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`headline-${currentSlide.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as any }}
            >
              <h1 className="text-[26px] leading-tight font-black tracking-tight text-white font-display">
                {currentSlide.headlineFirst}{" "}
                <span className="text-[#1e60ff]">{currentSlide.headlineAccent}</span>
              </h1>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-[95%]">
                {currentSlide.subtext}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── HERO IMAGE ── */}
        <div className="px-4 mt-3 flex-shrink-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`img-${currentSlide.id}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] as any }}
              className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
              style={{ height: "clamp(175px, 42vw, 255px)" }}
            >
              {!imgError[currentSlide.id] ? (
                <img
                  src={currentSlide.image}
                  alt={currentSlide.imageAlt}
                  className="w-full h-full object-cover object-center"
                  onError={() => setImgError((prev) => ({ ...prev, [currentSlide.id]: true }))}
                  loading="eager"
                  decoding="sync"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #0d1a40, #1e3a7a)" }}>
                  <Truck className="w-14 h-14 text-[#1e60ff]/60" />
                  <span className="text-xs text-slate-400">CargoX Commercial Fleet</span>
                </div>
              )}
              {/* Bottom vignette blending into dark bg */}
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(to top, #070d1e 0%, transparent 50%, rgba(7,13,30,0.15) 100%)" }} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── FEATURE BADGES ── */}
        <div className="px-4 mt-3 flex-shrink-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`features-${currentSlide.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="grid grid-cols-3 gap-2"
            >
              {currentSlide.features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center text-center p-2.5 rounded-xl border border-white/[0.09]"
                    style={{ backgroundColor: "rgba(255,255,255,0.045)" }}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center mb-1.5">
                      <Icon className="w-4 h-4 text-[#1e60ff]" />
                    </div>
                    <span className="text-xs font-bold text-white leading-tight">{f.title}</span>
                    <span className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">{f.desc}</span>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── SLIDE PROGRESS DOTS ── */}
        <div className="flex justify-center items-center gap-2 mt-4 flex-shrink-0">
          {ONBOARDING_SLIDES.map((slide, index) => {
            const isActive = index === slideIndex;
            return (
              <button
                key={slide.id}
                onClick={() => handleDotClick(index)}
                aria-label={`Go to slide ${index + 1}`}
                className="p-1.5 focus:outline-none"
              >
                <motion.div
                  animate={{
                    width: isActive ? 22 : 6,
                    backgroundColor: isActive ? "#1e60ff" : "#334155",
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-1.5 rounded-full"
                />
              </button>
            );
          })}
        </div>

        {/* ── CTA BUTTONS ──
            Background is #070d1e so the animating opacity never reveals
            the white body behind it. mt-auto pushes it to the bottom. */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3 }}
          style={{ backgroundColor: "#070d1e" }}
          className="px-6 pt-3 pb-[max(env(safe-area-inset-bottom,28px),28px)] mt-auto flex-shrink-0 flex flex-col gap-3"
        >
          <button
            onClick={handleContinue}
            className="w-full bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all"
          >
            <span>{slideIndex === TOTAL_SLIDES - 1 ? "Get Started" : "Continue"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                onClick={() => handleComplete("login")}
                className="w-full bg-transparent hover:bg-white/5 active:scale-[0.98] text-slate-300 hover:text-white py-3 px-6 rounded-2xl font-semibold text-sm border border-slate-700/80 transition-all text-center"
              >
                Already have an account? Login
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
      </div>
    </div>
  );
}
