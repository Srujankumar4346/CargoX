import { X, QrCode, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../services/api";

interface UpiPaymentModalProps {
  invoice: any;
  onClose: () => void;
}

export default function UpiPaymentModal({ invoice, onClose }: UpiPaymentModalProps) {
  const [copied, setCopied] = useState(false);
  const [paymentQr, setPaymentQr] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api.getPaymentQr(String(invoice.id))
      .then((response) => {
        if (mounted) setPaymentQr(response);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError instanceof Error ? requestError.message : "UPI payment is unavailable.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [invoice.id]);

  const copyUpiId = () => {
    if (!paymentQr?.upi_id) return;
    navigator.clipboard.writeText(paymentQr.upi_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const amount = Number(paymentQr?.amount_due).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2">
            <QrCode className="text-blue-400" size={20} />
            <h3 className="font-bold text-white">UPI Payment</h3>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full bg-slate-800 p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && <p role="status" className="py-12 text-center text-sm text-slate-400">Loading payment details...</p>}
          {error && <p role="alert" className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">{error}</p>}
          {paymentQr && <>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-400">Amount Due</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-white">₹{amount}</p>
              <p className="mt-1 text-xs text-slate-500">Invoice #{paymentQr.invoice_number}</p>
            </div>
            <div className="mx-auto mt-8 flex aspect-square w-56 items-center justify-center rounded-xl bg-white p-3 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
              <img src={paymentQr.qr_image_url} alt="UPI QR Code" className="h-full w-full object-contain" />
            </div>
            <div className="mt-6 text-center">
              <p className="text-xs text-slate-400">Scan with any UPI app</p>
              <div className="mt-2 flex items-center justify-center gap-4 opacity-70 grayscale filter">
                <span className="text-[10px] font-bold tracking-wider text-slate-300">GPay</span>
                <span className="text-[10px] font-bold tracking-wider text-slate-300">PhonePe</span>
                <span className="text-[10px] font-bold tracking-wider text-slate-300">Paytm</span>
                <span className="text-[10px] font-bold tracking-wider text-slate-300">BHIM</span>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">CargoX UPI ID</p>
                <p className="font-mono text-sm font-semibold text-slate-200">{paymentQr.upi_id}</p>
              </div>
              <button onClick={copyUpiId} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </>}
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-800 bg-blue-950/20 p-4">
          {paymentQr && <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-blue-400" size={16} />
              <div className="text-xs text-blue-200/70">
                <p className="font-semibold text-blue-300">Important Note</p>
                <p className="mt-1">CargoX manually verifies the transfer. The trip is completed only after the full payment is recorded.</p>
              </div>
            </div>}
          <button 
            onClick={onClose}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500"
          >
            <X size={16} />
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
