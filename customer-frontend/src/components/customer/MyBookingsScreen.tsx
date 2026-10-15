import { useState } from "react";
import { ArrowLeft, Navigation, Download } from "lucide-react";

export interface BookingItem {
  id: string;
  ref: string;
  routeFrom: string;
  routeTo: string;
  date: string;
  price: number | null;
  status: "In Transit" | "Delivered" | "Cancelled" | "Pending";
  vehicleName: string;
  vehicleImage: string;
  hasInvoice?: boolean;
}

interface MyBookingsScreenProps {
  onBack: () => void;
  onLiveTracking: (booking: BookingItem) => void;
  onViewDetails: (booking: BookingItem) => void;
  onDownloadInvoice: (booking: BookingItem) => void;
  bookingsList?: BookingItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function MyBookingsScreen({
  onBack,
  onLiveTracking,
  onViewDetails,
  onDownloadInvoice,
  bookingsList = [],
  isLoading = false,
  error = null,
  onRetry
}: MyBookingsScreenProps) {
  const [filter, setFilter] = useState<"Active" | "Completed" | "Cancelled">("Active");

  const items = bookingsList;

  const activeCount = items.filter((b) => b.status === "In Transit" || b.status === "Pending").length;
  const completedCount = items.filter((b) => b.status === "Delivered").length;
  const cancelledCount = items.filter((b) => b.status === "Cancelled").length;

  const filteredItems = items.filter((b) => {
    if (filter === "Active") return b.status === "In Transit" || b.status === "Pending";
    if (filter === "Completed") return b.status === "Delivered";
    if (filter === "Cancelled") return b.status === "Cancelled";
    return true;
  });

  return (
    <div className="min-h-full flex-1 bg-[#f8fafc] text-slate-800 flex flex-col justify-between pb-28 select-none overflow-y-auto">
      <div>
        {/* Header matching CargoX Design */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100 shadow-xs">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">My Bookings</h1>
          <div className="w-6" />
        </div>

        {/* Tab Filter Pills with accurate count reflection */}
        <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilter("Active")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === "Active"
                ? "bg-[#1e60ff] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilter("Completed")}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === "Completed"
                ? "bg-[#1e60ff] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setFilter("Cancelled")}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === "Cancelled"
                ? "bg-[#1e60ff] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Cancelled ({cancelledCount})
          </button>
        </div>

        {/* Bookings Card List or genuine empty/loading state */}
        <div className="px-4 py-3 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading your bookings...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 px-4 bg-white rounded-2xl border border-red-100 mt-2">
              <p className="text-xs text-red-600 font-semibold mb-3">{error}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                >
                  Retry
                </button>
              )}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-100 mt-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Navigation className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No {filter.toLowerCase()} bookings</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                {filter === "Active"
                  ? "You don't have any in-progress shipments right now. Book a truck to start shipping."
                  : `You have no ${filter.toLowerCase()} shipments recorded.`}
              </p>
            </div>
          ) : (
            filteredItems.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:border-slate-200 transition-all space-y-3"
              >
                {/* Header: Ref and Status */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900 tracking-tight">{b.ref}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      b.status === "In Transit"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : b.status === "Delivered"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>

                {/* Truck Photo + Route details */}
                <div className="flex items-center gap-3">
                  <div className="w-20 h-16 bg-slate-50 rounded-xl p-1 flex items-center justify-center shrink-0 border border-slate-100">
                    <img
                      src={b.vehicleImage}
                      alt={b.vehicleName}
                      className="max-h-12 max-w-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 truncate">
                      <span>{b.routeFrom}</span>
                      <span className="text-slate-400">→</span>
                      <span>{b.routeTo}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{b.date || "Date pending"}</p>
                    <p className="text-sm font-extrabold text-slate-900 mt-1">
                      {b.price != null ? `₹${Number(b.price).toLocaleString("en-IN")}` : "Quotation Pending"}
                    </p>
                  </div>
                </div>

                {/* Card Actions matching Screen 11 */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                  {b.status === "In Transit" ? (
                    <>
                      <button
                        onClick={() => onLiveTracking(b)}
                        className="py-2 px-3 rounded-xl border border-[#1e60ff] text-[#1e60ff] hover:bg-blue-50 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Live Tracking</span>
                      </button>
                      <button
                        onClick={() => onViewDetails(b)}
                        className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
                      >
                        View Details
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onViewDetails(b)}
                        className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => onDownloadInvoice(b)}
                        className="py-2 px-3 rounded-xl border border-[#1e60ff] text-[#1e60ff] hover:bg-blue-50 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Invoice</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
