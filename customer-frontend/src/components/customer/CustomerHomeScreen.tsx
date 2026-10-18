import { useState } from "react";
import { 
  ChevronDown, 
  Bell, 
  ArrowUpDown, 
  ChevronRight,
  Navigation,
  Calendar,
  Calculator,
  Headphones
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
  onSelectService: (serviceName: "Trucks" | "Part Load" | "2 Wheeler" | "Packers & Movers") => void;
  onSwapLocations?: () => void;
  selectedCity?: string;
  onChangeCity?: (city: string) => void;
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
  onSelectService,
  onSwapLocations,
  selectedCity = "Hyderabad",
  onChangeCity,
}: CustomerHomeScreenProps) {
  const [showCityPicker, setShowCityPicker] = useState(false);

  const indianCities = [
    "Hyderabad, Telangana",
    "Bengaluru, Karnataka",
    "Chennai, Tamil Nadu",
    "Mumbai, Maharashtra",
    "Delhi NCR",
    "Vijayawada, Andhra Pradesh",
    "Pune, Maharashtra",
    "Kolkata, West Bengal"
  ];

  return (
    <div className="min-h-full flex-1 bg-[#f4f7fb] text-slate-900 pb-28 select-none overflow-y-auto">
      {/* Top Header matching Screen 2 reference */}
      <header className="bg-white px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3 border-b border-slate-100 flex items-center justify-between shadow-2xs sticky top-0 z-30">
        {/* City selector dropdown */}
        <div className="relative">
          <div
            onClick={() => setShowCityPicker(!showCityPicker)}
            role="button"
            tabIndex={0}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <span className="text-sm">📍</span>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-slate-900 group-hover:text-[#0866F5] transition-colors">
                  {selectedCity.split(",")[0]}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                {selectedCity.includes(",") ? selectedCity.split(",")[1].trim() : "India"}
              </p>
            </div>
          </div>

          {/* City Selection Modal */}
          {showCityPicker && (
            <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
              <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Operational Hub</p>
              {indianCities.map((c) => (
                <div
                  key={c}
                  onClick={() => {
                    onChangeCity?.(c);
                    setShowCityPicker(false);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#0866F5] cursor-pointer transition-colors"
                >
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right actions: Notification */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => alert("CargoExpress Notifications:\n• Part Load linehaul routes available with flat starter pricing\n• Express intercity delivery network operational")}
            className="relative p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
          </button>
        </div>
      </header>

      {/* Hero Section: "Send Anything, Anywhere" */}
      <section className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
          Send Anything,<br />Anywhere
        </h1>
        <p className="text-xs font-semibold text-slate-500 mt-1">
          Trucks • Part Load • 2 Wheeler • Packers & Movers
        </p>

        {/* Pickup & Drop Cards Container matching Screen 2 */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 mt-3 relative">
          {/* Pickup location */}
          <div
            onClick={onOpenPickup}
            role="button"
            tabIndex={0}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <span className="text-xs font-black">↑</span>
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pickup Location</p>
              <p className="text-xs font-bold text-slate-800 truncate mt-0.5">
                {isDetectingLocation ? "Detecting location..." : (pickupAddress || "Enter pickup location")}
              </p>
            </div>
          </div>

          {/* Divider with swap locations button */}
          <div className="relative my-1">
            <div className="border-t border-slate-100 ml-10 mr-10" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSwapLocations?.();
              }}
              title="Swap Locations"
              className="absolute right-2 -top-3.5 w-7 h-7 rounded-full bg-slate-50 hover:bg-blue-50 border border-slate-200 text-slate-600 hover:text-[#0866F5] flex items-center justify-center shadow-2xs transition-all"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Drop location */}
          <div
            onClick={onOpenDrop}
            role="button"
            tabIndex={0}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <span className="text-xs font-black">↓</span>
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Drop Location</p>
              <p className="text-xs font-bold text-slate-800 truncate mt-0.5">
                {dropAddress || "Enter drop location"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Service Selection: 2-column Grid matching Screen 2 reference */}
      <section className="px-4 mt-3">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-extrabold text-slate-900">Choose a service</h2>
          <button
            onClick={onGetQuote}
            className="text-xs font-bold text-[#0866F5] hover:underline"
          >
            View all
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Service 1: Trucks (Full Truck Load) */}
          <div
            onClick={() => onSelectService("Trucks")}
            role="button"
            tabIndex={0}
            className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="w-full flex items-center justify-center h-20 mb-1">
              <img
                src="/images/vehicles/tata-ace-gold.png"
                alt="Full Truckload Freight"
                className="max-h-16 max-w-[85%] object-contain group-hover:scale-105 transition-transform"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/images/vehicles/col5_full.png";
                }}
              />
            </div>
            <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-900 leading-tight">Trucks</p>
                <p className="text-[10px] text-slate-400 font-medium">Full Truck Load</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0866F5] transition-colors" />
            </div>
          </div>

          {/* Service 2: Part Load (Shared Truck) - FIRST CLASS CITIZEN */}
          <div
            onClick={() => onSelectService("Part Load")}
            role="button"
            tabIndex={0}
            className="bg-white rounded-2xl p-3.5 shadow-sm border-2 border-blue-200/80 bg-gradient-to-br from-blue-50/20 via-white to-white hover:border-[#0866F5] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
          >
            {/* Recommended Tag */}
            <div className="absolute top-2 right-2 bg-blue-100 text-[#0866F5] text-[9px] font-black px-1.5 py-0.5 rounded-full">
              Best Value
            </div>
            <div className="w-full flex items-center justify-center h-20 mb-1">
              <img
                src="/images/vehicles/ashok-leyland-dost.png"
                alt="Part Load Shared Truck"
                className="max-h-16 max-w-[85%] object-contain group-hover:scale-105 transition-transform"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/images/vehicles/screen6_full.png";
                }}
              />
            </div>
            <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-900 leading-tight">Part Load</p>
                <p className="text-[10px] text-slate-500 font-medium">Shared Truck</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#0866F5] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Service 3: 2 Wheeler (Quick Delivery) */}
          <div
            onClick={() => onSelectService("2 Wheeler")}
            role="button"
            tabIndex={0}
            className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="w-full flex items-center justify-center h-20 mb-1 text-4xl">
              🛵
            </div>
            <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-900 leading-tight">2 Wheeler</p>
                <p className="text-[10px] text-slate-400 font-medium">Quick Delivery</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0866F5] transition-colors" />
            </div>
          </div>

          {/* Service 4: Packers & Movers (House Shifting) */}
          <div
            onClick={() => onSelectService("Packers & Movers")}
            role="button"
            tabIndex={0}
            className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="w-full flex items-center justify-center h-20 mb-1 text-4xl">
              📦
            </div>
            <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-900 leading-tight">Packers & Movers</p>
                <p className="text-[10px] text-slate-400 font-medium">House Shifting</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0866F5] transition-colors" />
            </div>
          </div>
        </div>
      </section>

      {/* Rewards Banner matching Screen 2 reference */}
      <section className="px-4 mt-4">
        <div
          onClick={() => alert("CargoExpress Rewards: Earn 2 cargo coins for every ₹100 spent. Redeemable on any future trip!")}
          role="button"
          tabIndex={0}
          className="bg-gradient-to-r from-amber-50 via-white to-orange-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs cursor-pointer hover:border-amber-300 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-400/20 text-amber-600 flex items-center justify-center text-xl font-bold shadow-2xs">
              🪙
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 leading-tight">Explore CargoExpress Rewards</p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Earn 2 coins for every ₹100 spent</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
      </section>

      {/* Quick Access Utility Actions */}
      <section className="px-4 mt-4">
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={onQuickTrack}
            className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs flex flex-col items-center justify-center text-center hover:border-blue-200 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0866F5] flex items-center justify-center mb-1">
              <Navigation className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-700">Track</span>
          </button>

          <button
            onClick={onQuickBookings}
            className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs flex flex-col items-center justify-center text-center hover:border-blue-200 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-700">Orders</span>
          </button>

          <button
            onClick={onQuickCalculator}
            className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs flex flex-col items-center justify-center text-center hover:border-blue-200 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-1">
              <Calculator className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-700">Estimate</span>
          </button>

          <button
            onClick={onQuickSupport}
            className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs flex flex-col items-center justify-center text-center hover:border-blue-200 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-1">
              <Headphones className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-700">Support</span>
          </button>
        </div>
      </section>
    </div>
  );
}
