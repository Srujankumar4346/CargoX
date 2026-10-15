import React from "react";
import { Home, Calendar, Navigation, User } from "lucide-react";

export type TabType = "home" | "bookings" | "track" | "profile";

interface MobileBottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export default function MobileBottomNav({ activeTab, onChangeTab }: MobileBottomNavProps) {
  const navItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home className="w-5 h-5" /> },
    { id: "bookings", label: "Bookings", icon: <Calendar className="w-5 h-5" /> },
    { id: "track", label: "Track", icon: <Navigation className="w-5 h-5" /> },
    { id: "profile", label: "Profile", icon: <User className="w-5 h-5" /> },
  ];

  return (
    <nav className="fixed md:absolute bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 pt-2 pb-[max(env(safe-area-inset-bottom,16px),16px)] shadow-[0_-4px_25px_rgba(0,0,0,0.08)] max-w-[430px] mx-auto">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`flex flex-col items-center gap-1 transition-all py-1 px-3 rounded-xl ${
                isActive ? "text-[#1e60ff] font-bold" : "text-slate-400 hover:text-slate-600 font-medium"
              }`}
            >
              <div className={`transition-transform duration-200 ${isActive ? "scale-110" : ""}`}>
                {item.icon}
              </div>
              <span className="text-[11px] leading-tight tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
