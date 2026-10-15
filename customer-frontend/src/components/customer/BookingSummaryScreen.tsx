import { useState } from "react";
import { ArrowLeft, ArrowRight, MapPin, CreditCard, Wallet, Building2, Smartphone } from "lucide-react";
import type { VehicleOption } from "./ChooseVehicleScreen";

interface BookingSummaryScreenProps {
  onBack: () => void;
  onEditPickup: () => void;
  onEditDrop: () => void;
  onConfirmAndPay: (paymentMethod: string) => void;
  pickupAddress: string;
  dropAddress: string;
  vehicle: VehicleOption;
  cargoType: string;
  weightTons: number;
  distanceKm: number;
  durationStr: string;
  totalPrice: number;
  isLoading?: boolean;
}

export default function BookingSummaryScreen({
  onBack,
  onEditPickup,
  onEditDrop,
  onConfirmAndPay,
  pickupAddress,
  dropAddress,
  vehicle,
  cargoType = "Industrial Machinery",
  weightTons = 5,
  distanceKm = 275,
  durationStr = "5h 20m",
  totalPrice = 7850,
  isLoading = false
}: BookingSummaryScreenProps) {
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Card" | "Net Banking" | "Wallet">("UPI");
  const [agreed, setAgreed] = useState(true);

  const paymentOptions = [
    { id: "UPI", label: "UPI", sub: "GPay, PhonePe", icon: <Smartphone className="w-5 h-5 text-indigo-600" /> },
    { id: "Card", label: "Card", sub: "Credit/Debit", icon: <CreditCard className="w-5 h-5 text-blue-600" /> },
    { id: "Net Banking", label: "Net Banking", sub: "All Banks", icon: <Building2 className="w-5 h-5 text-emerald-600" /> },
    { id: "Wallet", label: "Wallet", sub: "Paytm, etc", icon: <Wallet className="w-5 h-5 text-amber-600" /> },
  ] as const;

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
          <h1 className="text-base font-bold text-slate-900">Booking Summary</h1>
          <div className="w-6" />
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Pickup and Destination card with Edit buttons matching Screen 8 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
            <div className="space-y-4 relative">
              {/* Pickup */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pickup Location</span>
                  <button onClick={onEditPickup} className="text-xs font-bold text-[#1e60ff] hover:underline">
                    Edit
                  </button>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-[#1e60ff] flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-[#1e60ff]" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 leading-snug">
                    {pickupAddress || "St. Martin's Engineering College, Hyderabad, Telangana"}
                  </p>
                </div>
              </div>

              {/* Connecting line */}
              <div className="absolute left-2.5 top-9 w-0.5 h-8 bg-slate-200 pointer-events-none" />

              {/* Drop */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Drop Location</span>
                  <button onClick={onEditDrop} className="text-xs font-bold text-[#1e60ff] hover:underline">
                    Edit
                  </button>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-3 h-3" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 leading-snug">
                    {dropAddress || "Vijayawada, Andhra Pradesh"}
                  </p>
                </div>
              </div>
            </div>

            {/* Spec list matching Screen 8 */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Vehicle</span>
                <span className="font-bold text-slate-800 text-right">{vehicle.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Cargo Type</span>
                <span className="font-semibold text-slate-700">{cargoType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Total Weight</span>
                <span className="font-semibold text-slate-700">{weightTons} Ton</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Distance</span>
                <span className="font-semibold text-slate-700">{distanceKm} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Estimated Time</span>
                <span className="font-semibold text-slate-700">{durationStr}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-50">
                <span className="text-slate-800 font-bold">Estimated Price</span>
                <span className="text-base font-extrabold text-[#1e60ff]">
                  ₹{totalPrice.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Clear Toll & Statutory Disclaimer matching Part 7 */}
            <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 text-[10px] text-amber-900 leading-relaxed font-medium">
              <strong>Statutory Charges Notice:</strong> Delivery price only. Toll charges, applicable taxes, permits, parking, and other statutory or route-related charges are excluded unless explicitly listed in this quotation. Additional applicable charges may be payable separately.
            </div>
          </div>

          {/* Payment Terms — Pay After Delivery policy matching Part 6 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-slate-900">Payment Policy</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                Pay After Delivery
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              No advance payment is required to create this booking. You can review and settle your verified invoice via UPI, Card, Net Banking, or Driver POD after delivery is completed and verified.
            </p>

            <h3 className="text-xs font-bold text-slate-800 mt-3 mb-2">Preferred Settlement Method</h3>
            <div className="grid grid-cols-4 gap-2">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPaymentMethod(opt.id)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    paymentMethod === opt.id
                      ? "border-[#1e60ff] bg-blue-50/50 shadow-xs font-bold"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium"
                  }`}
                >
                  <div className="mb-1">{opt.icon}</div>
                  <span className="text-[10px] text-slate-800 text-center leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Terms & Conditions Checkbox */}
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id="terms"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 rounded text-[#1e60ff] focus:ring-[#1e60ff] border-slate-300 cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-slate-600 cursor-pointer">
              I agree to the <span className="text-[#1e60ff] font-semibold underline">Terms & Conditions</span> and Pay-After-Delivery Policy
            </label>
          </div>
        </div>
      </div>

      {/* Submit Booking Request Button matching Part 6 */}
      <div className="px-5 mt-2">
        <button
          disabled={!agreed || isLoading}
          onClick={() => onConfirmAndPay(paymentMethod)}
          className={`w-full bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all ${
            !agreed || isLoading ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {isLoading ? (
            <span>Submitting Request...</span>
          ) : (
            <>
              <span>Submit Booking Request</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
