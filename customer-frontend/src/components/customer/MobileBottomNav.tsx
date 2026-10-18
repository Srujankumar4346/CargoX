import React from "react";
import { Home, Calendar, Award, CreditCard, User } from "lucide-react";

export type TabType = "home" | "orders" | "coins" | "payments" | "account";

interface MobileBottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export default function MobileBottomNav({ activeTab, onChangeTab }: MobileBottomNavProps) {
  const navItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home className="w-5 h-5" /> },
    { id: "orders", label: "Orders", icon: <Calendar className="w-5 h-5" /> },
    { id: "coins", label: "Coins", icon: <Award className="w-5 h-5" /> },
    { id: "payments", label: "Payments", icon: <CreditCard className="w-5 h-5" /> },
    { id: "account", label: "Account", icon: <User className="w-5 h-5" /> },
  ];

  return (
    <nav className="fixed md:absolute bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 pt-2 pb-[max(env(safe-area-inset-bottom,14px),14px)] shadow-[0_-4px_25px_rgba(0,0,0,0.06)] w-full max-w-[430px] mx-auto">
      <div className="grid grid-cols-5 items-center w-full">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 transition-all py-1 rounded-xl w-full ${
                isActive ? "text-[#0866F5] font-bold" : "text-slate-400 hover:text-slate-600 font-medium"
              }`}
            >
              <div className={`transition-transform duration-200 ${isActive ? "scale-110" : ""}`}>
                {item.icon}
              </div>
              <span className="text-[10px] leading-tight tracking-tight text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
