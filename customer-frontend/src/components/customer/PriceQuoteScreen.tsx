import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import type { VehicleOption } from "./ChooseVehicleScreen";

interface PriceQuoteScreenProps {
  onBack: () => void;
  onEditRoute: () => void;
  onChangeVehicle: () => void;
  onProceedToBooking: (finalCalculatedPrice: number) => void;
  pickupAddress: string;
  dropAddress: string;
  distanceKm: number;
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
  distanceKm = 275,
  durationStr = "5h 20m",
  vehicle,
  cargoData
}: PriceQuoteScreenProps) {
  const [estimatedPrice, setEstimatedPrice] = useState(vehicle.price || 7850);
  const [baseFare, setBaseFare] = useState(2500);
  const [distanceCharges, setDistanceCharges] = useState(Math.round(Math.max(0, distanceKm - 50) * 20));
  const [tollTax] = useState(600);
  const [driverAllowance] = useState(250);
  const [capacitySurcharge, setCapacitySurcharge] = useState(0);
  const [handlingSurcharge, setHandlingSurcharge] = useState(0);

  const parseCapacityTons = (capStr: string): number => {
    const match = capStr.match(/([\d.]+)\s*Ton/i) || capStr.match(/(\d+)/);
    return match ? parseFloat(match[1]) : 2.0;
  };

  useEffect(() => {
    let isMounted = true;
    const vehicleCap = parseCapacityTons(vehicle.capacity);
    const weight = cargoData?.weightTons || 1.5;
    const handling = cargoData?.specialHandling || "None";

    api.getPricingEstimate(distanceKm, {
      weight_tons: weight,
      vehicle_capacity_tons: vehicleCap,
      special_handling: handling
    })
      .then((res) => {
        if (isMounted && res && res.estimated_total) {
          const total = Math.round(Number(res.estimated_total));
          setEstimatedPrice(total);
          if (res.breakdown) {
            setBaseFare(Math.round(Number(res.breakdown.base_fare || 2500)));
            setDistanceCharges(Math.round(Number(res.breakdown.distance_charge || Math.max(0, distanceKm - 50) * 20)));
            setCapacitySurcharge(Math.round(Number(res.breakdown.capacity_surcharge || 0)));
            setHandlingSurcharge(Math.round(Number(res.breakdown.handling_surcharge || 0)));
          } else {
            const base = Math.min(2500, Math.round(total * 0.32));
            setBaseFare(base);
            setDistanceCharges(Math.max(0, total - base - 600 - 250));
          }
        }
      })
      .catch(() => {
        // Fallback local calculation
        const rem = Math.max(0, distanceKm - 50);
        const distChg = Math.round(rem * 20);
        let capFee = 0;
        if (weight >= vehicleCap * 0.85) {
          capFee = 450;
        }
        let handFee = 0;
        if (handling.toLowerCase().includes("delicate") || handling.toLowerCase().includes("fragile")) {
          handFee = 500;
        } else if (handling.toLowerCase().includes("refrigerated") || handling.toLowerCase().includes("cold")) {
          handFee = 750;
        } else if (handling.toLowerCase().includes("care") || handling.toLowerCase().includes("sensitive")) {
          handFee = 350;
        }
        setBaseFare(2500);
        setDistanceCharges(distChg);
        setCapacitySurcharge(capFee);
        setHandlingSurcharge(handFee);
        setEstimatedPrice(2500 + distChg + 600 + 250 + capFee + handFee);
      });
    return () => { isMounted = false; };
  }, [distanceKm, vehicle, cargoData]);

  const remainingKm = Math.max(0, distanceKm - 50);
  const totalEstimatedPrice = estimatedPrice;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between pb-8 select-none">
      <div>
        {/* Top Header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100 shadow-xs">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Price Quote</h1>
          <div className="w-6" />
        </div>

        <div className="px-5 py-4 space-y-4">
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
                  {pickupAddress || "St. Martin's Engineering College, Hyderabad, Telangana"}
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
                  {dropAddress || "Vijayawada, Andhra Pradesh"}
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

          {/* Price Breakdown Card matching Screen 7 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
            <h2 className="text-xs font-bold text-slate-900 mb-3">Price Breakdown</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Base Fare (0 - 50 km)</span>
                <span className="font-semibold text-slate-800">₹{baseFare.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Distance Charges ({remainingKm} km)</span>
                <span className="font-semibold text-slate-800">₹{distanceCharges.toLocaleString("en-IN")}</span>
              </div>

              {/* Vehicle Max Capacity Surcharge */}
              {capacitySurcharge > 0 && (
                <div className="flex justify-between text-amber-700 bg-amber-50/70 px-2 py-1 rounded-lg">
                  <span className="font-medium flex items-center gap-1">
                    Near Vehicle Max Capacity Surcharge
                  </span>
                  <span className="font-bold">+₹{capacitySurcharge.toLocaleString("en-IN")}</span>
                </div>
              )}

              {/* Special Handling / Delicate Cargo Surcharge */}
              {handlingSurcharge > 0 && (
                <div className="flex justify-between text-blue-700 bg-blue-50/70 px-2 py-1 rounded-lg">
                  <span className="font-medium flex items-center gap-1">
                    Special Handling ({cargoData?.specialHandling || "Care/Fragile"})
                  </span>
                  <span className="font-bold">+₹{handlingSurcharge.toLocaleString("en-IN")}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Toll & State Tax</span>
                <span className="font-semibold text-slate-800">₹{tollTax.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Driver Allowance</span>
                <span className="font-semibold text-slate-800">₹{driverAllowance.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Total Estimated Price Highlight Banner */}
            <div className="mt-4 bg-emerald-50 rounded-xl p-3 flex items-center justify-between border border-emerald-100">
              <span className="text-xs font-bold text-emerald-800">Total Estimated Price</span>
              <span className="text-base font-extrabold text-emerald-600">
                ₹{totalEstimatedPrice.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Proceed to Booking Button */}
      <div className="px-5 mt-2">
        <button
          onClick={() => onProceedToBooking(totalEstimatedPrice)}
          className="w-full bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
        >
          <span>Proceed to Booking</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
