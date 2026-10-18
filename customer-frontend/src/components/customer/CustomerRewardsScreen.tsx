import { TrendingUp } from "lucide-react";

interface CustomerRewardsScreenProps {
  onBack?: () => void;
  onExploreServices?: () => void;
}

export default function CustomerRewardsScreen({
  onBack,
}: CustomerRewardsScreenProps) {
  const coinsBalance = 0;

  const rewardOffers = [
    {
      id: "flat-500",
      title: "Flat ₹500 off on Part Load",
      desc: "Valid on all intercity shared truck linehauls",
      coinsNeeded: 100,
      code: "PART500",
    },
    {
      id: "gst-credit",
      title: "Free GST Invoice & Priority Loading",
      desc: "For registered business shipments above 1 Ton",
      coinsNeeded: 50,
      code: "PRIORITYGST",
    },
    {
      id: "house-shift",
      title: "₹1,000 off on Packers & Movers",
      desc: "Full household relocation discount",
      coinsNeeded: 200,
      code: "SHIFT1000",
    },
  ];

  return (
    <div className="min-h-full flex-1 bg-[#f4f7fb] text-slate-900 pb-28 select-none overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3 flex items-center gap-3 border-b border-slate-100 shadow-2xs">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            ←
          </button>
        )}
        <h1 className="text-base font-extrabold text-slate-900">CargoExpress Coins & Rewards</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Coins Balance Card */}
        <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
          <div className="absolute right-2 top-2 text-6xl opacity-15">🪙</div>
          <p className="text-xs font-bold text-amber-100 uppercase tracking-wider">Your Cargo Coins</p>
          <div className="flex items-baseline gap-2 mt-1 mb-2">
            <span className="text-4xl font-black">{coinsBalance}</span>
            <span className="text-sm font-semibold text-amber-200">Coins</span>
          </div>
          <p className="text-[11px] text-amber-100 font-medium">
            Earn 2 coins for every ₹100 spent on any booking!
          </p>
        </div>

        {/* How to Earn */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs">
          <h2 className="text-xs font-extrabold text-slate-900 mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#0866F5]" />
            <span>How Rewards Work</span>
          </h2>
          <div className="space-y-2 text-xs text-slate-600">
            <p className="flex items-start gap-2">
              <span className="font-bold text-[#0866F5]">1.</span>
              <span>Book any Part Load, Truck, or Shifting trip.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="font-bold text-[#0866F5]">2.</span>
              <span>Automatically receive 2 coins per ₹100 on invoice settlement.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="font-bold text-[#0866F5]">3.</span>
              <span>Redeem coins directly for cash discounts on future bookings.</span>
            </p>
          </div>
        </div>

        {/* Available Coupons */}
        <div>
          <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
            Available Vouchers
          </p>
          <div className="space-y-2.5">
            {rewardOffers.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-200/90 flex items-center justify-between shadow-2xs"
              >
                <div>
                  <p className="text-xs font-black text-slate-900">{r.title}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{r.desc}</p>
                  <p className="text-[10px] font-bold text-amber-600 mt-1">
                    🪙 {r.coinsNeeded} Coins Required
                  </p>
                </div>
                <button
                  onClick={() => alert(`Use code ${r.code} during booking settlement!`)}
                  className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-[#0866F5] text-xs font-bold hover:bg-blue-100 transition-colors shrink-0"
                >
                  Redeem
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
