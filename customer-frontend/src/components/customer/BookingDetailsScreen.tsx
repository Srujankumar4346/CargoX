import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { FleetVehicleItem } from "./VehicleSelectionWithPartLoadScreen";

interface BookingDetailsScreenProps {
  onBack: () => void;
  selectedVehicle: FleetVehicleItem;
  goodsWeightKg: number;
  onChangeWeightKg: (kg: number) => void;
  onProceedBooking: (details: {
    weightKg: number;
    pickupDate: string;
    pickupSlot: string;
    goodsType: string;
    needGST: boolean;
    paymentMethod: string;
  }) => void;
  totalPrice?: number;
  isSubmitting?: boolean;
}

export default function BookingDetailsScreen({
  onBack,
  selectedVehicle,
  goodsWeightKg = 0,
  onChangeWeightKg,
  onProceedBooking,
  totalPrice = 2811,
  isSubmitting = false,
}: BookingDetailsScreenProps) {
  const [weight, setWeight] = useState<string>(goodsWeightKg > 0 ? goodsWeightKg.toString() : "");
  const [selectedDate, setSelectedDate] = useState<"Today" | "Tomorrow">("Today");
  const [selectedSlot, setSelectedSlot] = useState<string>("9 AM - 11:30 AM");
  const [goodsType, setGoodsType] = useState<string>("Industrial Goods & Machinery");
  const [needGST, setNeedGST] = useState<boolean>(false);
  const [paymentMethod] = useState<string>("Cash");
  const [showGoodsTypeModal, setShowGoodsTypeModal] = useState<boolean>(false);
  const [showBreakupModal, setShowBreakupModal] = useState<boolean>(false);

  // Sync weight if goodsWeightKg prop changes from parent
  useEffect(() => {
    if (goodsWeightKg > 0) {
      setWeight(goodsWeightKg.toString());
    }
  }, [goodsWeightKg]);

  const availableSlots = [
    "9 AM - 11:30 AM",
    "11:30 AM - 2 PM",
    "2 PM - 4:30 PM",
    "4:30 PM - 7 PM",
    "7 PM - 9:30 PM",
  ];

  const goodsTypesList = [
    "Industrial Goods & Machinery",
    "General Freight / Household Goods",
    "Textiles & Garments",
    "Electronics & Electricals",
    "FMCG & Groceries",
    "Construction Materials",
    "Furniture & Shifting",
  ];

  const handleWeightChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, "");
    setWeight(clean);
    const parsed = parseInt(clean, 10);
    if (!isNaN(parsed)) {
      onChangeWeightKg(parsed);
    }
  };

  const handleBook = () => {
    const numWeight = parseInt(weight, 10);
    if (isNaN(numWeight) || numWeight <= 0) {
      alert("Please enter a valid goods weight in kg.");
      return;
    }
    const maxPayload = selectedVehicle.maxPayloadKg || Math.round((selectedVehicle.maxPayloadTons || 0.75) * 1000);
    if (maxPayload > 0 && numWeight > maxPayload) {
      alert(`Cargo weight (${numWeight} kg) exceeds vehicle maximum capacity (${maxPayload} kg for ${selectedVehicle.name}). Please reduce cargo weight or choose a higher capacity vehicle.`);
      return;
    }
    onProceedBooking({
      weightKg: numWeight,
      pickupDate: selectedDate === "Today" ? "Today, 18 Oct" : "Tomorrow, 19 Oct",
      pickupSlot: selectedSlot,
      goodsType,
      needGST,
      paymentMethod,
    });
  };

  return (
    <div className="h-full bg-[#f4f7fb] text-slate-900 flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header matching Screen 6 */}
      <div className="bg-white px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3 flex items-center gap-3 border-b border-slate-100 shadow-2xs shrink-0">
        <button
          onClick={onBack}
          className="p-1 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-extrabold text-slate-900">Booking Details</h1>
      </div>

      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Selected Vehicle Card matching Screen 6 */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-12 bg-slate-50 rounded-xl p-1 flex items-center justify-center">
              <img
                src={selectedVehicle.image}
                alt={selectedVehicle.name}
                className="max-h-10 max-w-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">{selectedVehicle.name}</p>
              <p className="text-[10px] text-slate-500 font-medium">Standard verified commercial carrier</p>
            </div>
          </div>
        </div>

        {/* Goods Weight Input & Rule Callout matching Screen 6 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 mb-2">Goods Weight (kg)</p>
          <div className="relative mb-3">
            <input
              type="text"
              inputMode="numeric"
              value={weight}
              onChange={(e) => handleWeightChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-900 outline-none focus:border-[#0866F5] focus:bg-white transition-all pl-10"
              placeholder="Enter weight in kg"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm">⚖️</span>
          </div>

          <div className="space-y-1 text-[11px] text-slate-600 font-semibold bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/60">
            <p>• Flat ₹2,811 upto 250 kg</p>
            <p>• Free 30 min waiting time, then ₹7/min</p>
          </div>
        </div>

        {/* Select Pickup Slot matching Screen 6 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 mb-2.5">Select Pickup Slot</p>

          {/* Date Selector Pills */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setSelectedDate("Today")}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                selectedDate === "Today"
                  ? "bg-[#0866F5] text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Today, 18 Oct
            </button>
            <button
              onClick={() => setSelectedDate("Tomorrow")}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                selectedDate === "Tomorrow"
                  ? "bg-[#0866F5] text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Tomorrow, 19 Oct
            </button>
          </div>

          {/* Time Slot Pills matching Screen 6 */}
          <div className="flex flex-wrap gap-2">
            {availableSlots.map((slot) => {
              const isSelected = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={`py-1.5 px-3 rounded-xl text-[11px] font-bold border transition-all ${
                    isSelected
                      ? "bg-blue-50 border-[#0866F5] text-[#0866F5]"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>

        {/* Goods Type Selector matching Screen 6 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 mb-2">Goods Type</p>
          <div
            onClick={() => setShowGoodsTypeModal(true)}
            role="button"
            tabIndex={0}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">📦</span>
              <span className="text-xs font-bold text-slate-900">{goodsType}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* GST Details Toggle matching Screen 6 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-bold">
                🏛️
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-900">Get Invoice with GSTIN</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Add GST details from Profile to claim Input Tax Credit</p>
              </div>
            </div>

            <button
              onClick={() => setNeedGST(!needGST)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                needGST ? "bg-[#0866F5]" : "bg-slate-300"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  needGST ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Area matching Screen 6 */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0 space-y-3">
        {/* Payment Method & Total Price Preview */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm">💵</span>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Payment Method</p>
              <p className="text-xs font-black text-slate-900">{paymentMethod}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-base font-black text-slate-900">
              ₹{totalPrice.toLocaleString("en-IN")}
            </p>
            <button
              type="button"
              onClick={() => setShowBreakupModal(true)}
              className="text-[10px] font-bold text-[#0866F5] hover:underline cursor-pointer"
            >
              View Breakup
            </button>
          </div>
        </div>

        {/* Clean In-App CSS Fare Breakup Modal */}
        {showBreakupModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">Fare Breakdown</h3>
                <button
                  type="button"
                  onClick={() => setShowBreakupModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Base Haulage Fare</span>
                  <span className="font-bold text-slate-900">₹{Math.max(250, Math.round(totalPrice * 0.45))}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Distance & Fuel Surcharge</span>
                  <span className="font-bold text-slate-900">₹{Math.round(totalPrice * 0.40)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Payload Cargo Fee ({weight} kg)</span>
                  <span className="font-bold text-slate-900">₹{Math.round(totalPrice * 0.15)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-sm text-slate-900">
                  <span>Total Estimated Fare</span>
                  <span className="text-[#0866F5]">₹{totalPrice.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBreakupModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#0866F5] text-white text-xs font-bold shadow-sm hover:bg-[#0652c5] transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Sticky "Book Part Load" Button */}
        <button
          onClick={handleBook}
          disabled={isSubmitting}
          className="w-full bg-[#0866F5] hover:bg-[#0652c5] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Confirming Booking...</span>
            </div>
          ) : (
            <span>Book Part Load</span>
          )}
        </button>
      </div>

      {/* Goods Type Selection Modal */}
      {showGoodsTypeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-2 max-h-80 overflow-y-auto">
            <p className="text-xs font-black text-slate-900 mb-2">Select Goods Category</p>
            {goodsTypesList.map((g) => (
              <div
                key={g}
                onClick={() => {
                  setGoodsType(g);
                  setShowGoodsTypeModal(false);
                }}
                className="p-2.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800 cursor-pointer"
              >
                {g}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
