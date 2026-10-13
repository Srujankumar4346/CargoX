import { useState } from "react";
import { 
  Bell, 
  MapPin, 
  Search, 
  Crosshair, 
  ArrowRight, 
  Navigation, 
  Calendar, 
  Calculator, 
  Headphones, 
  ChevronRight
} from "lucide-react";
import { UserButton, useUser } from "@clerk/react";

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
  onUseCurrentLocation,
  onGetQuote,
  onQuickTrack,
  onQuickBookings,
  onQuickCalculator,
  onQuickSupport,
  onSelectVehicleCategory
}: CustomerHomeScreenProps) {
  const { user } = useUser();
  const [tripType, setTripType] = useState<"one-way" | "round-trip" | "multi-stop">("one-way");

  const userName = user?.firstName || user?.fullName?.split(" ")[0] || "";

  const popularTrucks = [
    {
      id: "bolero",
      name: "Mahindra Bolero Pik-Up",
      capacity: "2.0 Ton (2,000 kg)",
      image: "/images/vehicles/mahindra-bolero-pikup.png",
    },
    {
      id: "tata-ace",
      name: "Tata Ace Gold",
      capacity: "1.0 Ton (1,000 kg)",
      image: "/images/vehicles/tata-ace-gold.png",
    },
    {
      id: "dost",
      name: "Ashok Leyland Dost",
      capacity: "1.5 Ton (1,500 kg)",
      image: "/images/vehicles/ashok-leyland-dost.png",
    },
    {
      id: "tata-intra",
      name: "Tata Intra V30",
      capacity: "2.5 Ton (2,500 kg)",
      image: "/images/vehicles/tata-intra-v30.png",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-28 select-none">
      {/* Top Header Bar */}
      <header className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-2xl font-black text-slate-900 tracking-tight font-display">Cargo</span>
          <span className="text-2xl font-black text-[#1e60ff] tracking-tight font-display">X</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={onQuickSupport}
            aria-label="Notifications" 
            className="relative p-2.5 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>
          <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 flex items-center justify-center bg-slate-100">
            <UserButton />
          </div>
        </div>
      </header>

      {/* Hero Welcome Banner matching Screenshot 2 */}
      <section className="px-5 mt-2">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-50/90 to-indigo-50/50 rounded-2xl p-4 flex items-center justify-between border border-blue-100/70 shadow-xs">
          <div className="z-10 max-w-[62%]">
            {userName && (
              <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Welcome, {userName}</p>
            )}
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Ship Anything<br />Anywhere
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 mt-2 tracking-wide">
              Fast • Reliable • Transparent<br />Logistics Services
            </p>
          </div>
          
          {/* Blue Indian cargo truck banner image matching Screen 2 */}
          <div className="relative w-36 h-24 flex items-center justify-end shrink-0">
            <img
              src="/images/hero/home-blue-truck.png"
              alt="CargoX Commercial Heavy Truck"
              className="max-h-24 w-auto object-contain drop-shadow-sm rounded-xl"
            />
          </div>
        </div>
      </section>

      {/* Main Booking Card (Trip type, Pickup, Drop, Get Quote) */}
      <section className="px-5 mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80">
          {/* Trip Selector Buttons */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/80 rounded-xl mb-4 text-xs font-semibold">
            <button
              onClick={() => setTripType("one-way")}
              className={`py-2 rounded-lg transition-all text-center ${
                tripType === "one-way"
                  ? "bg-[#1e60ff] text-white shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              One Way
            </button>
            <button
              onClick={() => setTripType("round-trip")}
              className={`py-2 rounded-lg transition-all text-center ${
                tripType === "round-trip"
                  ? "bg-[#1e60ff] text-white shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Round Trip
            </button>
            <button
              onClick={() => setTripType("multi-stop")}
              className={`py-2 rounded-lg transition-all text-center ${
                tripType === "multi-stop"
                  ? "bg-[#1e60ff] text-white shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Multi Stop
            </button>
          </div>

          {/* Location Selection Fields with aligned layout */}
          <div className="relative space-y-2.5">
            {/* Pickup Field */}
            <div
              onClick={onOpenPickup}
              role="button"
              tabIndex={0}
              className="group cursor-pointer flex items-center justify-between p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100 border border-slate-100 transition-all"
            >
              <div className="flex items-center gap-3 overflow-hidden pr-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-[#1e60ff] flex items-center justify-center shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1e60ff]" />
                </div>
                <div className="truncate text-left">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {isDetectingLocation ? "Detecting GPS..." : "PICKUP LOCATION"}
                  </p>
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {isDetectingLocation ? "Fetching your current location…" : (pickupAddress || "Use current location or search")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onUseCurrentLocation) {
                    onUseCurrentLocation();
                  } else {
                    onOpenPickup();
                  }
                }}
                disabled={isDetectingLocation}
                title="Detect Current GPS Location"
                className="flex items-center gap-1 text-[11px] font-bold text-[#1e60ff] hover:text-[#164ed9] px-2 py-1 rounded-md hover:bg-blue-50 transition-colors shrink-0"
              >
                <Crosshair className={`w-3.5 h-3.5 ${isDetectingLocation ? "animate-spin" : ""}`} />
                <span className="hidden xs:inline">Use Current</span>
              </button>
            </div>

            {/* Connecting Line between pickup and drop */}
            <div className="absolute left-[24px] top-[37px] w-0.5 h-3 bg-slate-200 pointer-events-none" />

            {/* Drop Field */}
            <div
              onClick={onOpenDrop}
              role="button"
              tabIndex={0}
              className="group cursor-pointer flex items-center justify-between p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100 border border-slate-100 transition-all"
            >
              <div className="flex items-center gap-3 overflow-hidden pr-2">
                <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div className="truncate text-left">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">DROP LOCATION</p>
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {dropAddress || "Search destination"}
                  </p>
                </div>
              </div>
              <div className="p-1 rounded-md text-slate-400 group-hover:text-[#1e60ff] transition-colors shrink-0">
                <Search className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Prominent Get Quote Button */}
          <button
            onClick={onGetQuote}
            className="w-full mt-4 bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.99] text-white py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all"
          >
            <span>Get Quote</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Quick Action Grid (Track Shipment, Bookings, Price Calculator, Support) matching Screenshot 2 */}
      <section className="px-5 mt-4">
        <div className="grid grid-cols-4 gap-2.5">
          {/* Track */}
          <button
            onClick={onQuickTrack}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs hover:border-blue-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e60ff] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <Navigation className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">
              Track<br />Shipment
            </span>
          </button>

          {/* Bookings */}
          <button
            onClick={onQuickBookings}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs hover:border-blue-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">
              My<br />Bookings
            </span>
          </button>

          {/* Price Calculator */}
          <button
            onClick={onQuickCalculator}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs hover:border-blue-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <Calculator className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">
              Price<br />Calculator
            </span>
          </button>

          {/* Support */}
          <button
            onClick={onQuickSupport}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs hover:border-blue-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <Headphones className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">
              Support
            </span>
          </button>
        </div>
      </section>

      {/* Popular Vehicles Section matching Screenshot 2 */}
      <section className="px-5 mt-5">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-bold text-slate-900">Popular Vehicles</h2>
          <button 
            onClick={onGetQuote}
            className="text-xs font-bold text-[#1e60ff] hover:underline flex items-center gap-0.5"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4 Clean Vehicle Cards matching visual reference */}
        <div className="grid grid-cols-4 gap-2">
          {popularTrucks.map((truck) => (
            <div
              key={truck.id}
              onClick={() => onSelectVehicleCategory(truck.name)}
              className="cursor-pointer bg-white border border-slate-100 rounded-xl p-2 flex flex-col items-center text-center shadow-2xs hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="w-full h-12 flex items-center justify-center mb-1 overflow-hidden">
                <img
                  src={truck.image}
                  alt={truck.name}
                  className="max-h-11 max-w-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <p className="text-[10px] font-bold text-slate-800 truncate w-full leading-tight">
                {truck.name.split(" ")[0]}<br />
                {truck.name.split(" ").slice(1).join(" ")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
