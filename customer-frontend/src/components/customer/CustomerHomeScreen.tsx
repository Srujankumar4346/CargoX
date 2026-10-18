import { 
  Search, 
  ArrowRight, 
  Navigation, 
  Calendar, 
  Calculator, 
  Headphones, 
  ChevronRight
} from "lucide-react";

interface CustomerHomeScreenProps {
  pickupAddress: string;
  dropAddress: string;
  isDetectingLocation?: boolean;
  onOpenPickup: () => void;
  onOpenDrop: () => void;
  onUseCurrentLocation?: () => void;
  onGetQuote: () => void;
  onQuickTrack: () => void;
  onQuickBookings: () => void;
  onQuickCalculator: () => void;
  onQuickSupport: () => void;
  onSelectVehicleCategory: (vehicleName: string) => void;
}

export default function CustomerHomeScreen({
  pickupAddress,
  dropAddress,
  isDetectingLocation = false,
  onOpenPickup,
  onOpenDrop,
  onGetQuote,
  onQuickTrack,
  onQuickBookings,
  onQuickCalculator,
  onQuickSupport,
  onSelectVehicleCategory
}: CustomerHomeScreenProps) {

  return (
    <div className="min-h-full flex-1 bg-[#f4f6fb] text-slate-900 pb-28 select-none overflow-y-auto">
      {/* Top Pickup Bar Matching Screenshot 1 */}
      <section className="px-4 pt-[max(env(safe-area-inset-top),14px)] pb-2">
        <div 
          onClick={onOpenPickup}
          role="button"
          tabIndex={0}
          className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:border-blue-200 transition-all"
        >
          <div className="flex items-center gap-3 overflow-hidden pr-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="text-sm font-black">↑</span>
            </div>
            <div className="truncate">
              <p className="text-[11px] font-bold text-slate-800 leading-tight">Pick up from</p>
              <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                {isDetectingLocation ? "Detecting current GPS location..." : (pickupAddress || "Set pickup location")}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
      </section>

      {/* Main Service Category Cards matching Reference Screenshot (Trucks and Packers & Movers only - NO 2-wheelers/bikes) */}
      <section className="px-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          {/* Trucks Card */}
          <div
            onClick={() => {
              onSelectVehicleCategory("Tata Ace Gold");
              onOpenDrop();
            }}
            role="button"
            tabIndex={0}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/90 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between h-44 group relative overflow-hidden"
          >
            <div className="w-full flex items-center justify-center h-24 mb-1">
              <img
                src="/images/vehicles/tata-ace-gold.png"
                alt="Commercial Cargo Trucks"
                className="max-h-20 max-w-[90%] object-contain group-hover:scale-105 transition-transform drop-shadow-sm"
              />
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-50">
              <span className="text-sm font-extrabold text-slate-900 tracking-tight">Trucks</span>
              <div className="w-6 h-6 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center group-hover:bg-[#1e60ff] group-hover:text-white transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Packers & Movers Card */}
          <div
            onClick={() => {
              onSelectVehicleCategory("Mahindra Bolero Pik-Up");
              onOpenDrop();
            }}
            role="button"
            tabIndex={0}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/90 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between h-44 group relative overflow-hidden"
          >
            <div className="w-full flex items-center justify-center h-24 mb-1">
              <img
                src="/images/vehicles/mahindra-bolero-pikup.png"
                alt="Packers & Movers Logistics"
                className="max-h-20 max-w-[90%] object-contain group-hover:scale-105 transition-transform drop-shadow-sm"
              />
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-50">
              <span className="text-sm font-extrabold text-slate-900 tracking-tight leading-tight">Packers &<br />Movers</span>
              <div className="w-6 h-6 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center group-hover:bg-[#1e60ff] group-hover:text-white transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rewards Banner matching Reference Screenshot 1 */}
      <section className="px-4 mt-3">
        <div 
          onClick={() => alert("CargoX Rewards: Earn 2 cargo coins for every ₹100 spent. Redeemable on all future freight trips!")}
          role="button"
          tabIndex={0}
          className="bg-gradient-to-r from-amber-50/80 via-white to-orange-50/70 border border-amber-200/60 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs cursor-pointer hover:border-amber-300 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-400/20 text-amber-600 flex items-center justify-center text-lg font-bold shadow-2xs">
              🪙
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 leading-tight">Explore CargoX Rewards</p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Earn 2 coins for every 100 spent</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
      </section>

      {/* Announcements Section matching Screenshot 1 */}
      <section className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-slate-800">Announcements</h2>
          <button 
            onClick={() => alert("CargoX Logistics Updates:\n• Seamless door-to-door house shifting now active\n• Intercity linehauls now cover all major hubs")}
            className="text-xs font-bold text-[#1e60ff] hover:underline flex items-center gap-0.5"
          >
            <span>View all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Announcement Card */}
        <div 
          onClick={onOpenDrop}
          role="button"
          tabIndex={0}
          className="bg-white rounded-2xl p-3.5 border border-slate-100/90 shadow-2xs flex items-center justify-between cursor-pointer hover:border-blue-200 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-full bg-blue-50 text-[#1e60ff] flex items-center justify-center text-sm font-bold">
              📢
              <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border border-white">
                2
              </span>
            </div>
            <p className="text-xs font-extrabold text-slate-800">Professional house shifting & cargo freight</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
      </section>

      {/* Quick Search & Direct Destination Jump Card */}
      <section className="px-4 mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Quick Booking</p>
          
          <div
            onClick={onOpenDrop}
            role="button"
            tabIndex={0}
            className="cursor-pointer flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all"
          >
            <div className="flex items-center gap-3 truncate">
              <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                <span className="text-xs font-bold">↓</span>
              </div>
              <span className="text-xs font-bold text-slate-600 truncate">
                {dropAddress || "Where are you shipping to? (Search drop location)"}
              </span>
            </div>
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          <button
            onClick={onGetQuote}
            className="w-full mt-3 bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.99] text-white py-3 px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all"
          >
            <span>Search & Book Commercial Truck</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Quick Action Grid */}
      <section className="px-4 mt-4">
        <div className="grid grid-cols-4 gap-2">
          {/* Track */}
          <button
            onClick={onQuickTrack}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs hover:border-blue-200 transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1e60ff] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
              <Navigation className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">
              Track<br />Shipment
            </span>
          </button>

          {/* Bookings */}
          <button
            onClick={onQuickBookings}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs hover:border-blue-200 transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">
              My<br />Bookings
            </span>
          </button>

          {/* Price Calculator */}
          <button
            onClick={onQuickCalculator}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs hover:border-blue-200 transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
              <Calculator className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">
              Price<br />Estimate
            </span>
          </button>

          {/* Support */}
          <button
            onClick={onQuickSupport}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs hover:border-blue-200 transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
              <Headphones className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">
              24/7<br />Help
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
