import { 
  Calendar, 
  MapPin, 
  CreditCard, 
  Bell, 
  HelpCircle, 
  Gift, 
  Settings as SettingsIcon, 
  LogOut, 
  ChevronRight 
} from "lucide-react";
import { useClerk, useUser } from "@clerk/react";

interface ProfileSettingsScreenProps {
  onNavigateTab: (tab: "home" | "bookings" | "track" | "profile") => void;
  onOpenSavedLocations?: () => void;
  onOpenPaymentMethods?: () => void;
  onOpenNotifications?: () => void;
  onOpenHelpSupport?: () => void;
  onOpenReferEarn?: () => void;
  onOpenSettings?: () => void;
}

export default function ProfileSettingsScreen({
  onNavigateTab,
  onOpenSavedLocations,
  onOpenPaymentMethods,
  onOpenNotifications,
  onOpenHelpSupport,
  onOpenReferEarn,
  onOpenSettings
}: ProfileSettingsScreenProps) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const name = user?.fullName || "Srujan Kumar";
  const email = user?.primaryEmailAddress?.emailAddress || "srujan@gmail.com";

  const menuItems = [
    {
      id: "bookings",
      label: "My Bookings",
      icon: <Calendar className="w-5 h-5 text-slate-700" />,
      action: () => onNavigateTab("bookings")
    },
    {
      id: "saved-locations",
      label: "Saved Locations",
      icon: <MapPin className="w-5 h-5 text-slate-700" />,
      action: onOpenSavedLocations
    },
    {
      id: "payment-methods",
      label: "Payment Methods",
      icon: <CreditCard className="w-5 h-5 text-slate-700" />,
      action: onOpenPaymentMethods
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <Bell className="w-5 h-5 text-slate-700" />,
      action: onOpenNotifications
    },
    {
      id: "help-support",
      label: "Help & Support",
      icon: <HelpCircle className="w-5 h-5 text-slate-700" />,
      action: onOpenHelpSupport
    },
    {
      id: "refer-earn",
      label: "Refer & Earn",
      icon: <Gift className="w-5 h-5 text-slate-700" />,
      action: onOpenReferEarn
    },
    {
      id: "settings",
      label: "Settings",
      icon: <SettingsIcon className="w-5 h-5 text-slate-700" />,
      action: onOpenSettings
    },
  ];

  const handleLogout = () => {
    signOut(() => {
      window.location.href = "/";
    });
  };

  return (
    <div className="min-h-screen bg-[#070e24] text-white flex flex-col justify-between pb-24 select-none">
      <div>
        {/* Dark Navy Top Header matching Screen 12 */}
        <div className="px-5 pt-8 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src="/images/driver-avatar.png"
              alt={name}
              className="w-14 h-14 rounded-full object-cover border-2 border-white/20 shadow-lg"
            />
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight">{name}</h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{email}</p>
            </div>
          </div>

          <button 
            onClick={onOpenSettings}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>

        {/* White Menu Container matching Screen 12 */}
        <div className="bg-white rounded-t-3xl text-slate-800 p-5 shadow-2xl min-h-[60vh] space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className="w-full py-3.5 px-3 flex items-center justify-between hover:bg-slate-50 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="text-slate-700 group-hover:text-[#1e60ff] transition-colors">
                  {item.icon}
                </div>
                <span className="text-xs font-bold text-slate-800 tracking-tight">
                  {item.label}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}

          {/* Red Logout Action Button matching Screen 12 */}
          <div className="pt-4">
            <button
              onClick={handleLogout}
              className="w-full py-3.5 px-4 rounded-2xl border border-red-200 bg-red-50/40 hover:bg-red-50 text-red-600 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
