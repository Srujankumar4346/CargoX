import { useState, useEffect } from "react";
import { ArrowLeft, Check, AlertTriangle, PhoneCall } from "lucide-react";
import { api } from "../../services/api";

export interface VehicleOption {
  id: string;
  name: string;
  category: "Mini Trucks" | "Pickup Trucks" | "Medium Trucks" | "Heavy Trucks";
  capacity: string;
  maxPayloadTons: number;
  maxPayloadKg: number;
  dimensions: string;
  description: string;
  price: number;
  image: string;
}

interface ChooseVehicleScreenProps {
  onBack: () => void;
  onSelectVehicle: (vehicle: VehicleOption) => void;
  selectedVehicleId?: string;
  calculatedDistanceKm?: number;
  cargoWeightTons?: number;
  specialHandling?: string;
}

export default function ChooseVehicleScreen({
  onBack,
  onSelectVehicle,
  selectedVehicleId = "bolero",
  calculatedDistanceKm = 275,
  cargoWeightTons = 1.8,
  specialHandling = "None"
}: ChooseVehicleScreenProps) {
  const [filter, setFilter] = useState<"All" | "Mini Trucks" | "Pickup Trucks" | "Medium Trucks" | "Heavy Trucks">("All");
  const [vehiclePrices, setVehiclePrices] = useState<Record<string, number>>({});

  const cargoWeightKg = Math.round((cargoWeightTons || 0) * 1000);

  const allVehicles: VehicleOption[] = [
    {
      id: "tata-ace",
      name: "Tata Ace Gold",
      category: "Mini Trucks",
      capacity: "1.0 Ton (1,000 kg)",
      maxPayloadTons: 1.0,
      maxPayloadKg: 1000,
      dimensions: "8 x 4.5 ft",
      description: "Best for small city cargo",
      price: 5200,
      image: "/images/vehicles/tata-ace-gold.png"
    },
    {
      id: "dost",
      name: "Ashok Leyland Dost",
      category: "Pickup Trucks",
      capacity: "1.5 Ton (1,500 kg)",
      maxPayloadTons: 1.5,
      maxPayloadKg: 1500,
      dimensions: "10 x 5.5 ft",
      description: "Suitable for city and short trips",
      price: 6900,
      image: "/images/vehicles/ashok-leyland-dost.png"
    },
    {
      id: "bolero",
      name: "Mahindra Bolero Pik-Up",
      category: "Pickup Trucks",
      capacity: "2.0 Ton (2,000 kg)",
      maxPayloadTons: 2.0,
      maxPayloadKg: 2000,
      dimensions: "10 x 5.5 ft",
      description: "Best for general cargo",
      price: 7850,
      image: "/images/vehicles/mahindra-bolero-pikup.png"
    },
    {
      id: "tata-intra",
      name: "Tata Intra V30",
      category: "Medium Trucks",
      capacity: "2.5 Ton (2,500 kg)",
      maxPayloadTons: 2.5,
      maxPayloadKg: 2500,
      dimensions: "10 x 6 ft",
      description: "Best for medium cargo",
      price: 9800,
      image: "/images/vehicles/tata-intra-v30.png"
    },
    {
      id: "eicher-pro",
      name: "Eicher Pro 2049",
      category: "Heavy Trucks",
      capacity: "5.0 Ton (5,000 kg)",
      maxPayloadTons: 5.0,
      maxPayloadKg: 5000,
      dimensions: "14 x 7 ft",
      description: "Heavy haul carrier for bulk & machinery cargo",
      price: 14500,
      image: "/images/vehicles/col5_full.png"
    },
    {
      id: "bharatbenz-1015r",
      name: "BharatBenz 1015R",
      category: "Heavy Trucks",
      capacity: "6.0 Ton (6,000 kg)",
      maxPayloadTons: 6.0,
      maxPayloadKg: 6000,
      dimensions: "17 x 7.5 ft",
      description: "High capacity intercity freight transporter",
      price: 18200,
      image: "/images/vehicles/screen6_full.png"
    }
  ];

  // STRICT CAPACITY VALIDATION:
  // A vehicle is eligible only when vehicle.max_payload_kg >= cargo.weight_kg
  const eligibleVehicles = allVehicles.filter(
    (v) => v.maxPayloadKg >= cargoWeightKg
  );

  const displayedVehicles = filter === "All"
    ? eligibleVehicles
    : eligibleVehicles.filter((v) => v.category === filter);

  // Fetch verified backend pricing dynamically only for eligible vehicles
  useEffect(() => {
    let isMounted = true;
    eligibleVehicles.forEach((v) => {
      api.getPricingEstimate(calculatedDistanceKm, {
        weight_tons: cargoWeightTons,
        vehicle_capacity_tons: v.maxPayloadTons,
        special_handling: specialHandling
      })
        .then((res) => {
          if (isMounted && res && res.estimated_total) {
            setVehiclePrices((prev) => ({
              ...prev,
              [v.id]: Math.round(Number(res.estimated_total))
            }));
          }
        })
        .catch(() => { });
    });

    return () => { isMounted = false; };
  }, [calculatedDistanceKm, cargoWeightTons, specialHandling]);

  return (
    <div className="h-full bg-slate-50 text-slate-800 flex flex-col justify-between overflow-hidden select-none">
      <div className="flex-1 overflow-y-auto pb-6">
        {/* Top Header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100 shadow-xs">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Choose Vehicle</h1>
          <div className="w-6" />
        </div>

        {/* Step Progress Bar */}
        <div className="bg-white px-6 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
            <div className="absolute top-1/2 left-0 w-2/3 h-0.5 bg-[#1e60ff] -translate-y-1/2 z-0" />

            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-[#1e60ff] text-white flex items-center justify-center text-xs">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] text-slate-400 font-semibold mt-1">Location</span>
            </div>

            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-[#1e60ff] text-white flex items-center justify-center text-xs">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] text-slate-400 font-semibold mt-1">Cargo</span>
            </div>

            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-[#1e60ff] text-white flex items-center justify-center text-xs font-bold">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] text-[#1e60ff] font-bold mt-1">Vehicle</span>
            </div>

            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-xs">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
              </div>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Review</span>
            </div>
          </div>
        </div>

        {/* Cargo Weight Banner */}
        <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100/60 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">Your Cargo Weight:</span>
          <span className="font-extrabold text-[#1e60ff]">
            {cargoWeightTons} Ton ({cargoWeightKg.toLocaleString("en-IN")} kg)
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(["All", "Mini Trucks", "Pickup Trucks", "Medium Trucks", "Heavy Trucks"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${filter === cat
                  ? "bg-[#1e60ff] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Statutory Pricing Notice */}
        <div className="mx-4 mb-2 p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-[10px] text-slate-600 leading-tight">
          ℹ️ <strong>Standard Freight Rates:</strong> Vehicle quotes cover transport haulage. Toll charges, statutory taxes, and state border permits are excluded unless explicitly itemized.
        </div>

        {/* Empty State: When no vehicle can carry the cargo weight */}
        {eligibleVehicles.length === 0 ? (
          <div className="px-6 py-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-2">No Suitable Vehicle Available</h3>
            <p className="text-xs text-slate-600 max-w-sm leading-relaxed mb-6">
              No suitable vehicle is currently available for this cargo weight ({cargoWeightTons} Ton / {cargoWeightKg.toLocaleString("en-IN")} kg).
              Please contact CargoX support or choose another delivery arrangement.
            </p>
            <button
              onClick={() => alert("CargoX Heavy Haul Support: 1800-CARGO-X | support@cargox.com")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1e60ff] text-white text-xs font-bold hover:bg-[#164ed9] shadow-md transition-all"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Contact CargoX Support</span>
            </button>
          </div>
        ) : (
          /* Eligible Vehicle Cards List */
          <div className="px-4 space-y-3 mt-1">
            {displayedVehicles.map((v) => {
              const isSelected = selectedVehicleId === v.id;
              const dynamicPrice = vehiclePrices[v.id] || v.price;
              const utilization = (cargoWeightTons / v.maxPayloadTons) * 100;
              const isNearMax = utilization >= 85;

              return (
                <div
                  key={v.id}
                  className={`bg-white rounded-2xl p-3 border transition-all flex items-center gap-3 shadow-xs ${isSelected ? "border-[#1e60ff] ring-2 ring-blue-500/10" : "border-slate-100 hover:border-slate-300"
                    }`}
                >
                  {/* Truck Photo */}
                  <div className="w-24 h-20 bg-slate-50 rounded-xl p-1 flex items-center justify-center shrink-0 border border-slate-100">
                    <img
                      src={v.image}
                      alt={v.name}
                      className="max-h-16 max-w-full object-contain"
                    />
                  </div>

                  {/* Truck Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h2 className="text-xs font-extrabold text-slate-900 truncate">{v.name}</h2>
                      {isNearMax && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                          Near Max Cap (+Fee)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                      <p className="flex items-center gap-1 font-semibold text-slate-700">
                        <span className="text-slate-400">⚖ Max Payload:</span> {v.maxPayloadKg.toLocaleString("en-IN")} kg ({v.maxPayloadTons} Ton)
                      </p>
                      <p className="flex items-center gap-1">
                        <span className="text-slate-400">📐</span> {v.dimensions}
                      </p>
                      <p className="text-slate-400 truncate">{v.description}</p>
                    </div>

                    {/* Price and Select Button */}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-[#1e60ff]">
                        ₹{dynamicPrice.toLocaleString("en-IN")}
                      </span>
                      <button
                        onClick={() => onSelectVehicle({ ...v, price: dynamicPrice })}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${isSelected
                            ? "bg-[#1e60ff] text-white shadow-xs"
                            : "bg-[#1e60ff] text-white hover:bg-[#164ed9]"
                          }`}
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
