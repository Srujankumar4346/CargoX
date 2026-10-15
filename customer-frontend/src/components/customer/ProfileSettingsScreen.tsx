import { useState } from "react";
import { 
  Calendar, 
  MapPin, 
  CreditCard, 
  Bell, 
  HelpCircle, 
  Gift, 
  Settings as SettingsIcon, 
  LogOut, 
  ChevronRight,
  Sparkles
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
  onReplayWelcome?: () => void;
}

export default function ProfileSettingsScreen({
  onNavigateTab,
  onOpenSavedLocations,
  onOpenPaymentMethods,
  onOpenNotifications,
  onOpenHelpSupport,
  onOpenReferEarn,
  onOpenSettings,
  onReplayWelcome
}: ProfileSettingsScreenProps) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const name = user?.fullName || "Valued Customer";
  const email = user?.primaryEmailAddress?.emailAddress || "customer@cargox.com";
  const userInitials = (user?.firstName?.charAt(0) || "") + (user?.lastName?.charAt(0) || "") || "CX";
  const profileImageUrl = user?.imageUrl;

  const [activeModal, setActiveModal] = useState<string | null>(null);

  const menuItems = [
    {
      id: "bookings",
      label: "My Bookings",
      icon: <Calendar className="w-5 h-5 text-[#1e60ff]" />,
      action: () => onNavigateTab("bookings")
    },
    {
      id: "saved-locations",
      label: "Saved Locations",
      icon: <MapPin className="w-5 h-5 text-emerald-600" />,
      action: onOpenSavedLocations || (() => setActiveModal("saved-locations"))
    },
    {
      id: "payment-methods",
      label: "Payment Methods",
      icon: <CreditCard className="w-5 h-5 text-indigo-600" />,
      action: onOpenPaymentMethods || (() => setActiveModal("payment-methods"))
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <Bell className="w-5 h-5 text-amber-500" />,
      action: onOpenNotifications || (() => setActiveModal("notifications"))
    },
    {
      id: "help-support",
      label: "Help & Support",
      icon: <HelpCircle className="w-5 h-5 text-blue-500" />,
      action: onOpenHelpSupport || (() => setActiveModal("help-support"))
    },
    {
      id: "refer-earn",
      label: "Refer & Earn",
      icon: <Gift className="w-5 h-5 text-purple-500" />,
      action: onOpenReferEarn || (() => setActiveModal("refer-earn"))
    },
    {
      id: "settings",
      label: "Settings",
      icon: <SettingsIcon className="w-5 h-5 text-slate-600" />,
      action: onOpenSettings || (() => { window.location.href = "/customer/settings"; })
    },
    {
      id: "welcome-tour",
      label: "Welcome Tour (Preview)",
      icon: <Sparkles className="w-5 h-5 text-amber-500" />,
      action: onReplayWelcome || (() => {
        try { localStorage.removeItem("cargox_onboarding_completed"); } catch {}
        window.location.href = "/preview-welcome";
      })
    },
  ];

  const handleLogout = () => {
    try {
      localStorage.removeItem("cargox_onboarding_completed");
    } catch {}
    signOut(() => {
      window.location.href = "/";
    });
  };

  return (
    <div className="min-h-full flex-1 bg-[#f8fafc] text-slate-800 flex flex-col justify-between pb-28 select-none overflow-y-auto">
      <div>
        {/* Profile Card Header matching Shared CargoX Aesthetic */}
        <div className="bg-gradient-to-b from-[#070d1e] to-[#0d1730] text-white px-5 pt-[max(env(safe-area-inset-top),24px)] pb-7 rounded-b-3xl shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-white/20 shadow-md bg-slate-800"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 border-2 border-white/20 shadow-md flex items-center justify-center font-bold text-white text-lg tracking-wider">
                  {userInitials}
                </div>
              )}
              <div>
                <h1 className="text-base font-extrabold text-white tracking-tight">{name}</h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{email}</p>
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Verified Shipper
                </span>
              </div>
            </div>

            <button 
              onClick={onOpenSettings || (() => { window.location.href = "/customer/settings"; })}
              className="p-2.5 rounded-xl text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 transition-all shadow-xs"
              title="Open Account Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Menu Container */}
        <div className="px-5 mt-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className="w-full py-3 px-4 bg-white border border-slate-100 hover:border-blue-200 shadow-2xs rounded-2xl flex items-center justify-between hover:bg-slate-50/80 active:scale-[0.99] transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover:scale-105 transition-transform">
                  {item.icon}
                </div>
                <span className="text-xs font-bold text-slate-800 tracking-tight">
                  {item.label}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#1e60ff] group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}

          {/* Red Logout Action Button */}
          <div className="pt-3">
            <button
              onClick={handleLogout}
              className="w-full py-3 px-4 rounded-2xl border border-red-200 bg-red-50/60 hover:bg-red-50 text-red-600 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs active:scale-[0.99]"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Dialogs for Menu Items */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-4 animate-fade-in">
            {activeModal === "saved-locations" && (
              <>
                <h3 className="text-sm font-bold text-slate-900">Saved Locations</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Your primary pickup location is automatically remembered from previous bookings. You can search or pin new destinations anytime during the quote flow.
                </p>
              </>
            )}
            {activeModal === "payment-methods" && (
              <>
                <h3 className="text-sm font-bold text-slate-900">Payment Methods</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  CargoX supports Pay-After-Delivery. Settle outstanding invoices directly through dynamic UPI QR, Net Banking, or Driver POD collection once your shipment is delivered.
                </p>
              </>
            )}
            {activeModal === "notifications" && (
              <>
                <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  All active milestone updates appear automatically in your Live Tracking and My Bookings screens. No unread alerts.
                </p>
              </>
            )}
            {activeModal === "help-support" && (
              <>
                <h3 className="text-sm font-bold text-slate-900">24/7 CargoX Support</h3>
                <div className="text-xs text-slate-600 space-y-1.5">
                  <p><strong>Toll-Free Helpline:</strong> 1800-CARGO-X</p>
                  <p><strong>Email Support:</strong> support@cargox.com</p>
                  <p><strong>Operations Desk:</strong> Mon - Sat, 8:00 AM - 10:00 PM IST</p>
                </div>
              </>
            )}
            {activeModal === "refer-earn" && (
              <>
                <h3 className="text-sm font-bold text-slate-900">Refer & Earn</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Share your CargoX booking reference with business partners to receive ₹500 off on your next intercity freight haul.
                </p>
              </>
            )}

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 bg-[#1e60ff] hover:bg-[#164ed9] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
