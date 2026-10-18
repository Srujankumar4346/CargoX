import { useState, useEffect } from "react";
import { Calculator, MapPin, Truck, Package, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "../../services/api";
import type { VehicleOption } from "./ChooseVehicleScreen";

interface QuickPriceCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToBook?: (distance: number, vehicle: VehicleOption, weightTons: number) => void;
  defaultDistanceKm?: number | null;
}

const VEHICLE_PRESETS: VehicleOption[] = [
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

export default function QuickPriceCalculatorModal({
  isOpen,
  onClose,
  onProceedToBook,
  defaultDistanceKm
}: QuickPriceCalculatorModalProps) {
  const [distanceKm, setDistanceKm] = useState<number>(defaultDistanceKm && defaultDistanceKm > 0 ? defaultDistanceKm : 45);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(null);
  const [cargoWeightTons, setCargoWeightTons] = useState<number>(1.5);
  const [specialHandling, setSpecialHandling] = useState<string>("None");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [estimateData, setEstimateData] = useState<any>(null);

  // Automatically clear vehicle selection if cargo weight exceeds its capacity
  useEffect(() => {
    if (selectedVehicle && selectedVehicle.maxPayloadTons && cargoWeightTons > selectedVehicle.maxPayloadTons) {
      setSelectedVehicle(null);
      setEstimateData(null);
    }
  }, [cargoWeightTons, selectedVehicle]);

  // Recalculate price estimate on inputs change
  useEffect(() => {
    if (!isOpen) return;

    if (!selectedVehicle || (selectedVehicle.maxPayloadTons && cargoWeightTons > selectedVehicle.maxPayloadTons)) {
      setEstimateData(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const calculatePrice = async () => {
      setIsLoading(true);
      try {
        const vehicleCapTons = selectedVehicle.maxPayloadTons || 2.0;
        const res = await api.getPricingEstimate(distanceKm, {
          weight_tons: cargoWeightTons,
          vehicle_capacity_tons: vehicleCapTons,
          special_handling: specialHandling
        });
        if (isMounted) {
          setEstimateData(res);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn("Pricing calculation error:", err);
          // Fallback realistic formula if backend quotation API is unreachable
          const baseFare = 200;
          const ratePerKm = selectedVehicle.maxPayloadTons && selectedVehicle.maxPayloadTons > 3 ? 35 : 20;
          const distCost = Math.round(distanceKm * ratePerKm);
          const handlingCost = specialHandling === "Fragile" ? 100 : specialHandling === "Hazardous" ? 200 : 0;
          const total = baseFare + distCost + handlingCost;
          setEstimateData({
            base_fare: baseFare,
            distance_charges: distCost,
            special_handling_surcharge: handlingCost,
            estimated_price: total
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      calculatePrice();
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, distanceKm, selectedVehicle, cargoWeightTons, specialHandling]);

  if (!isOpen) return null;

  const isEligibleVehicleSelected = selectedVehicle && selectedVehicle.maxPayloadTons
    ? cargoWeightTons <= selectedVehicle.maxPayloadTons
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Freight Price Calculator</h2>
              <p className="text-[10px] text-slate-500 font-medium">Real-time instant logistics tariff estimator</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Distance Input Slider + Manual Entry */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#1e60ff]" />
                <span>Trip Distance</span>
              </label>
              <div className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                <input
                  type="number"
                  min="1"
                  max="3000"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Math.max(1, Number(e.target.value) || 1))}
                  className="w-14 text-right font-black text-slate-900 text-xs outline-hidden"
                />
                <span className="text-slate-400 font-semibold text-[11px]">km</span>
              </div>
            </div>
            <input
              type="range"
              min="5"
              max="500"
              step="5"
              value={distanceKm}
              onChange={(e) => setDistanceKm(Number(e.target.value))}
              className="w-full accent-[#1e60ff] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
              <span>5 km (Local)</span>
              <span>150 km (Regional)</span>
              <span>500+ km (Intercity)</span>
            </div>
          </div>

          {/* Vehicle Selection */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-bold flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span>Select Commercial Vehicle</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {VEHICLE_PRESETS.map((v) => {
                const isSelected = selectedVehicle?.id === v.id;
                const isEligible = v.maxPayloadTons ? cargoWeightTons <= v.maxPayloadTons : false;

                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!isEligible}
                    onClick={() => {
                      if (!isEligible) return;
                      setSelectedVehicle(v);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      !isEligible
                        ? "opacity-50 bg-slate-100/80 border-slate-200 cursor-not-allowed"
                        : isSelected
                        ? "border-[#1e60ff] bg-blue-50/40 shadow-xs ring-1 ring-[#1e60ff] cursor-pointer"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer"
                    }`}
                  >
                    <img src={v.image} alt={v.name} className="w-9 h-7 object-contain shrink-0" />
                    <div className="overflow-hidden flex-1">
                      <p className={`text-[11px] font-bold truncate ${isSelected ? "text-[#1e60ff]" : "text-slate-800"}`}>
                        {v.name}
                      </p>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-semibold">{v.capacity.split(" ")[0]} Ton</span>
                        {!isEligible && (
                          <span className="text-[9px] font-extrabold text-red-600 bg-red-50 px-1 py-0.2 rounded border border-red-200/60 shrink-0">
                            Insufficient capacity
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cargo Weight & Special Handling */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
              <label className="text-slate-700 font-bold flex items-center gap-1 mb-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cargo Weight</span>
              </label>
              <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1.5 rounded-xl">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="20"
                  value={cargoWeightTons}
                  onChange={(e) => setCargoWeightTons(Math.max(0.1, Number(e.target.value) || 0.1))}
                  className="w-full text-slate-900 font-bold text-xs outline-hidden"
                />
                <span className="text-[10px] text-slate-400 font-semibold shrink-0">Tons</span>
              </div>
            </div>

            <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
              <label className="text-slate-700 font-bold block mb-1.5">Handling</label>
              <select
                value={specialHandling}
                onChange={(e) => setSpecialHandling(e.target.value)}
                className="w-full bg-white border border-slate-200 px-2 py-1.5 rounded-xl text-slate-800 font-bold text-xs outline-hidden"
              >
                <option value="None">Standard</option>
                <option value="Fragile">Fragile (+₹100)</option>
                <option value="Hazardous">Hazardous (+₹200)</option>
              </select>
            </div>
          </div>

          {/* No Eligible Vehicles notice */}
          {!VEHICLE_PRESETS.some((v) => v.maxPayloadTons && cargoWeightTons <= v.maxPayloadTons) && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 flex items-center gap-2.5 text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <p className="text-[11px] font-semibold leading-tight">
                No vehicle can transport {cargoWeightTons} Tons. Please reduce cargo weight or contact CargoX Heavy Freight.
              </p>
            </div>
          )}

          {/* Price Calculation Output Box */}
          <div className="bg-gradient-to-br from-slate-900 to-[#0b1329] text-white p-4 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimated Total Fare</span>
                <p className="text-[10px] text-slate-400 font-medium">Includes base freight & distance charges</p>
              </div>
              <div className="text-right">
                {!selectedVehicle ? (
                  <span className="text-xs font-semibold text-amber-300">Choose eligible vehicle</span>
                ) : isLoading ? (
                  <div className="flex items-center gap-1 text-slate-300">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#1e60ff]" />
                    <span className="text-xs">Computing...</span>
                  </div>
                ) : (
                  <span className="text-2xl font-black tracking-tight text-white">
                    ₹{(
                      Number(estimateData?.estimated_total) || 
                      Number(estimateData?.estimated_price) || 
                      Number(estimateData?.total_price) || 
                      0
                    ).toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </div>

            {/* Breakdown line items or prompt to select vehicle */}
            {!selectedVehicle ? (
              <div className="pt-3 pb-1 text-center">
                <p className="text-xs text-slate-400 font-medium">
                  Please tap an eligible commercial vehicle above to calculate your exact trip tariff.
                </p>
              </div>
            ) : estimateData && !isLoading ? (
              <div className="pt-2.5 space-y-1 text-[11px] text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Base Freight:</span>
                  <span>₹{Number(estimateData.base_fare ?? 200).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Distance Charges ({distanceKm} km):</span>
                  <span>₹{Number(estimateData.distance_charge ?? estimateData.distance_charges ?? Math.round(distanceKm * 20)).toLocaleString("en-IN")}</span>
                </div>
                {Number(estimateData.capacity_surcharge) > 0 && (
                  <div className="flex justify-between text-amber-300">
                    <span>Near Max Capacity Fee (≥85%):</span>
                    <span>+₹{Number(estimateData.capacity_surcharge).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {(Number(estimateData.handling_surcharge) > 0 || Number(estimateData.special_handling_surcharge) > 0) && (
                  <div className="flex justify-between text-indigo-300">
                    <span>Handling Fee ({specialHandling}):</span>
                    <span>+₹{Number(estimateData.handling_surcharge || estimateData.special_handling_surcharge).toLocaleString("en-IN")}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            disabled={!isEligibleVehicleSelected}
            onClick={() => {
              if (!isEligibleVehicleSelected || !selectedVehicle) return;
              onClose();
              if (onProceedToBook) {
                onProceedToBook(distanceKm, selectedVehicle, cargoWeightTons);
              }
            }}
            className={`w-2/3 py-2.5 rounded-xl text-xs font-extrabold transition-colors shadow-sm flex items-center justify-center gap-1.5 ${
              isEligibleVehicleSelected
                ? "bg-[#1e60ff] text-white hover:bg-blue-600 cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <span>
              {!selectedVehicle
                ? "Choose Vehicle First"
                : !isEligibleVehicleSelected
                ? "Insufficient Capacity"
                : "Book This Vehicle"}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
