import { useState, useEffect } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { api } from "../../services/api";

export interface FleetVehicleItem {
  id: string;
  name: string;
  capacityText: string;
  maxPayloadKg: number;
  maxPayloadTons: number;
  etaText: string;
  price: number;
  image: string;
  isPartLoad?: boolean;
}

interface VehicleSelectionWithPartLoadProps {
  onBack: () => void;
  onSelectVehicle: (vehicle: FleetVehicleItem) => void;
  calculatedDistanceKm?: number;
  cargoWeightKg?: number;
}

export default function VehicleSelectionWithPartLoadScreen({
  onBack,
  onSelectVehicle,
  calculatedDistanceKm = 3,
  cargoWeightKg = 200,
}: VehicleSelectionWithPartLoadProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("part-load");
  const [vehiclePrices, setVehiclePrices] = useState<Record<string, number>>({});

  // Ensure effectiveKm reflects the actual trip distance (minimum 1 km, default 3 km)
  const effectiveKm = Math.max(1, Number(calculatedDistanceKm) || 3);

  // 1. Recommended Part Load (Shared Truck) card with dynamic distance-based pricing
  // Base rate ~₹250 flat + ₹14/km + weight factor, ensuring high accuracy for both local & intercity
  const partLoadDynamicPrice = Math.max(
    320,
    Math.round(250 + (effectiveKm * 14) + ((cargoWeightKg || 200) * 0.45))
  );

  const partLoadVehicle: FleetVehicleItem = {
    id: "part-load",
    name: "Part Load (Shared Truck)",
    capacityText: "1-3000 kgs",
    maxPayloadKg: 3000,
    maxPayloadTons: 3.0,
    etaText: "Today, 9:00 AM",
    price: partLoadDynamicPrice,
    image: "/images/vehicles/ashok-leyland-dost.png",
    isPartLoad: true,
  };

  // 2. Full Truck Fleet matching Screen 5 in reference with realistic per-km scaling
  // Tata Ace: ~₹250 base + ₹25/km -> 3 km = ~₹350
  const fullTruckFleet: FleetVehicleItem[] = [
    {
      id: "tata-ace",
      name: "Tata Ace",
      capacityText: "750 kg",
      maxPayloadKg: 750,
      maxPayloadTons: 0.75,
      etaText: "8 mins",
      price: Math.max(350, Math.round(250 + effectiveKm * 25)),
      image: "/images/vehicles/tata-ace-gold.png",
    },
    {
      id: "pickup-8ft",
      name: "Pickup 8ft",
      capacityText: "1200 kg",
      maxPayloadKg: 1200,
      maxPayloadTons: 1.2,
      etaText: "4 mins",
      price: Math.max(450, Math.round(300 + effectiveKm * 28)),
      image: "/images/vehicles/card_ref_dost.png",
    },
    {
      id: "pickup-9ft",
      name: "Pickup 9ft",
      capacityText: "1700 kg",
      maxPayloadKg: 1700,
      maxPayloadTons: 1.7,
      etaText: "5 mins",
      price: Math.max(550, Math.round(350 + effectiveKm * 30)),
      image: "/images/vehicles/mahindra-bolero-pikup.png",
    },
    {
      id: "14ft-open",
      name: "14ft (Open)",
      capacityText: "3500 kg",
      maxPayloadKg: 3500,
      maxPayloadTons: 3.5,
      etaText: "5 mins",
      price: Math.max(900, Math.round(500 + effectiveKm * 45)),
      image: "/images/vehicles/col5_full.png",
    },
    {
      id: "14ft-closed",
      name: "14ft (Closed)",
      capacityText: "3500 kg",
      maxPayloadKg: 3500,
      maxPayloadTons: 3.5,
      etaText: "3 mins",
      price: Math.max(950, Math.round(520 + effectiveKm * 46)),
      image: "/images/vehicles/col5_full.png",
    },
    {
      id: "17ft-closed",
      name: "17ft Closed",
      capacityText: "6000 kg",
      maxPayloadKg: 6000,
      maxPayloadTons: 6.0,
      etaText: "30 mins",
      price: Math.max(1200, Math.round(650 + effectiveKm * 58)),
      image: "/images/vehicles/screen6_full.png",
    },
  ];

  // Fetch verified backend pricing dynamically based on actual trip distance
  useEffect(() => {
    let isMounted = true;
    fullTruckFleet.forEach((v) => {
      api.getPricingEstimate(effectiveKm, {
        weight_tons: (cargoWeightKg || 200) / 1000,
        vehicle_capacity_tons: v.maxPayloadTons,
      })
        .then((res) => {
          if (isMounted && res && res.estimated_total) {
            setVehiclePrices((prev) => ({
              ...prev,
              [v.id]: Math.round(Number(res.estimated_total)),
            }));
          }
        })
        .catch(() => {});
    });

    return () => { isMounted = false; };
  }, [effectiveKm, cargoWeightKg]);

  const allList = [partLoadVehicle, ...fullTruckFleet];
  const activeSelected = allList.find((v) => v.id === selectedVehicleId) || partLoadVehicle;

  const handleProceed = () => {
    const finalPrice = activeSelected.id === "part-load"
      ? partLoadVehicle.price
      : (vehiclePrices[activeSelected.id] || activeSelected.price);
    onSelectVehicle({
      ...activeSelected,
      price: finalPrice,
    });
  };

  return (
    <div className="h-full bg-[#f4f7fb] text-slate-900 flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header matching Screen 5 */}
      <div className="bg-white px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3 flex items-center gap-3 border-b border-slate-100 shadow-2xs shrink-0">
        <button
          onClick={onBack}
          className="p-1 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-extrabold text-slate-900">Select Vehicle</h1>
      </div>

      {/* Vehicles List Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Recommended Part Load Section */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Recommended</p>

          <div
            onClick={() => setSelectedVehicleId("part-load")}
            role="button"
            tabIndex={0}
            className={`bg-white rounded-2xl p-4 border-2 transition-all cursor-pointer relative shadow-xs ${
              selectedVehicleId === "part-load"
                ? "border-[#0866F5] bg-blue-50/20 ring-2 ring-blue-500/10"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-20 h-16 bg-slate-50 rounded-xl p-1 flex items-center justify-center">
                  <img
                    src={partLoadVehicle.image}
                    alt="Part Load Shared Truck"
                    className="max-h-14 max-w-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black text-slate-900">{partLoadVehicle.name}</p>
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                    {partLoadVehicle.capacityText} • {partLoadVehicle.etaText}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-semibold">Starts at</p>
                <p className="text-sm font-black text-[#0866F5]">
                  ₹{partLoadVehicle.price.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Others from Trucks Section matching Screen 5 */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Others from Trucks</p>

          <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100 shadow-2xs overflow-hidden">
            {fullTruckFleet.map((v) => {
              const isSelected = selectedVehicleId === v.id;
              const dynamicPrice = vehiclePrices[v.id] || v.price;
              const isOverloaded = cargoWeightKg > v.maxPayloadKg;

              return (
                <div
                  key={v.id}
                  onClick={() => {
                    if (!isOverloaded) setSelectedVehicleId(v.id);
                  }}
                  role="button"
                  tabIndex={0}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? "bg-blue-50/50" : isOverloaded ? "opacity-40 cursor-not-allowed bg-slate-50/80" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-12 bg-slate-50 rounded-lg p-1 flex items-center justify-center shrink-0">
                      <img
                        src={v.image}
                        alt={v.name}
                        className="max-h-10 max-w-full object-contain"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-slate-900">{v.name}</p>
                        {isOverloaded && (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 rounded">Over capacity</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {v.capacityText} • {v.etaText}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">
                      ₹{dynamicPrice.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Prominent Sticky Action Button matching Screen 5: "Proceed with Part Load" */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <button
          onClick={handleProceed}
          className="w-full bg-[#0866F5] hover:bg-[#0652c5] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/25 transition-all flex items-center justify-center"
        >
          {selectedVehicleId === "part-load"
            ? "Proceed with Part Load"
            : `Proceed with ${activeSelected.name}`}
        </button>
      </div>
    </div>
  );
}
