import React, { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, Wallet, ArrowUpRight } from 'lucide-react';

interface DriverEarningsScreenProps {
  onBack: () => void;
  settlements?: any[];
  totalEarningsAmount?: number;
  completedOrdersCount?: number;
  availableBalance?: number;
}

export const DriverEarningsScreen: React.FC<DriverEarningsScreenProps> = ({
  onBack,
  settlements = [],
  totalEarningsAmount = 4320,
  completedOrdersCount = 12,
  availableBalance = 6450,
}) => {
  const [timeFilter, setTimeFilter] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [selectedDateIdx, setSelectedDateIdx] = useState<number>(2); // Sun 18

  const dates = [
    { day: 'Fri', date: '16' },
    { day: 'Sat', date: '17' },
    { day: 'Sun', date: '18' },
  ];

  // Bar chart values (Matching Reference Screen 6)
  const chartData = [
    { label: 'Fri 16', amount: '₹2,340', heightPct: '85%' },
    { label: 'Sat 17', amount: '₹1,980', heightPct: '72%' },
    { label: 'Sun 18', amount: '₹0', heightPct: '12%' },
  ];

  return (
    <div className="w-full max-w-md mx-auto pb-24 px-4 pt-3 flex flex-col gap-4 text-slate-900 bg-white min-h-screen">
      {/* 1. Header (Back button, Earnings title) */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 -ml-1 text-slate-800 hover:text-black transition cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft size={22} className="stroke-[2.5]" />
        </button>
        <h1 className="text-xl font-black text-slate-950 tracking-tight">Earnings</h1>
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

      {/* 4. Total Earnings & Completed Orders Heading */}
      <div className="space-y-0.5 pt-1">
        <span className="text-xs font-semibold text-slate-400">Total Earnings</span>
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-black text-emerald-600 tracking-tight">
            ₹{totalEarningsAmount.toLocaleString('en-IN')}
          </span>
          <span className="text-xs font-bold text-slate-400">
            {completedOrdersCount} Completed Orders
          </span>
        </div>
      </div>

      {/* 5. Clean Earnings Bar Chart Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="h-44 flex items-end justify-around gap-6 pt-6">
          {chartData.map((bar) => (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <span className="text-[11px] font-bold text-emerald-700">{bar.amount}</span>
              <div
                className="w-full max-w-[50px] rounded-t-lg bg-[#A7F3D0] transition-all duration-500 hover:bg-emerald-400"
                style={{ height: bar.heightPct }}
              />
              <span className="text-[11px] font-semibold text-slate-400 mt-1">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Payout & History Card */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">Payout & History</h3>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-medium">Available Balance</span>
            <span className="text-xl font-black text-emerald-600 mt-0.5">
              ₹{availableBalance.toLocaleString('en-IN')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => alert(`Available payout balance ₹${availableBalance.toLocaleString('en-IN')} will be settled to your registered bank account on weekly cycle.`)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <span>Statement</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Real Settlements list from backend if present */}
        {settlements.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-xs mt-3">
            {settlements.map((s) => (
              <div key={s.id} className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">Period: {new Date(s.period_start).toLocaleDateString()} - {new Date(s.period_end).toLocaleDateString()}</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">Ref: {s.reference_number || 'STMT-CX'}</p>
                </div>
                <div className="text-right">
                  <span className="font-black text-slate-900">₹{parseFloat(s.total_payout || s.driver_payable_amount || 0).toFixed(2)}</span>
                  <span className="block text-[10px] text-emerald-600 font-bold uppercase">{s.status || 'PAID'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverEarningsScreen;
