import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Package, Weight, Snowflake, Flame, Sparkles } from "lucide-react";

interface CargoDetailsScreenProps {
  onBack: () => void;
  onNext: (cargoData: {
    cargoType: string;
    weightTons: number;
    length: string;
    width: string;
    height: string;
    specialHandling: string;
  }) => void;
}

export default function CargoDetailsScreen({ onBack, onNext }: CargoDetailsScreenProps) {
  const [cargoType, setCargoType] = useState("Industrial Machinery");
  const [weight, setWeight] = useState("5");
  const [length, setLength] = useState("3");
  const [width, setWidth] = useState("2");
  const [height, setHeight] = useState("");
  const [specialHandling, setSpecialHandling] = useState<"None" | "Fragile" | "Hazardous" | "Refrigerated">("None");

  const cargoOptions = [
    "Industrial Machinery",
    "FMCG & Groceries",
    "Electronics & Appliances",
    "Construction Materials",
    "Textiles & Garments",
    "Chemicals / Pharma",
    "Furniture & Timber",
    "Agricultural Produce",
    "Other General Cargo"
  ];

  const handleNext = () => {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) {
      alert("Please enter a valid weight in Tons greater than 0");
      return;
    }
    onNext({
      cargoType,
      weightTons: w,
      length,
      width,
      height,
      specialHandling
    });
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col justify-between pb-6 select-none">
      {/* Top Header */}
      <div>
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Cargo Details</h1>
          <div className="w-6" />
        </div>

        {/* Step Progress Bar matching Screen 5 (Location -> Cargo -> Vehicle -> Review) */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
            <div className="absolute top-1/2 left-0 w-1/3 h-0.5 bg-[#1e60ff] -translate-y-1/2 z-0" />

            {/* Step 1: Location */}
            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-[#1e60ff] text-white flex items-center justify-center text-xs">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] text-slate-400 font-semibold mt-1">Location</span>
            </div>

            {/* Step 2: Cargo (Active) */}
            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-[#1e60ff] text-white flex items-center justify-center text-xs">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] text-[#1e60ff] font-bold mt-1">Cargo</span>
            </div>

            {/* Step 3: Vehicle */}
            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-xs">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
              </div>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Vehicle</span>
            </div>

            {/* Step 4: Review */}
            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-xs">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
              </div>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Review</span>
            </div>
          </div>
        </div>

        {/* Cargo Input Form matching Screen 5 reference */}
        <div className="px-5 space-y-4 mt-1">
          {/* Cargo Type */}
          <div>
            <label className="text-xs font-bold text-slate-900 block mb-1.5">Cargo Type</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <select
                value={cargoType}
                onChange={(e) => setCargoType(e.target.value)}
                className="w-full pl-13 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1e60ff] transition-all appearance-none cursor-pointer"
              >
                {cargoOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Total Weight */}
          <div>
            <label className="text-xs font-bold text-slate-900 block mb-1.5">Total Weight</label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                <Weight className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="5"
                className="w-full pl-13 pr-28 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1e60ff] transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                TON (Tons) ▾
              </div>
            </div>
          </div>

          {/* Dimensions (Optional) */}
          <div>
            <label className="text-xs font-bold text-slate-900 block mb-1.5">
              Dimensions <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1 font-semibold">Length</span>
                <input
                  type="text"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder="3"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 text-center outline-none focus:border-[#1e60ff]"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-1 font-semibold">Width</span>
                <input
                  type="text"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="2"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 text-center outline-none focus:border-[#1e60ff]"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-1 font-semibold">Height</span>
                <div className="relative">
                  <input
                    type="text"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="meters"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 text-center outline-none focus:border-[#1e60ff]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Special Handling / Care Instructions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-900">
                Cargo Nature & Special Handling
              </label>
              <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                Admin Surcharge Applicable
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {/* Standard */}
              <button
                type="button"
                onClick={() => setSpecialHandling("None")}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  specialHandling === "None"
                    ? "border-[#1e60ff] bg-blue-50/50 text-[#1e60ff] font-bold"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium"
                }`}
              >
                <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">
                  ✓
                </div>
                <span className="text-[10px]">Standard</span>
              </button>

              {/* Delicate / Fragile */}
              <button
                type="button"
                onClick={() => setSpecialHandling("Fragile")}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  specialHandling === "Fragile"
                    ? "border-[#1e60ff] bg-blue-50/50 text-[#1e60ff] font-bold shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium"
                }`}
              >
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] text-center leading-tight">Delicate / Fragile</span>
              </button>

              {/* Hazardous / Sensitive */}
              <button
                type="button"
                onClick={() => setSpecialHandling("Hazardous")}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  specialHandling === "Hazardous"
                    ? "border-[#1e60ff] bg-blue-50/50 text-[#1e60ff] font-bold shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium"
                }`}
              >
                <Flame className="w-4 h-4 text-red-500" />
                <span className="text-[10px] text-center leading-tight">Sensitive / Care</span>
              </button>

              {/* Refrigerated / Temperature Controlled */}
              <button
                type="button"
                onClick={() => setSpecialHandling("Refrigerated")}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  specialHandling === "Refrigerated"
                    ? "border-[#1e60ff] bg-blue-50/50 text-[#1e60ff] font-bold shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium"
                }`}
              >
                <Snowflake className="w-4 h-4 text-cyan-500" />
                <span className="text-[10px] text-center leading-tight">Refrigerated</span>
              </button>
            </div>
            {specialHandling !== "None" && (
              <p className="mt-2 text-[10px] text-blue-600 font-semibold bg-blue-50 p-2 rounded-lg border border-blue-100 flex items-center gap-1.5">
                <span>🛡️</span> Special care & handling protocols assigned. Extra handling care charges set by CargoX admin will be added to the quote.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Next Button */}
      <div className="px-5 mt-6">
        <button
          onClick={handleNext}
          className="w-full bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
        >
          <span>Next: Choose Vehicle</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
