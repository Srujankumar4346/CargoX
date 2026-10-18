import { useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

interface AddMoneyScreenProps {
  onBack: () => void;
  onSuccess: (amount: number) => void;
}

export default function AddMoneyScreen({ onBack, onSuccess }: AddMoneyScreenProps) {
  const [amount, setAmount] = useState<number>(500);
  const [customInput, setCustomInput] = useState<string>("500");
  const [selectedOption, setSelectedOption] = useState<"upi" | "netbanking" | "card">("upi");
  const [isProcessing, setIsProcessing] = useState(false);

  const presetAmounts = [500, 1000, 2000, 5000];

  const handleSelectPreset = (val: number) => {
    setAmount(val);
    setCustomInput(val.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setCustomInput(val);
    const parsed = parseInt(val, 10);
    setAmount(isNaN(parsed) ? 0 : parsed);
  };

  const handleProceed = () => {
    if (amount <= 0) {
      alert("Please enter a valid amount greater than ₹0");
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onSuccess(amount);
    }, 900);
  };

  return (
    <div className="min-h-full flex-1 bg-[#f8fafc] text-slate-900 pb-12 select-none overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3 flex items-center gap-3 border-b border-slate-100 shadow-2xs">
        <button
          onClick={onBack}
          className="p-1 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-extrabold text-slate-900">Add Money</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Amount Entry Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-500 mb-2">Enter Amount</p>
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
            <span className="text-2xl font-black text-slate-900">₹</span>
            <input
              type="text"
              inputMode="numeric"
              value={customInput}
              onChange={handleInputChange}
              className="text-2xl font-black text-slate-900 w-full outline-none bg-transparent"
              placeholder="0"
            />
          </div>

          {/* Quick preset amount pills */}
          <div className="grid grid-cols-4 gap-2">
            {presetAmounts.map((p) => {
              const isSelected = amount === p;
              return (
                <button
                  key={p}
                  onClick={() => handleSelectPreset(p)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-[#0866F5] text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  ₹{p.toLocaleString("en-IN")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Options Section matching Screen 10 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h2 className="text-xs font-extrabold text-slate-900 mb-3">Payment Options</h2>

          <div className="space-y-3">
            {/* UPI */}
            <div
              onClick={() => setSelectedOption("upi")}
              role="button"
              tabIndex={0}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedOption === "upi"
                  ? "border-[#0866F5] bg-blue-50/40"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  UPI
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-900">
                    UPI <span className="text-[10px] text-emerald-600 font-semibold">(Recommended)</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Google Pay, PhonePe, Paytm, BHIM</p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedOption === "upi"
                    ? "border-[#0866F5] bg-[#0866F5]"
                    : "border-slate-300"
                }`}
              >
                {selectedOption === "upi" && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>

            {/* Net Banking */}
            <div
              onClick={() => setSelectedOption("netbanking")}
              role="button"
              tabIndex={0}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedOption === "netbanking"
                  ? "border-[#0866F5] bg-blue-50/40"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                  🏦
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-900">Net Banking</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">All Major Indian Banks</p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedOption === "netbanking"
                    ? "border-[#0866F5] bg-[#0866F5]"
                    : "border-slate-300"
                }`}
              >
                {selectedOption === "netbanking" && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>

            {/* Debit / Credit Card */}
            <div
              onClick={() => setSelectedOption("card")}
              role="button"
              tabIndex={0}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedOption === "card"
                  ? "border-[#0866F5] bg-blue-50/40"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                  💳
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-900">Debit / Credit Card</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Visa, Mastercard, RuPay</p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedOption === "card"
                    ? "border-[#0866F5] bg-[#0866F5]"
                    : "border-slate-300"
                }`}
              >
                {selectedOption === "card" && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
          </div>
        </div>

        {/* Proceed Button */}
        <button
          onClick={handleProceed}
          disabled={isProcessing || amount <= 0}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
            isProcessing || amount <= 0
              ? "bg-slate-300 text-slate-500 cursor-not-allowed"
              : "bg-[#0866F5] hover:bg-[#0652c5] active:scale-[0.98] text-white shadow-blue-500/25"
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processing Payment...</span>
            </div>
          ) : (
            <span>Proceed to Pay ₹{amount.toLocaleString("en-IN")}</span>
          )}
        </button>

        <div className="flex items-center justify-center gap-2 text-slate-400 text-[11px] pt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>256-Bit SSL Encrypted & RBI Compliant Gateway</span>
        </div>
      </div>
    </div>
  );
}
