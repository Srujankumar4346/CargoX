import React from 'react';
import { Home, ClipboardList, Wallet, MoreHorizontal } from 'lucide-react';

export type DriverNavTab = 'home' | 'orders' | 'earnings' | 'more';

interface DriverBottomNavigationProps {
  currentTab: DriverNavTab;
  onSelectTab: (tab: DriverNavTab) => void;
  hasActiveOrder?: boolean;
}

export const DriverBottomNavigation: React.FC<DriverBottomNavigationProps> = ({
  currentTab,
  onSelectTab,
  hasActiveOrder = false,
}) => {
  const navItems: { id: DriverNavTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'earnings', label: 'Earnings', icon: Wallet },
    { id: 'more', label: 'More', icon: MoreHorizontal },
  ];

  return (
    <nav
      aria-label="Driver Navigation"
      className="fixed bottom-0 inset-x-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-40 transition-all box-border"
    >
      <div className="w-full h-16 grid grid-cols-4 px-2 box-border">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full min-w-0 flex flex-col items-center justify-center py-1 gap-1 transition-colors relative cursor-pointer ${
                isActive ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-700 font-medium'
              }`}
            >
              <div className="relative">
                <Icon size={22} className={isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
                {item.id === 'orders' && hasActiveOrder && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                )}
              </div>
              <span className="text-[11px] leading-tight tracking-tight truncate">{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 absolute bottom-0.5" />
              )}
            </button>
          );
        })}
      </div>
      {/* Mobile Safe Area Bottom Inset */}
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  );
};

export default DriverBottomNavigation;
