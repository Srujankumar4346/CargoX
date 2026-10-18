import { useState } from "react";
import { ArrowLeft, ArrowUpRight, ShieldCheck, Wallet } from "lucide-react";

interface CustomerPaymentsScreenProps {
  onBack?: () => void;
  onOpenAddMoney: () => void;
  walletBalance?: number;
}

export default function CustomerPaymentsScreen({
  onBack,
  onOpenAddMoney,
  walletBalance = 0,
}: CustomerPaymentsScreenProps) {
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "upi" | "card">("cash");

  return (
    <div className="min-h-full flex-1 bg-[#f4f7fb] text-slate-900 pb-28 select-none overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3 flex items-center justify-between border-b border-slate-100 shadow-2xs">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-base font-extrabold text-slate-900">Payments</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Credits Balance Card matching Screen 8 reference */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-500 mb-1">CargoExpress Credits Balance</p>
          <div className="flex items-center gap-3 my-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0866F5] flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div className="flex items-baseline">
              <span className="text-2xl font-black text-slate-900">₹{walletBalance}</span>
            </div>
          </div>

          <button
            onClick={onOpenAddMoney}
            className="w-full mt-3 bg-[#0866F5] hover:bg-[#0652c5] active:scale-[0.99] text-white py-3 rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5"
          >
            <span>Add Money</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* Payment Methods Section matching Screen 8 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h2 className="text-xs font-extrabold text-slate-900 mb-3">Payment Methods</h2>

          <div className="space-y-3">
            {/* Cash */}
            <div
              onClick={() => setSelectedMethod("cash")}
              role="button"
              tabIndex={0}
              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedMethod === "cash"
                  ? "border-[#0866F5] bg-blue-50/40"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base">
                  💵
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-900">Cash</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pay at delivery</p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedMethod === "cash"
                    ? "border-[#0866F5] bg-[#0866F5]"
                    : "border-slate-300 bg-white"
                }`}
              >
                {selectedMethod === "cash" && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>

            {/* UPI */}
            <div
              onClick={() => setSelectedMethod("upi")}
              role="button"
              tabIndex={0}
              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedMethod === "upi"
                  ? "border-[#0866F5] bg-blue-50/40"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
                  UPI
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-900">UPI</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pay via UPI (GPay, PhonePe, Paytm)</p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedMethod === "upi"
                    ? "border-[#0866F5] bg-[#0866F5]"
                    : "border-slate-300 bg-white"
                }`}
              >
                {selectedMethod === "upi" && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>

            {/* Card / Wallet */}
            <div
              onClick={() => setSelectedMethod("card")}
              role="button"
              tabIndex={0}
              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedMethod === "card"
                  ? "border-[#0866F5] bg-blue-50/40"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0866F5] flex items-center justify-center font-bold text-base">
                  💳
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-900">Card / Wallet</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pay securely online</p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedMethod === "card"
                    ? "border-[#0866F5] bg-[#0866F5]"
                    : "border-slate-300 bg-white"
                }`}
              >
                {selectedMethod === "card" && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
          <p className="text-[11px] text-slate-600 leading-tight">
            100% Secure payments. Verified GST invoices issued for all completed deliveries.
          </p>
        </div>
      </div>
    </div>
  );
}
