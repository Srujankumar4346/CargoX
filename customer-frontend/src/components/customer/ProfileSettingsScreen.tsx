import { useState } from "react";
import { 
  Calendar, 
  MapPin, 
  CreditCard, 
  HelpCircle, 
  Gift, 
  Settings as SettingsIcon, 
  LogOut, 
  ChevronRight,
  Sparkles
} from "lucide-react";
import { useClerk, useUser } from "@clerk/react";

interface ProfileSettingsScreenProps {
  onNavigateTab?: (tab: "home" | "bookings" | "track" | "profile") => void;
  onOpenSavedLocations?: () => void;
  onOpenPaymentMethods?: () => void;
  onOpenNotifications?: () => void;
  onOpenHelpSupport?: () => void;
  onOpenReferEarn?: () => void;
  onOpenSettings?: () => void;
  onReplayWelcome?: () => void;
}

export default function ProfileSettingsScreen({
  onOpenSavedLocations,
  onOpenHelpSupport,
  onOpenReferEarn,
  onOpenSettings,
}: ProfileSettingsScreenProps) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const name = user?.fullName || "Srujan Kumar Sangepu";
  const email = user?.primaryEmailAddress?.emailAddress || "srujankumar4346@gmail.com";

  const [activeModal, setActiveModal] = useState<string | null>(null);

  const handleLogout = () => {
    try {
      localStorage.removeItem("cargox_onboarding_completed");
    } catch {}
    signOut(() => {
      window.location.href = "/";
    });
  };

  return (
    <div className="min-h-full flex-1 bg-[#f4f6fb] text-slate-800 flex flex-col justify-between pb-28 select-none overflow-y-auto">
      <div>
        {/* User Profile Header Card matching Screenshot 3 */}
        <section className="px-4 pt-[max(env(safe-area-inset-top),16px)] pb-2">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/90">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">{name}</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-slate-500 font-medium truncate max-w-[200px]">{email}</p>
                  <button 
                    onClick={() => alert("Verification code sent to your email address.")}
                    className="text-xs font-bold text-[#1e60ff] hover:underline"
                  >
                    Verify
                  </button>
                </div>
              </div>
              <button 
                onClick={onOpenSettings || (() => { window.location.href = "/customer/settings"; })}
                className="text-xs font-bold text-[#1e60ff] flex items-center hover:underline"
              >
                <span>View</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* + Add GST Details Outline Button */}
            <div className="mt-3.5">
              <button
                onClick={() => setActiveModal("gst-modal")}
                className="w-full py-2 px-3 border border-[#1e60ff] rounded-xl text-xs font-bold text-[#1e60ff] hover:bg-blue-50/70 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>+</span>
                <span>Add GST Details</span>
              </button>
            </div>
          </div>
        </section>

        {/* Section 1: Saved Addresses & Business Details */}
        <section className="px-4 mt-2.5">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100/90 divide-y divide-slate-100">
            {/* Saved Addresses */}
            <div 
              onClick={onOpenSavedLocations || (() => setActiveModal("saved-locations"))}
              role="button"
              tabIndex={0}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors rounded-t-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">Saved Addresses</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            {/* Business Details with + Add GSTIN */}
            <div 
              onClick={() => setActiveModal("gst-modal")}
              role="button"
              tabIndex={0}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors rounded-b-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700">
                  <CreditCard className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">Business Details</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#1e60ff] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                  + Add GSTIN
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Rewards & Refer Friends */}
        <section className="px-4 mt-2.5">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100/90 divide-y divide-slate-100">
            {/* CargoX Rewards */}
            <div 
              onClick={() => alert("CargoX Rewards: You currently have 0 coins. Earn 2 coins for every ₹100 spent on freight orders!")}
              role="button"
              tabIndex={0}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors rounded-t-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-amber-500">
                  <Gift className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">CargoX Rewards</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                  🪙 0
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Refer your friends */}
            <div 
              onClick={onOpenReferEarn || (() => setActiveModal("refer-earn"))}
              role="button"
              tabIndex={0}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors rounded-b-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-purple-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">Refer your friends!</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#1e60ff] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Invite
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Enterprise */}
        <section className="px-4 mt-2.5">
          <div 
            onClick={() => alert("CargoX Enterprise: Dedicated account management, volume SLA guarantees, and consolidated monthly invoicing. Contact corporate@cargox.com")}
            role="button"
            tabIndex={0}
            className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100/90 flex items-center justify-between cursor-pointer hover:border-blue-200 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">CargoX Enterprise</p>
                <p className="text-[10px] text-slate-400 font-medium">Upgrade to Business Solution</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                NEW
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </section>

        {/* Section 4: General Utility Items */}
        <section className="px-4 mt-2.5">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100/90 divide-y divide-slate-100">
            {/* Help & Support */}
            <div 
              onClick={onOpenHelpSupport || (() => setActiveModal("help-support"))}
              role="button"
              tabIndex={0}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors rounded-t-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-blue-600">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">Help & Support</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            {/* Change Language */}
            <div 
              onClick={() => alert("Current language: English (Default). Hindi, Telugu, and Tamil support coming soon.")}
              role="button"
              tabIndex={0}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700 font-bold text-xs">
                  文A
                </div>
                <span className="text-xs font-bold text-slate-800">Change Language</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            {/* Terms & Conditions */}
            <div 
              onClick={() => alert("CargoX Terms: Goods carried under standard Indian Carriage of Goods by Road Act rules. Standard billing terms apply.")}
              role="button"
              tabIndex={0}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700">
                  <SettingsIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">Terms & Conditions</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            {/* Logout */}
            <div 
              onClick={handleLogout}
              role="button"
              tabIndex={0}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-red-50/50 transition-colors rounded-b-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-red-500">
                  <LogOut className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">Logout</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </section>

        {/* App Version Footer matching Screenshot 3 */}
        <div className="text-center py-5">
          <p className="text-xs text-slate-400 font-semibold tracking-wide">App version 6.95.0</p>
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
