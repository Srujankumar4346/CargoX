import { useState } from "react";
import { 
  MapPin, 
  Building2, 
  Share2, 
  Briefcase, 
  HelpCircle, 
  Globe, 
  FileText, 
  LogOut, 
  ChevronRight,
  X
} from "lucide-react";
import { useClerk, useUser } from "@clerk/react";

interface CustomerAccountScreenProps {
  onOpenSavedLocations?: () => void;
  onOpenPayments?: () => void;
  onLogout?: () => void;
}

export default function CustomerAccountScreen({
  onOpenSavedLocations,
}: CustomerAccountScreenProps) {
  const { isSignedIn, user } = useUser();
  const { signOut, openSignIn } = useClerk();

  const [showGSTModal, setShowGSTModal] = useState(false);
  const [gstin, setGstin] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [savedGST, setSavedGST] = useState<string | null>(null);

  const displayName = isSignedIn 
    ? (user?.fullName || user?.firstName || "Customer Account") 
    : (localStorage.getItem("user_email") || "Customer Account");
  const displayEmail = isSignedIn 
    ? (user?.primaryEmailAddress?.emailAddress || "Verified Account") 
    : (localStorage.getItem("user_email") ? "Verified Account" : "guest@cargox.com (Guest Session)");


  const handleSaveGST = () => {
    if (!gstin.trim() || gstin.length < 15) {
      alert("Please enter a valid 15-character GSTIN number.");
      return;
    }
    setSavedGST(gstin.toUpperCase());
    setShowGSTModal(false);
    alert(`GSTIN ${gstin.toUpperCase()} saved successfully!`);
  };

  const handleSignOut = () => {
    if (confirm("Are you sure you want to log out of CargoExpress?")) {
      try {
        localStorage.removeItem("cargox_onboarding_completed");
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_email");
      } catch {}
      if (isSignedIn) {
        signOut(() => {
          window.location.href = "/";
        });
      } else {
        window.location.href = "/";
      }
    }
  };

  return (
    <div className="min-h-full flex-1 bg-[#f4f7fb] text-slate-900 pb-28 select-none overflow-y-auto">
      {/* Top Header Card matching Screen 9 in reference */}
      <div className="bg-white px-4 pt-[max(env(safe-area-inset-top),14px)] pb-4 shadow-sm border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* User Profile Avatar with purple background matching reference */}
            <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
              {displayName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-slate-900">{displayName}</h1>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-slate-500 font-medium">
                  Verified Account
                </p>
                <button
                  onClick={() => {
                    if (!isSignedIn) {
                      openSignIn();
                    } else {
                      alert(`Account is verified: ${displayName}`);
                    }
                  }}
                  className="text-[11px] font-bold text-[#0866F5] hover:underline cursor-pointer"
                >
                  Verify
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (!isSignedIn) {
                openSignIn();
              } else {
                alert(`CargoExpress Account Details:\n• Name: ${displayName}\n• Email: ${displayEmail}\n• Role: Verified Customer`);
              }
            }}
            className="text-xs font-bold text-[#0866F5] flex items-center gap-0.5 cursor-pointer hover:underline"
          >
            <span>View</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* + Add GST Details Button */}
        <button
          onClick={() => setShowGSTModal(true)}
          className="w-full mt-4 py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 text-[#0866F5] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
        >
          <span>+</span>
          <span>{savedGST ? `GSTIN: ${savedGST}` : "Add GST Details"}</span>
        </button>
      </div>

      {/* Menu Rows List matching Screen 9 in reference */}
      <div className="p-4 space-y-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-2xs overflow-hidden">
          {/* Saved Addresses */}
          <div
            onClick={onOpenSavedLocations}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">Saved Addresses</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>

          {/* Business Details with + Add GSTIN badge */}
          <div
            onClick={() => setShowGSTModal(true)}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">Business Details</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-lg border border-blue-200 text-[#0866F5] text-[10px] font-bold">
                + Add GSTIN
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Rewards Row */}
          <div
            onClick={() => alert("CargoExpress Rewards Balance: 0 coins. Earn 2 coins for every ₹100 spent!")}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-bold">
                🪙
              </div>
              <span className="text-xs font-bold text-slate-800">CargoExpress Rewards</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-700">0</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Refer your friends with Invite Button */}
          <div
            onClick={() => alert("Referral Link copied! Share with colleagues to earn ₹500 discount.")}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Share2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">Refer your friends!</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                alert("Referral Code: CARGO500");
              }}
              className="px-3 py-1 rounded-lg border border-blue-200 text-[#0866F5] text-xs font-bold hover:bg-blue-50 transition-colors"
            >
              Invite
            </button>
          </div>

          {/* CargoExpress Enterprise with NEW Badge */}
          <div
            onClick={() => alert("CargoExpress Enterprise: Dedicated fleet manager, credit terms, and custom linehaul SLAs.")}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">CargoExpress Enterprise</p>
                <p className="text-[10px] text-slate-400">Upgrade to Business Solution</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-black">
                NEW
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Help & Support */}
          <div
            onClick={() => alert("CargoExpress 24/7 Operations Support:\n• Helpline: 1800-CARGO-EXP (1800-227463)\n• Email: support@cargox.com")}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">Help & Support</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>

          {/* Change Language */}
          <div
            onClick={() => alert("Current language: English (India). Hindi and Telugu support active.")}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">Change Language</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>

          {/* Terms & Conditions */}
          <div
            onClick={() => alert("CargoExpress Terms of Transport:\n• Licensed Motor Transport Contractor\n• GST and E-way bill compliance mandatory for commercial freight")}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">Terms & Conditions</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>

          {/* Logout */}
          <div
            onClick={handleSignOut}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-rose-50 cursor-pointer transition-colors text-rose-600"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold">Logout</span>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-400" />
          </div>
        </div>
      </div>

      {/* GST Details Modal */}
      {showGSTModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">Add Business GSTIN</h3>
              <button
                onClick={() => setShowGSTModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Company / Business Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Logistics Private Limited"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-bold outline-none focus:border-[#0866F5]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">15-Digit GSTIN</label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 36AABCU9603R1ZM"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-bold outline-none uppercase focus:border-[#0866F5]"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setShowGSTModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGST}
                className="flex-1 py-2.5 rounded-xl bg-[#0866F5] text-white font-bold text-xs hover:bg-[#0652c5] shadow-xs"
              >
                Save GSTIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
