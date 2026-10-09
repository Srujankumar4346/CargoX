import { X, QrCode, Building, Truck, ShieldCheck, CheckCircle2, AlertCircle, Copy, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../services/api";

interface PaymentModalProps {
  invoice: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PaymentModal({ invoice, onClose, onSuccess }: PaymentModalProps) {
  const [activeTab, setActiveTab] = useState<"OPTIONS" | "UPI" | "NET_BANKING" | "POD_CONFIRMED">("OPTIONS");
  const [, setPaymentOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // UPI State
  const [paymentQr, setPaymentQr] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Pod State
  const [podMessage, setPodMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    api.getPaymentOptions(String(invoice.id))
      .then((opts) => {
        if (mounted) setPaymentOptions(opts);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load payment options.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [invoice.id]);

  const amountFormatted = Number(invoice.amount_due || invoice.total_amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleSelectUpi = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await api.selectPaymentMethod(String(invoice.id), "UPI");
      if (res.qr_details) {
        setPaymentQr(res.qr_details);
      } else {
        const qrRes = await api.getPaymentQr(String(invoice.id));
        setPaymentQr(qrRes);
      }
      setActiveTab("UPI");
    } catch (err: any) {
      setError(err.message || "Failed to initiate UPI payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectNetBanking = async () => {
    setSubmitting(true);
    setError("");
    try {
      await api.selectPaymentMethod(String(invoice.id), "NET_BANKING");
    } catch (err: any) {
      // Per FinTech specification: Show clear message that gateway is unconfigured; do not simulate success
      setError(err.message || "Net Banking is currently unavailable. It will be enabled after payment provider setup.");
      setActiveTab("NET_BANKING");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectPod = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await api.selectPaymentMethod(String(invoice.id), "PAY_ON_DELIVERY");
      setPodMessage(res.message || "Payment due on delivery. The authorized driver will collect payment at destination.");
      setActiveTab("POD_CONFIRMED");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to record Pay on Delivery option.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyUpiId = () => {
    if (!paymentQr?.upi_id) return;
    navigator.clipboard.writeText(paymentQr.upi_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center gap-2.5">
            {activeTab !== "OPTIONS" && (
              <button
                onClick={() => { setActiveTab("OPTIONS"); setError(""); }}
                className="mr-1 rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-white"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="rounded-lg bg-blue-500/15 p-2 text-blue-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Select Payment Method</h3>
              <p className="text-xs text-slate-400">Invoice #{invoice.invoice_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-800 p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Amount Due Banner */}
        <div className="border-b border-slate-800 bg-linear-to-r from-blue-950/40 via-slate-900 to-slate-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Outstanding</span>
              <p className="mt-0.5 text-2xl font-black text-white tracking-tight">₹{amountFormatted}</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 border border-amber-500/20">
                Payment Required
              </span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {loading && (
            <div className="py-12 text-center text-sm text-slate-400">
              Loading available payment channels...
            </div>
          )}

          {error && activeTab === "OPTIONS" && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-300 flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: 3-Card Selection Screen */}
          {!loading && activeTab === "OPTIONS" && (
            <div className="space-y-3.5">
              {/* Option A — UPI */}
              <button
                type="button"
                onClick={handleSelectUpi}
                disabled={submitting}
                className="group w-full text-left rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition-all hover:border-blue-500/50 hover:bg-slate-850 hover:shadow-lg hover:shadow-blue-950/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-500/15 p-2.5 text-blue-400 group-hover:bg-blue-500/25">
                      <QrCode size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">UPI (Scan & Pay)</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Google Pay, PhonePe, Paytm, or BHIM</p>
                    </div>
                  </div>
                  <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">
                    Instant QR
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
                  <span>Merchant UPI: Dynamic CargoX QR</span>
                  <span className="font-medium text-blue-300 group-hover:underline">Proceed →</span>
                </div>
              </button>

              {/* Option B — Net Banking */}
              <button
                type="button"
                onClick={handleSelectNetBanking}
                disabled={submitting}
                className="group w-full text-left rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition-all hover:border-purple-500/50 hover:bg-slate-850 hover:shadow-lg hover:shadow-purple-950/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-500/15 p-2.5 text-purple-400 group-hover:bg-purple-500/25">
                      <Building size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Net Banking</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Pay via SBI, HDFC, ICICI, Axis Bank & others</p>
                    </div>
                  </div>
                  <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/20">
                    Bank Gateway
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
                  <span>Direct hosted bank checkout</span>
                  <span className="font-medium text-purple-300 group-hover:underline">Proceed →</span>
                </div>
              </button>

              {/* Option C — Pay on Delivery */}
              <button
                type="button"
                onClick={handleSelectPod}
                disabled={submitting}
                className="group w-full text-left rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition-all hover:border-emerald-500/50 hover:bg-slate-850 hover:shadow-lg hover:shadow-emerald-950/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-500/15 p-2.5 text-emerald-400 group-hover:bg-emerald-500/25">
                      <Truck size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Pay on Delivery</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Pay cash or scan driver's QR upon arrival</p>
                    </div>
                  </div>
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/20">
                    At Delivery
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
                  <span>Collected securely by authorized driver</span>
                  <span className="font-medium text-emerald-300 group-hover:underline">Select POD →</span>
                </div>
              </button>
            </div>
          )}

          {/* TAB 2: UPI Dynamic QR Screen */}
          {activeTab === "UPI" && paymentQr && (
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Option A: Merchant UPI</span>
                <p className="mt-1 text-sm text-slate-300">Scan this QR code using your preferred UPI app</p>
              </div>

              <div className="mx-auto flex aspect-square w-52 items-center justify-center rounded-2xl bg-white p-3 shadow-[0_0_50px_rgba(59,130,246,0.18)]">
                <img src={paymentQr.qr_image_url} alt="CargoX UPI QR" className="h-full w-full object-contain" />
              </div>

              <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-slate-400 opacity-80">
                <span>Google Pay</span> · <span>PhonePe</span> · <span>Paytm</span> · <span>BHIM</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="min-w-0 pr-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">CargoX Merchant UPI ID</p>
                  <p className="font-mono text-xs font-bold text-slate-200 truncate">{paymentQr.upi_id}</p>
                </div>
                <button
                  type="button"
                  onClick={copyUpiId}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
                >
                  <Copy size={13} />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-3.5 text-xs text-blue-200/80 flex items-start gap-2.5">
                <ShieldCheck size={16} className="shrink-0 mt-0.5 text-blue-400" />
                <div>
                  <p className="font-semibold text-blue-300">Pending Confirmation Notice</p>
                  <p className="mt-0.5 leading-relaxed">
                    Status: <span className="text-amber-300 font-bold">Pending Confirmation</span>.
                    The invoice will be automatically updated once payment receipt is verified by CargoX.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Net Banking Screen (Gateway Status) */}
          {activeTab === "NET_BANKING" && (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-6 text-center">
                <Building className="mx-auto text-purple-400 mb-3" size={36} />
                <h4 className="font-bold text-white text-base">Net Banking Gateway</h4>
                <p className="text-xs text-purple-200/70 mt-1 max-w-sm mx-auto">
                  Direct bank checkout via SBI, HDFC, ICICI, Axis and other major Indian scheduled banks.
                </p>

                <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left text-xs text-amber-200">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-bold text-amber-300">Net Banking is currently unavailable</p>
                      <p className="mt-1 leading-relaxed text-amber-200/80">
                        Net Banking checkout requires an active merchant payment gateway setup. It will be available once the payment gateway integration is configured by the platform administrator.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-[11px] text-slate-400">
                  CargoX does not store or collect banking passwords, UPI PINs, or card credentials.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Pay on Delivery Confirmation Screen */}
          {activeTab === "POD_CONFIRMED" && (
            <div className="space-y-4 py-2 text-center">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-6">
                <CheckCircle2 className="mx-auto text-emerald-400 mb-3" size={40} />
                <h4 className="font-bold text-white text-base">Pay on Delivery Selected</h4>
                <p className="text-xs text-emerald-200/80 mt-1 max-w-sm mx-auto leading-relaxed">
                  {podMessage}
                </p>

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4 text-left space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Collection Status:</span>
                    <span className="font-bold text-amber-300">Payment Due on Delivery</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Collection Amount:</span>
                    <span className="font-bold text-white">₹{amountFormatted}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Authorized Collector:</span>
                    <span className="text-slate-300">Assigned Fleet Driver</span>
                  </div>
                </div>

                <p className="mt-4 text-[11px] text-slate-400">
                  Your delivery tracking screen will reflect "Payment due on delivery".
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800 bg-slate-900/50 p-4 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
