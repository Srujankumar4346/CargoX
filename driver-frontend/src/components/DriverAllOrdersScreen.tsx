import React, { useState, useMemo } from 'react';
import { ArrowLeft, HelpCircle, ChevronLeft, ChevronRight, Package, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface DriverAllOrdersScreenProps {
  onBack: () => void;
  onOpenHelp: () => void;
  orders: any[];
  onSelectOrder: (order: any) => void;
}

export const DriverAllOrdersScreen: React.FC<DriverAllOrdersScreenProps> = ({
  onBack,
  onOpenHelp,
  orders = [],
  onSelectOrder,
}) => {
  const [timeFilter, setTimeFilter] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [selectedDateIdx, setSelectedDateIdx] = useState<number>(2); // Default to Sun 18 (matching reference)
  const [orderTab, setOrderTab] = useState<'Completed' | 'Cancelled' | 'Missed'>('Completed');

  // Horizontal date pills (Fri 16, Sat 17, Sun 18 matching reference)
  const dates = [
    { day: 'Fri', date: '16' },
    { day: 'Sat', date: '17' },
    { day: 'Sun', date: '18' },
  ];

  // Filter orders based on status tab
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    return orders.filter((o) => {
      const s = (o.status || '').toUpperCase();
      if (orderTab === 'Completed') {
        return ['COMPLETED', 'DELIVERED', 'POD_SUBMITTED', 'ARRIVED'].includes(s);
      }
      if (orderTab === 'Cancelled') {
        return ['CANCELLED', 'CUSTOMER_CANCELLED', 'REJECTED'].includes(s);
      }
      if (orderTab === 'Missed') {
        return ['MISSED', 'EXPIRED'].includes(s);
      }
      return true;
    });
  }, [orders, orderTab]);

  // Aggregate stats
  const completedCount = filteredOrders.length;
  const orderEarnings = filteredOrders.reduce((acc, curr) => {
    const val = parseFloat(curr.driver_payable_amount || curr.amount_due_for_collection || curr.invoice_total_amount || 0);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  return (
    <div className="w-full max-w-md mx-auto pb-24 px-4 pt-3 flex flex-col gap-4 text-slate-900 bg-white min-h-screen">
      {/* 1. Header (Back button, All Orders, Help Pill) */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 text-slate-800 hover:text-black transition cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft size={22} className="stroke-[2.5]" />
          </button>
          <h1 className="text-xl font-black text-slate-950 tracking-tight">All Orders</h1>
        </div>

        <button
          type="button"
          onClick={onOpenHelp}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-700 bg-white shadow-2xs hover:bg-slate-50 transition cursor-pointer"
        >
          <HelpCircle size={15} />
          <span>Help</span>
        </button>
      </div>

      {/* 2. Time Filters (Day, Week, Month) - Yellow highlight on active */}
      <div className="flex rounded-xl bg-slate-100 p-1">
        {(['Day', 'Week', 'Month'] as const).map((filter) => {
          const isSelected = timeFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setTimeFilter(filter)}
              className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                isSelected
                  ? 'bg-[#FBBF24] text-slate-950 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {/* 3. Horizontal Date Selector */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => setSelectedDateIdx((prev) => Math.max(0, prev - 1))}
          disabled={selectedDateIdx === 0}
          className="p-1 rounded-full text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center gap-2.5">
          {dates.map((d, idx) => {
            const isSelected = selectedDateIdx === idx;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDateIdx(idx)}
                className={`w-14 py-2.5 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#0E6245] text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className={`text-[10px] font-medium ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {d.day}
                </span>
                <span className="text-sm font-extrabold leading-none mt-0.5">{d.date}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setSelectedDateIdx((prev) => Math.min(dates.length - 1, prev + 1))}
          disabled={selectedDateIdx === dates.length - 1}
          className="p-1 rounded-full text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 4. Summary Card (Completed Orders count & Order Earnings) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs grid grid-cols-2 divide-x divide-slate-100">
        <div className="flex flex-col items-center text-center pr-2">
          <span className="text-2xl font-black text-slate-950">{completedCount}</span>
          <span className="text-xs text-slate-400 font-medium mt-0.5">Completed Orders</span>
        </div>

        <div className="flex flex-col items-center text-center pl-2">
          <span className="text-2xl font-black text-emerald-600">
            ₹{orderEarnings.toLocaleString('en-IN')}
          </span>
          <span className="text-xs text-slate-400 font-medium mt-0.5">Order Earnings</span>
        </div>
      </div>

      {/* 5. Order History Tabs (Completed, Cancelled, Missed) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">Order History</h3>

        <div className="flex gap-2">
          {(['Completed', 'Cancelled', 'Missed'] as const).map((tab) => {
            const isSelected = orderTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setOrderTab(tab)}
                className={`py-1.5 px-3.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#FEF3C7] text-amber-800 border border-amber-300/80'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Order List / Empty State */}
      <div className="space-y-3">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order: any) => {
            const pickupCity = (order.pickup_address || 'Hyderabad').split(',')[0].trim();
            const destCity = (order.destination_address || 'Vijayawada').split(',')[0].trim();
            const orderAmount = parseFloat(order.invoice_total_amount || order.amount_due_for_collection || 2340);
            const statusLabel = order.status ? order.status.replace(/_/g, ' ') : 'Completed';

            return (
              <div
                key={order.trip_id || order.id || Math.random()}
                onClick={() => onSelectOrder(order)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition cursor-pointer flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-sm font-bold text-slate-900">
                      {pickupCity} → {destCity}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-emerald-600 block">
                      ₹{orderAmount.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                      {statusLabel}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                  <span>{order.assigned_at ? new Date(order.assigned_at).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '18 Oct, 02:30 PM'}</span>
                  <span>{order.vehicle_registration || 'Tata 407 • 1.5 Ton'}</span>
                </div>
              </div>
            );
          })
        ) : (
          // Empty State
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 flex flex-col items-center text-center my-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <Package size={24} />
            </div>
            <p className="text-sm font-bold text-slate-800">You have not completed any orders</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Orders assigned to your fleet vehicle will appear here once accepted.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverAllOrdersScreen;
