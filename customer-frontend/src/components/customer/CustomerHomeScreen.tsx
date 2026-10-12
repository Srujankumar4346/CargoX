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

  const userName = user?.firstName || user?.fullName?.split(" ")[0] || "Customer";

  const popularTrucks = [
    {
      id: "bolero",
      name: "Bolero Pik-Up",
      capacity: "2 Ton",
      image: "/images/vehicles/mahindra-bolero-pikup.png",
    },
    {
      id: "tata-ace",
      name: "Tata Ace",
      capacity: "1 Ton",
      image: "/images/vehicles/tata-ace-gold.png",
    },
    {
      id: "dost",
      name: "Dost",
      capacity: "1.5 Ton",
      image: "/images/vehicles/ashok-leyland-dost.png",
    },
    {
      id: "tata-intra",
      name: "Tata Intra",
      capacity: "2.5 Ton",
      image: "/images/vehicles/tata-intra-v30.png",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-24 select-none">
      {/* Top Header Bar */}
      <header className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-2xl font-black text-slate-900 tracking-tight font-display">Cargo</span>
          <span className="text-2xl font-black text-[#1e60ff] tracking-tight font-display">X</span>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onQuickSupport}
            aria-label="Notifications" 
            className="relative p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          </button>
          <UserButton />
        </div>
      </header>

      {/* Hero Welcome Banner */}
      <section className="px-5 mt-2">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-50/80 to-indigo-50/40 rounded-2xl p-4 flex items-center justify-between border border-blue-100/60 shadow-sm">
          <div className="z-10 max-w-[62%]">
            <p className="text-xs font-semibold text-slate-500">Hello, {userName}</p>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight mt-0.5">
              Ship Anything<br />Anywhere
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 mt-2">
              Fast · Reliable · Transparent
            </p>
          </div>
          {/* Blue Indian cargo truck banner image matching Screen 2 */}
          <div className="relative w-36 h-24 flex items-center justify-end -mr-2 shrink-0">
            <img
              src="/images/hero/home-blue-truck.png"
              alt="CargoX Shipping Truck"
              className="max-h-24 w-auto object-contain drop-shadow-md rounded-r-xl"
            />
          </div>
        </div>
      </section>

      {/* Main Booking Card (Trip type, Pickup, Drop, Get Quote) */}
      <section className="px-5 mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          {/* Trip Selector Buttons */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-semibold">
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

          {/* Location Selection Fields */}
          <div className="relative space-y-3">
            {/* Pickup Field */}
            <div
              onClick={onOpenPickup}
              className="group cursor-pointer flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 transition-all"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-[#1e60ff] flex items-center justify-center shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1e60ff]" />
                </div>
                <div className="truncate text-left">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Pickup Location</p>
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {pickupAddress || "Use Current Location"}
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
                title="Detect Current GPS Location"
                className="p-1 hover:bg-blue-100 rounded-lg text-slate-400 hover:text-[#1e60ff] transition-colors shrink-0"
              >
                <Crosshair className="w-4 h-4" />
              </button>
            </div>

            {/* Connecting Line between pickup and drop */}
            <div className="absolute left-[23px] top-[34px] w-0.5 h-4 bg-slate-200 pointer-events-none" />

            {/* Drop Field */}
            <div
              onClick={onOpenDrop}
              className="group cursor-pointer flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 transition-all"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div className="truncate text-left">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Drop Location</p>
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {dropAddress || "Enter Destination"}
                  </p>
                </div>
              </div>
              <Search className="w-4 h-4 text-slate-400 group-hover:text-[#1e60ff] transition-colors shrink-0" />
            </div>
          </div>

          {/* Prominent Get Quote Button */}
          <button
            onClick={onGetQuote}
            className="w-full mt-4 bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.99] text-white py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all"
          >
            <span>Get Quote</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Quick Action Grid (Track Shipment, Bookings, Price Calculator, Support) */}
      <section className="px-5 mt-4">
        <div className="grid grid-cols-4 gap-2.5">
          {/* Track */}
          <button
            onClick={onQuickTrack}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-xs hover:border-blue-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <Navigation className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">
              Track<br />Shipment
            </span>
          </button>

          {/* Bookings */}
          <button
            onClick={onQuickBookings}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-xs hover:border-blue-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e60ff] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">
              Bookings
            </span>
          </button>

          {/* Price Calculator */}
          <button
            onClick={onQuickCalculator}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-xs hover:border-blue-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <Calculator className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">
              Price<br />Calculator
            </span>
          </button>

          {/* Support */}
          <button
            onClick={onQuickSupport}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white border border-slate-100 shadow-xs hover:border-blue-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <Headphones className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">
              Support
            </span>
          </button>
        </div>
      </section>

      {/* Local Trucks / Popular Vehicles Section */}
      <section className="px-5 mt-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Local Trucks</h2>
            <p className="text-[11px] text-slate-500">For All Your Cargo Needs</p>
          </div>
          <button 
            onClick={onGetQuote}
            className="text-xs font-bold text-[#1e60ff] hover:underline flex items-center gap-0.5"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Horizontal Truck Scroller */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
          {popularTrucks.map((truck) => (
            <div
              key={truck.id}
              onClick={() => onSelectVehicleCategory(truck.name)}
              className="cursor-pointer shrink-0 w-28 bg-white border border-slate-100 rounded-xl p-2 flex flex-col items-center text-center shadow-xs hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="w-full h-14 flex items-center justify-center mb-1">
                <img
                  src={truck.image}
                  alt={truck.name}
                  className="max-h-12 max-w-full object-contain"
                />
              </div>
              <p className="text-[10px] font-bold text-slate-800 truncate w-full">{truck.name}</p>
              <span className="text-[9px] font-semibold text-slate-400">{truck.capacity}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
