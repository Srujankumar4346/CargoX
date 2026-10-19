import React from 'react';
import {
  User,
  Wallet,
  Gift,
  Award,
  Headphones,
  TrendingUp,
  FileText,
  HelpCircle,
  Users,
  ChevronRight,
  X,
  Star,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useClerk, useUser, UserButton } from '@clerk/react';
import CargoExpressLogo from './CargoExpressLogo';

export type DriverMenuItemKey =
  | 'profile'
  | 'earnings'
  | 'incentives'
  | 'rewards'
  | 'support'
  | 'demand'
  | 'documents'
  | 'help'
  | 'referrals';

interface DriverProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  driverName?: string;
  driverAvatar?: string;
  rating?: number;
  completedTripsCount?: number;
  onSelectMenuItem: (itemKey: DriverMenuItemKey) => void;
}

export const DriverProfileDrawer: React.FC<DriverProfileDrawerProps> = ({
  isOpen,
  onClose,
  driverName = 'Assigned Driver',
  driverAvatar,
  rating = 5.0,
  completedTripsCount = 0,
  onSelectMenuItem,
}) => {
  const { signOut } = useClerk();
  const { isSignedIn } = useUser();

  if (!isOpen) return null;

  const menuItems: {
    key: DriverMenuItemKey;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    title: string;
    subtitle?: string;
  }[] = [
    {
      key: 'profile',
      icon: User,
      title: 'My Profile',
    },
    {
      key: 'earnings',
      icon: Wallet,
      title: 'Earnings',
      subtitle: 'Transfer Money to Bank, History',
    },
    {
      key: 'incentives',
      icon: Gift,
      title: 'Incentives and More',
      subtitle: 'Know how you get paid',
    },
    {
      key: 'rewards',
      icon: Award,
      title: 'Rewards',
      subtitle: 'Insurance and Discounts',
    },
    {
      key: 'support',
      icon: Headphones,
      title: 'Service Manager',
      subtitle: 'Support & Operations',
    },
    {
      key: 'demand',
      icon: TrendingUp,
      title: 'Demand Planner',
      subtitle: 'High Demand Areas & More',
    },
    {
      key: 'documents',
      icon: FileText,
      title: 'Vehicle Documents',
      subtitle: 'RC, Insurance, Fitness, PUC',
    },
    {
      key: 'help',
      icon: HelpCircle,
      title: 'Help',
      subtitle: 'Get support, Accident Insurance',
    },
    {
      key: 'referrals',
      icon: Users,
      title: 'Refer Friends',
      subtitle: 'Earn up to ₹5,500',
    },
  ];

  const handleLogout = async () => {
    localStorage.removeItem('access_token');
    try {
      if (signOut) await signOut();
    } catch (_) {}
    window.location.href = '/login';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-start">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="relative w-[85%] max-w-[320px] bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-in-right overflow-hidden">
        {/* Top Header Card (Signature Emerald Green in Reference) */}
        <div className="bg-[#10B981] text-white p-6 pt-10 flex items-center justify-between shadow-md relative">
          <div
            onClick={() => {
              onSelectMenuItem('profile');
              onClose();
            }}
            className="flex items-center gap-3.5 cursor-pointer flex-1"
          >
            {/* Avatar with circle badge */}
            <div className="relative w-14 h-14 rounded-full bg-white/20 p-0.5 shrink-0 shadow-inner">
              {driverAvatar ? (
                <img
                  src={driverAvatar}
                  alt={driverName}
                  className="w-full h-full rounded-full object-cover bg-white"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-lg">
                  {driverName?.[0] || 'D'}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-700 border-2 border-white flex items-center justify-center">
                <ShieldCheck size={10} className="text-white" />
              </div>
            </div>

            <div className="flex flex-col min-w-0">
              <h2 className="text-xl font-extrabold tracking-tight truncate text-white">
                {driverName}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-emerald-100 font-semibold mt-0.5">
                <span>{rating.toFixed(1)}</span>
                <Star size={12} className="fill-white text-white" />
                <span className="opacity-90">({completedTripsCount} trips)</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              onSelectMenuItem('profile');
              onClose();
            }}
            type="button"
            className="p-2 rounded-full hover:bg-emerald-600/40 text-white transition cursor-pointer"
            aria-label="View Profile"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Drawer Scrollable Body Menu */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onSelectMenuItem(item.key);
                  onClose();
                }}
                className="w-full px-5 py-3.5 flex items-center gap-3.5 text-left hover:bg-slate-50 transition cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-emerald-50 text-slate-700 group-hover:text-emerald-700 flex items-center justify-center shrink-0 transition">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition leading-tight">
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                      {item.subtitle}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSignedIn && <UserButton />}
            <CargoExpressLogo variant="badge" size="sm" />
          </div>
          <button
            onClick={handleLogout}
            type="button"
            className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 py-1.5 px-3 rounded-lg hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverProfileDrawer;
