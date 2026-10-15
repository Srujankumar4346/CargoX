import { useState } from "react";
import { Check, Copy, ArrowRight, Home } from "lucide-react";

interface BookingConfirmationScreenProps {
  bookingId: string;
  bookingData?: any;
  onTrackShipment: () => void;
  onGoHome: () => void;
}

export default function BookingConfirmationScreen({
  bookingId = "—",
  bookingData,
  onTrackShipment,
  onGoHome
}: BookingConfirmationScreenProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nowFormatted = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }) + ", " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const timelineSteps = [
    { 
      title: "Request Confirmed", 
      time: bookingData?.created_at ? new Date(bookingData.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : nowFormatted, 
      status: "completed" 
    },
    { 
      title: "Vehicle Assigned", 
      time: bookingData?.assigned_vehicle_registration ? nowFormatted : "Pending assignment by Operations", 
      status: bookingData?.assigned_vehicle_registration ? "completed" : "pending" 
    },
    { 
      title: "Driver Assigned", 
      time: bookingData?.assigned_driver_name ? nowFormatted : "Pending driver dispatch", 
      status: bookingData?.assigned_driver_name ? "completed" : "pending" 
    },
    { 
      title: "Pickup Scheduled", 
      time: "Scheduled upon vehicle arrival", 
      status: "pending" 
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col justify-between py-8 px-6 select-none animate-fade-in">
      <div className="flex flex-col items-center text-center">
        {/* Celebration Confetti & Green Check Badge matching Screen 9 */}
        <div className="relative my-4 flex items-center justify-center">
          {/* Confetti specks */}
          <span className="absolute -top-3 -left-6 w-2.5 h-2.5 bg-amber-400 rounded-sm rotate-12" />
          <span className="absolute -top-4 right-2 w-2 h-2 bg-blue-500 rounded-full" />
          <span className="absolute bottom-1 -left-5 w-2 h-2 bg-rose-400 rounded-full" />
          <span className="absolute top-2 -right-6 w-2.5 h-2.5 bg-emerald-400 rounded-sm -rotate-45" />

          {/* Green Circle Check */}
          <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Check className="w-10 h-10 stroke-[3]" />
          </div>
        </div>

        <h1 className="text-xl font-black text-slate-900 mt-2">Booking Request Submitted!</h1>
        <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
          Your transport request has been sent to CargoX Operations for review and dispatch. No payment is due until delivery.
        </p>

        {/* Booking ID Box with Copy Button matching Screen 9 */}
        <div className="w-full mt-6 bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Booking ID</span>
            <span className="text-sm font-extrabold text-slate-900 tracking-tight">{bookingId}</span>
          </div>
          <button
            onClick={handleCopy}
            className="p-2 text-slate-400 hover:text-[#1e60ff] rounded-xl hover:bg-white transition-colors"
            title="Copy Booking ID"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        {copied && <span className="text-[10px] text-emerald-600 font-bold mt-1">Copied to clipboard!</span>}

        {/* Status Timeline matching Screen 9 */}
        <div className="w-full mt-6 text-left space-y-4 px-2">
          {timelineSteps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3 relative">
              {/* Connecting line */}
              {idx < timelineSteps.length - 1 && (
                <div className={`absolute left-[11px] top-6 bottom-[-16px] w-0.5 z-0 ${
                  step.status === "completed" && timelineSteps[idx + 1]?.status === "completed"
                    ? "bg-emerald-500"
                    : "bg-slate-200"
                }`} />
              )}
              {/* Check marker */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                step.status === "completed"
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-200 text-slate-400"
              }`}>
                {step.status === "completed" ? (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                )}
              </div>
              <div>
                <p className={`text-xs font-bold leading-tight ${step.status === "completed" ? "text-slate-900" : "text-slate-500"}`}>
                  {step.title}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{step.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions matching Screen 9 */}
      <div className="space-y-3 mt-8">
        <button
          onClick={onTrackShipment}
          className="w-full bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
        >
          <span>Track Your Shipment</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={onGoHome}
          className="w-full bg-transparent hover:bg-slate-50 text-slate-700 py-3.5 px-6 rounded-2xl font-bold text-sm border border-slate-200 transition-all text-center flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          <span>Go to Home</span>
        </button>
      </div>
    </div>
  );
}
