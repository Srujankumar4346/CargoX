import { useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";

export interface CustomerOrderRecord {
  id: string;
  ref: string;
  serviceType: string;
  routeFrom: string;
  routeTo: string;
  dateTimeStr: string;
  weightKg: number;
  paymentType: string;
  status: "Ongoing" | "Completed" | "Cancelled" | "In Transit";
  fare: number;
  image?: string;
}

interface CustomerOrdersScreenProps {
  onBack?: () => void;
  ordersList?: CustomerOrderRecord[];
  onTrackOrder?: (order: CustomerOrderRecord) => void;
  isLoading?: boolean;
}

export default function CustomerOrdersScreen({
  onBack,
  ordersList = [],
  onTrackOrder,
  isLoading = false,
}: CustomerOrdersScreenProps) {
  const [activeTab, setActiveTab] = useState<"Ongoing" | "Completed" | "Cancelled">("Ongoing");

  // Fallback sample order matching Screen 7 reference if no active backend orders exist
  const defaultSampleOrders: CustomerOrderRecord[] = [
    {
      id: "ord-part-load-1",
      ref: "REQ-PL-9821",
      serviceType: "Part Load",
      routeFrom: "Hyderabad",
      routeTo: "Vijayawada",
      dateTimeStr: "18 Oct, 09:00 AM",
      weightKg: 200,
      paymentType: "Cash",
      status: "Ongoing",
      fare: 2811,
      image: "/images/vehicles/ashok-leyland-dost.png",
    },
  ];

  const displayedList = ordersList.length > 0 ? ordersList : defaultSampleOrders;

  const filteredOrders = displayedList.filter((o) => {
    if (activeTab === "Ongoing") {
      return o.status === "Ongoing" || o.status === "In Transit";
    }
    if (activeTab === "Completed") {
      return o.status === "Completed";
    }
    if (activeTab === "Cancelled") {
      return o.status === "Cancelled";
    }
    return true;
  });

  return (
    <div className="min-h-full flex-1 bg-[#f4f7fb] text-slate-900 pb-28 select-none overflow-y-auto">
      {/* Top Header matching Screen 7 */}
      <div className="bg-white px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3 flex items-center gap-3 border-b border-slate-100 shadow-2xs">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base font-extrabold text-slate-900">My Orders</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Filter Tabs: Ongoing | Completed | Cancelled matching Screen 7 */}
        <div className="grid grid-cols-3 gap-2 bg-slate-200/60 p-1 rounded-2xl">
          {(["Ongoing", "Completed", "Cancelled"] as const).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-[#0866F5] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Order Cards List matching Screen 7 */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <div className="w-7 h-7 border-2 border-[#0866F5] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-slate-500">Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
              <p className="text-sm font-black text-slate-800">No {activeTab} Orders</p>
              <p className="text-xs text-slate-400 mt-1">Your shipments in this tab will appear here.</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => onTrackOrder?.(order)}
                role="button"
                tabIndex={0}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/90 hover:border-blue-200 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-12 bg-slate-50 rounded-xl p-1 flex items-center justify-center shrink-0">
                      <img
                        src={order.image || "/images/vehicles/ashok-leyland-dost.png"}
                        alt={order.serviceType}
                        className="max-h-10 max-w-full object-contain"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-slate-900">{order.serviceType}</p>
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          In Transit <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-700 mt-1 flex items-center gap-1">
                        <span className="text-emerald-600">●</span> {order.routeFrom} <span className="text-slate-400">→</span> {order.routeTo}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        📅 {order.dateTimeStr}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        ⚖️ {order.weightKg} kg • {order.paymentType}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">
                      ₹{order.fare.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
