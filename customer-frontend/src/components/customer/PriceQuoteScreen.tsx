import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import type { VehicleOption } from "./ChooseVehicleScreen";

interface PriceQuoteScreenProps {
  onBack: () => void;
  onEditRoute: () => void;
  onChangeVehicle: () => void;
  onProceedToBooking: (finalCalculatedPrice: number) => void;
  pickupAddress: string;
  dropAddress: string;
  distanceKm: number;   // Must be from a real OSRM route response
  durationStr: string;
  vehicle: VehicleOption;
  cargoData?: {
    cargoType: string;
    weightTons: number;
    specialHandling: string;
  };
}

import { useState, useEffect } from "react";
import { api } from "../../services/api";

export default function PriceQuoteScreen({
  onBack,
  onEditRoute,
  onChangeVehicle,
  onProceedToBooking,
  pickupAddress,
  dropAddress,
  distanceKm,
  durationStr,
  vehicle,
  cargoData
}: PriceQuoteScreenProps) {
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [baseFare, setBaseFare] = useState<number | null>(null);
  const [distanceCharges, setDistanceCharges] = useState<number | null>(null);
  const [capacitySurcharge, setCapacitySurcharge] = useState(0);
  const [handlingSurcharge, setHandlingSurcharge] = useState(0);

  const parseCapacityTons = (capStr: string): number => {
    const match = capStr.match(/([\d.]+)\s*Ton/i) || capStr.match(/(\d+)/);
    return match ? parseFloat(match[1]) : 2.0;
  };

  useEffect(() => {
    let isMounted = true;
    setPricingLoading(true);
    setPricingError(null);
    setEstimatedPrice(null);
    const vehicleCap = vehicle.maxPayloadTons || parseCapacityTons(vehicle.capacity);
    const weight = cargoData?.weightTons || 1.5;
    const handling = cargoData?.specialHandling || "None";

    if (weight > vehicleCap) {
      setPricingError(`Cargo weight (${weight}T) exceeds vehicle capacity (${vehicleCap}T). Please select a higher-capacity vehicle.`);
      setPricingLoading(false);
      return;
    }

    api.getPricingEstimate(distanceKm, {
      weight_tons: weight,
      vehicle_capacity_tons: vehicleCap,
      special_handling: handling
    })
      .then((res) => {
        if (!isMounted) return;
        if (res && res.estimated_total) {
          const total = Math.round(Number(res.estimated_total));
          setEstimatedPrice(total);
          setBaseFare(res.base_fare != null ? Math.round(Number(res.base_fare)) : null);
          setDistanceCharges(res.distance_charge != null ? Math.round(Number(res.distance_charge)) : null);
          setCapacitySurcharge(Math.round(Number(res.capacity_surcharge || 0)));
          setHandlingSurcharge(Math.round(Number(res.handling_surcharge || 0)));
        } else {
          setPricingError("Pricing data unavailable. Please go back and retry.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setPricingError(err?.message || "Unable to retrieve pricing from the server. Please go back and try again.");
      })
      .finally(() => { if (isMounted) setPricingLoading(false); });
    return () => { isMounted = false; };
  }, [distanceKm, vehicle, cargoData]);

  const remainingKm = Math.max(0, distanceKm - 50);

  return (
    <div className="h-full bg-slate-50 text-slate-800 flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100 shadow-xs shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900">Price Quote</h1>
        <div className="w-6" />
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Route Details Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-900">Route Details</h2>
              <button
                onClick={onEditRoute}
                className="text-xs font-bold text-[#1e60ff] hover:underline flex items-center gap-1"
              >
                Edit
              </button>
            </div>

            <div className="space-y-3 relative">
              {/* Pickup */}
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-[#1e60ff] flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#1e60ff]" />
                </div>
                <p className="text-xs font-semibold text-slate-700 leading-tight">
                  {pickupAddress || "—"}
                </p>
              </div>

              {/* Connecting line */}
              <div className="absolute left-2.5 top-4 w-0.5 h-6 bg-slate-200 pointer-events-none" />

              {/* Drop */}
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3 h-3" />
                </div>
                <p className="text-xs font-semibold text-slate-700 leading-tight">
                  {dropAddress || "—"}
                </p>
              </div>
            </div>

            {/* Distance & Time Pills matching Screen 7 */}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
              <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-slate-400 font-semibold">Distance</p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">{distanceKm} km</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-slate-400 font-semibold">Estimated Time</p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">{durationStr}</p>
              </div>
            </div>
          </div>

          {/* Selected Vehicle Card matching Screen 7 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-slate-900">Selected Vehicle</h2>
              <button
                onClick={onChangeVehicle}
                className="text-xs font-bold text-[#1e60ff] hover:underline"
              >
                Change
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-16 h-14 bg-slate-50 rounded-xl p-1 flex items-center justify-center shrink-0 border border-slate-100">
                <img
                  src={vehicle.image}
                  alt={vehicle.name}
                  className="max-h-12 max-w-full object-contain"
                />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900">{vehicle.name}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {vehicle.capacity} | {vehicle.dimensions}
                </p>
              </div>
            </div>
          </div>

          {/* Price Breakdown Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
            <h2 className="text-xs font-bold text-slate-900 mb-3">Price Breakdown</h2>

            {pricingLoading && (
              <div className="space-y-2 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-3 w-32 bg-slate-100 rounded" />
                    <div className="h-3 w-16 bg-slate-100 rounded" />
                  </div>
                ))}
                <div className="mt-4 h-10 bg-slate-100 rounded-xl" />
              </div>
            )}

            {!pricingLoading && pricingError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-xs font-semibold text-red-700">⚠️ {pricingError}</p>
                <button
                  onClick={() => onBack()}
                  className="mt-2 text-xs font-bold text-[#1e60ff] hover:underline"
                >
                  ← Go back and retry
                </button>
              </div>
            )}

            {!pricingLoading && !pricingError && estimatedPrice !== null && (
              <div className="space-y-2 text-xs">
                {baseFare !== null && (
                  <div className="flex justify-between text-slate-600">
                    <span>Base Fare</span>
                    <span className="font-semibold text-slate-800">₹{baseFare.toLocaleString("en-IN")}</span>
                  </div>
                )}
                {distanceCharges !== null && (
                  <div className="flex justify-between text-slate-600">
                    <span>Distance Charges ({remainingKm} km)</span>
                    <span className="font-semibold text-slate-800">₹{distanceCharges.toLocaleString("en-IN")}</span>
                  </div>
                )}

                {capacitySurcharge > 0 && (
                  <div className="flex justify-between text-amber-700 bg-amber-50/70 px-2 py-1 rounded-lg">
                    <span className="font-medium">Near Vehicle Max Capacity Surcharge</span>
                    <span className="font-bold">+₹{capacitySurcharge.toLocaleString("en-IN")}</span>
                  </div>
                )}

                {handlingSurcharge > 0 && (
                  <div className="flex justify-between text-blue-700 bg-blue-50/70 px-2 py-1 rounded-lg">
                    <span className="font-medium">Special Handling ({cargoData?.specialHandling || "Care/Fragile"})</span>
                    <span className="font-bold">+₹{handlingSurcharge.toLocaleString("en-IN")}</span>
                  </div>
                )}

                {/* Total */}
                <div className="mt-4 bg-emerald-50 rounded-xl p-3 flex items-center justify-between border border-emerald-100">
                  <span className="text-xs font-bold text-emerald-800">Total Estimated Price</span>
                  <span className="text-base font-extrabold text-emerald-600">
                    ₹{estimatedPrice.toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Statutory Disclaimer matching Part 7 */}
                <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-[10px] text-amber-900 leading-relaxed font-medium">
                  <strong>Notice:</strong> Delivery price only. Toll charges, applicable taxes, permits, parking, and other statutory or route-related charges are excluded unless explicitly listed in this quotation. Additional applicable charges may be payable separately.
                </div>
              </div>
            )}
          </div>
      </div>

      {/* Proceed to Booking Button — always pinned to the bottom */}
      <div className="shrink-0 p-4 bg-white border-t border-slate-100 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] z-20">
        <button
          disabled={pricingLoading || pricingError !== null || estimatedPrice === null}
          onClick={() => estimatedPrice !== null && onProceedToBooking(estimatedPrice)}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
            !pricingLoading && pricingError === null && estimatedPrice !== null
              ? "bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white shadow-blue-500/25"
              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
          }`}
        >
          <span>
            {pricingLoading ? "Fetching price..." : pricingError ? "Pricing unavailable" : "Proceed to Booking"}
          </span>
          {!pricingLoading && !pricingError && estimatedPrice !== null && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
