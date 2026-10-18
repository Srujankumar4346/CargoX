import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Check, Package, Scale, Snowflake, Flame, Sparkles, ChevronDown } from "lucide-react";
import { api } from "../../services/api";

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
  initialCargoData?: {
    cargoType: string;
    weightTons: number;
    length: string;
    width: string;
    height: string;
    specialHandling: string;
  };
}

export default function CargoDetailsScreen({ onBack, onNext, initialCargoData }: CargoDetailsScreenProps) {
  const [cargoType, setCargoType] = useState(initialCargoData?.cargoType || "General Freight / Household Goods");
  const [weightValue, setWeightValue] = useState<string>(
    initialCargoData?.weightTons != null ? String(initialCargoData.weightTons) : "0.5"
  );
  const [weightUnit, setWeightUnit] = useState<"TON" | "KG">("TON");
  const [length, setLength] = useState(initialCargoData?.length || "2");
  const [width, setWidth] = useState(initialCargoData?.width || "1.5");
  const [height, setHeight] = useState(initialCargoData?.height || "1.5");
  const [specialHandling, setSpecialHandling] = useState<"None" | "Fragile" | "Hazardous" | "Refrigerated">(
    (initialCargoData?.specialHandling as any) || "None"
  );

  // Admin surcharge availability check
  const [activePricingConfig, setActivePricingConfig] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    api.getActivePricing()
      .then((cfg) => {
        if (isMounted && cfg) setActivePricingConfig(cfg);
      })
      .catch(() => {
        // Fallback or offline: default config exists
      });
    return () => { isMounted = false; };
  }, []);

  const cargoOptions = [
    "General Freight / Household Goods",
    "Packers & Movers Goods",
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

  // Weight normalization to Tons for booking engine
  const parsedNumericWeight = parseFloat(weightValue);
  const normalizedWeightTons = isNaN(parsedNumericWeight)
    ? 0
    : weightUnit === "KG"
    ? parsedNumericWeight / 1000
    : parsedNumericWeight;

  const isWeightValid = !isNaN(parsedNumericWeight) && parsedNumericWeight > 0;

  // Determine if Admin has configured any handling surcharges
  const hasAdminHandlingSurcharges = Boolean(
    activePricingConfig &&
    (activePricingConfig.fragile_surcharge_enabled ||
     activePricingConfig.hazardous_surcharge_enabled ||
     activePricingConfig.refrigerated_surcharge_enabled)
  );

  const handleNext = () => {
    if (!isWeightValid) {
      alert("Please enter a valid total weight greater than 0.");
      return;
    }
    onNext({
      cargoType,
      weightTons: Number(normalizedWeightTons.toFixed(3)),
      length,
      width,
      height,
      specialHandling
    });
  };

  return (
    <div className="relative h-full w-full bg-white text-slate-800 flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header - Compact white with subtle border */}
      <div className="shrink-0 bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100 z-10">
        <button
          onClick={onBack}
          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900 tracking-tight">Cargo Details</h1>
        <div className="w-8" />
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5">
        
        {/* Step Progress Bar: Location -> Cargo -> Vehicle -> Review */}
        <div className="pt-1 pb-1">
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute top-3 left-6 right-6 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
            <div className="absolute top-3 left-6 w-[36%] h-0.5 bg-[#1e60ff] -translate-y-1/2 z-0" />

            {/* Step 1: Location (Completed) */}
            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-[#1e60ff] text-white flex items-center justify-center text-xs shadow-xs">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-[10px] text-slate-400 font-semibold mt-1">Location</span>
            </div>

            {/* Step 2: Cargo (Active) */}
            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-[#1e60ff] text-white flex items-center justify-center text-xs shadow-xs ring-4 ring-blue-50">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-[10px] text-[#1e60ff] font-bold mt-1">Cargo</span>
            </div>

            {/* Step 3: Vehicle */}
            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
              </div>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Vehicle</span>
            </div>

            {/* Step 4: Review */}
            <div className="flex flex-col items-center relative z-10">
              <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
              </div>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Review</span>
            </div>
          </div>
        </div>

        {/* Section C: Cargo Type Selection (Matches Reference Card) */}
        <div>
          <label className="text-[11px] font-bold text-slate-900 block mb-1">Cargo Type</label>
          <div className="relative flex items-center bg-[#f8fafc] rounded-xl border border-slate-200/90 hover:border-slate-300 transition-colors">
            <div className="pl-3 pr-2.5 py-2.5 text-amber-500 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Package className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <select
              value={cargoType}
              onChange={(e) => setCargoType(e.target.value)}
              className="w-full bg-transparent py-2.5 pr-8 text-xs font-bold text-slate-900 outline-none appearance-none cursor-pointer"
            >
              {cargoOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <div className="absolute right-3 pointer-events-none text-slate-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Section D: Total Weight (Matches Reference with Unit Switcher) */}
        <div>
          <label className="text-[11px] font-bold text-slate-900 block mb-1">Total Weight</label>
          <div className="relative flex items-center bg-[#f8fafc] rounded-xl border border-slate-200/90 focus-within:border-[#1e60ff] focus-within:ring-1 focus-within:ring-[#1e60ff]/20 transition-all">
            <div className="pl-3 pr-2.5 py-2.5 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                <Scale className="w-4 h-4 text-orange-500" />
              </div>
            </div>
            <input
              type="number"
              step="any"
              min="0.01"
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              placeholder="0.5"
              className="flex-1 bg-transparent py-2.5 text-xs font-bold text-slate-900 outline-none"
            />
            {/* Unit Dropdown Selector */}
            <div className="pr-2 shrink-0">
              <div className="relative flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs">
                <select
                  value={weightUnit}
                  onChange={(e) => {
                    const nextUnit = e.target.value as "TON" | "KG";
                    if (nextUnit !== weightUnit && isWeightValid) {
                      if (nextUnit === "KG") {
                        setWeightValue(String(Math.round(parsedNumericWeight * 1000)));
                      } else {
                        setWeightValue(String(parsedNumericWeight / 1000));
                      }
                    }
                    setWeightUnit(nextUnit);
                  }}
                  className="bg-transparent pr-4 outline-none appearance-none cursor-pointer font-bold text-slate-800"
                >
                  <option value="TON">TON (Tons)</option>
                  <option value="KG">KG (Kilograms)</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
              </div>
            </div>
          </div>
          {!isWeightValid && weightValue.trim() !== "" && (
            <p className="text-[10px] text-red-500 font-semibold mt-1">Please enter a positive weight.</p>
          )}
        </div>

        {/* Section E: Optional Dimensions (Matches Reference: 3 columns in single compact row) */}
        <div>
          <label className="text-[11px] font-bold text-slate-900 block mb-1">
            Dimensions <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Length</span>
              <input
                type="text"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                placeholder="2"
                className="w-full py-2 px-2 bg-[#f8fafc] border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-800 text-center outline-none focus:border-[#1e60ff] transition-colors"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Width</span>
              <input
                type="text"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="1.5"
                className="w-full py-2 px-2 bg-[#f8fafc] border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-800 text-center outline-none focus:border-[#1e60ff] transition-colors"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Height</span>
              <input
                type="text"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="1.5"
                className="w-full py-2 px-2 bg-[#f8fafc] border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-800 text-center outline-none focus:border-[#1e60ff] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Section F: Cargo Handling Options (Matches Reference 4-Card Grid) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold text-slate-900">
              Cargo Nature & Special Handling
            </label>
            {hasAdminHandlingSurcharges && (
              <span className="text-[9px] text-amber-700 font-bold bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-full">
                Admin Surcharge Applicable
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {/* Standard */}
            <button
              type="button"
              onClick={() => setSpecialHandling("None")}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                specialHandling === "None"
                  ? "border-[#1e60ff] bg-blue-50/40 text-[#1e60ff] font-bold shadow-2xs"
                  : "border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 font-medium"
              }`}
            >
              <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span className="text-[10px] leading-tight font-semibold">Standard</span>
            </button>

            {/* Delicate / Fragile */}
            <button
              type="button"
              onClick={() => setSpecialHandling("Fragile")}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                specialHandling === "Fragile"
                  ? "border-[#1e60ff] bg-blue-50/40 text-[#1e60ff] font-bold shadow-2xs"
                  : "border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 font-medium"
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#1e60ff]" />
              <span className="text-[10px] leading-tight font-semibold">Delicate / Fragile</span>
            </button>

            {/* Sensitive / Care */}
            <button
              type="button"
              onClick={() => setSpecialHandling("Hazardous")}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                specialHandling === "Hazardous"
                  ? "border-[#1e60ff] bg-blue-50/40 text-[#1e60ff] font-bold shadow-2xs"
                  : "border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 font-medium"
              }`}
            >
              <Flame className="w-4 h-4 text-red-500" />
              <span className="text-[10px] leading-tight font-semibold">Sensitive / Care</span>
            </button>

            {/* Refrigerated */}
            <button
              type="button"
              onClick={() => setSpecialHandling("Refrigerated")}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                specialHandling === "Refrigerated"
                  ? "border-[#1e60ff] bg-blue-50/40 text-[#1e60ff] font-bold shadow-2xs"
                  : "border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 font-medium"
              }`}
            >
              <Snowflake className="w-4 h-4 text-cyan-500" />
              <span className="text-[10px] leading-tight font-semibold">Refrigerated</span>
            </button>
          </div>
          {specialHandling !== "None" && (
            <p className="mt-2 text-[10px] text-blue-700 font-medium bg-blue-50/80 p-2 rounded-xl border border-blue-100 flex items-center gap-1.5">
              <span>🛡️</span> Special care protocol assigned. Applicable handling surcharge will be reflected in final quote.
            </p>
          )}
        </div>
      </div>

      {/* Section 4: Bottom Action Button Area */}
      <div className="shrink-0 bg-white p-4 pt-2 border-t border-slate-100 pb-[max(env(safe-area-inset-bottom,16px),16px)]">
        <button
          disabled={!isWeightValid}
          onClick={handleNext}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
            isWeightValid
              ? "bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white shadow-blue-500/25 cursor-pointer"
              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
          }`}
        >
          <span>Continue to Vehicle Selection</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
