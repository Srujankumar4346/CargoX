import { useState, useEffect } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  IndianRupee,
  X,
  RefreshCw
} from "lucide-react";
import { api } from "../services/api";

interface PeriodBounds {
  period_type: string;
  start_date: string;
  end_date: string;
  display_range: string;
  prev_period_start?: string;
  next_period_start?: string;
  timezone: string;
}

interface FinancialSummary {
  period_customer_charges: number;
  total_invoices_issued: number;
  total_accepted_quotations: number;
  accepted_quotations_value: number;
  payments_collected: number;
  payment_transactions_count: number;
  upi_collections?: number;
  net_banking_collections?: number;
  pay_on_delivery_collections?: number;
  bank_transfer_collections?: number;
  outstanding_receivables: number;
  pod_awaiting_collection?: number;
  pending_confirmations_count?: number;
  unpaid_invoices_count: number;
  partially_paid_invoices_count: number;
  approved_operating_expenses: number;
  approved_trip_expenses: number;
  completed_vehicle_maintenance: number;
  pending_expenses_count: number;
  pending_expenses_amount: number;
  tax_charged_period: number;
  taxable_value_period: number;
  driver_payable_generated: number;
  driver_settlements_paid: number;
  driver_settlement_liabilities: number;
  cash_operating_profit: number;
  accrual_operating_margin: number;
  total_bookings: number;
  completed_trips: number;
  last_updated: string;
}

const formatINR = (val: number | string | undefined | null) => {
  const num = Number(val || 0);
  return `₹${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export default function FinancialControlCenter() {
  const [periodType, setPeriodType] = useState<"weekly" | "monthly" | "custom">("weekly");
  const [referenceDate, setReferenceDate] = useState<string>("");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const [periodBounds, setPeriodBounds] = useState<PeriodBounds | null>(null);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [totalBookings, setTotalBookings] = useState<number>(0);
  const [expensesBreakdown, setExpensesBreakdown] = useState<any>(null);
  const [settlementBreakdown, setSettlementBreakdown] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "bookings" | "expenses" | "settlements">("overview");

  // Booking 360 Detail Modal
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [bookingDetail, setBookingDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const params: any = { period: periodType };
      if (referenceDate) params.reference_date = referenceDate;
      if (periodType === "custom") {
        if (customStart) params.start_date = customStart;
        if (customEnd) params.end_date = customEnd;
      }

      const [sumRes, bookRes, expRes, setRes] = await Promise.allSettled([
        api.getFinancialSummary(params),
        api.getFinancialBookings({ ...params, search: search || undefined, page, page_size: 25 }),
        api.getFinancialExpenses(params),
        api.getFinancialSettlements(params)
      ]);

      if (sumRes.status === "fulfilled") {
        setPeriodBounds(sumRes.value.period);
        setSummary(sumRes.value.summary);
      }
      if (bookRes.status === "fulfilled") {
        setBookings(bookRes.value.bookings || []);
        setTotalBookings(bookRes.value.total_records || 0);
      }
      if (expRes.status === "fulfilled") {
        setExpensesBreakdown(expRes.value);
      }
      if (setRes.status === "fulfilled") {
        setSettlementBreakdown(setRes.value);
      }
    } catch (err) {
      console.error("Failed to load financial data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [periodType, referenceDate, customStart, customEnd, page]);

  const handlePrevPeriod = () => {
    if (periodBounds?.prev_period_start) {
      setReferenceDate(periodBounds.prev_period_start);
    }
  };

  const handleNextPeriod = () => {
    if (periodBounds?.next_period_start) {
      setReferenceDate(periodBounds.next_period_start);
    }
  };

  const handleExportCsv = async () => {
    try {
      const params: any = { period: periodType };
      if (referenceDate) params.reference_date = referenceDate;
      if (periodType === "custom") {
        if (customStart) params.start_date = customStart;
        if (customEnd) params.end_date = customEnd;
      }
      await api.exportFinancialCsv(params);
    } catch (err: any) {
      alert("Failed to export CSV: " + err.message);
    }
  };

  const openBooking360 = async (requestId: string) => {
    setSelectedBookingId(requestId);
    setDetailLoading(true);
    try {
      const data = await api.getBookingFinancial360(requestId);
      setBookingDetail(data);
    } catch (err: any) {
      alert("Failed to load booking financial audit: " + err.message);
      setSelectedBookingId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Controls & Period Selector ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <IndianRupee size={24} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Financial Control Center
                </h1>
                <p className="text-xs text-slate-400">
                  Authoritative weekly & monthly performance ledger • Asia/Kolkata (UTC+05:30)
                </p>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Period Mode Selector */}
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => { setPeriodType("weekly"); setReferenceDate(""); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition ${periodType === "weekly" ? "bg-blue-600 text-white shadow-md font-bold" : "text-slate-400 hover:text-white"}`}
              >
                Weekly
              </button>
              <button
                onClick={() => { setPeriodType("monthly"); setReferenceDate(""); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition ${periodType === "monthly" ? "bg-blue-600 text-white shadow-md font-bold" : "text-slate-400 hover:text-white"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => { setPeriodType("custom"); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition ${periodType === "custom" ? "bg-blue-600 text-white shadow-md font-bold" : "text-slate-400 hover:text-white"}`}
              >
                Custom
              </button>
            </div>

            {/* CSV Export */}
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/25 transition text-xs font-bold"
            >
              <Download size={14} /> Export CSV
            </button>

            {/* Refresh */}
            <button
              onClick={fetchFinanceData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
              title="Refresh Report"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-blue-400" : ""} />
            </button>
          </div>
        </div>

        {/* Date Navigation Strip */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {periodType !== "custom" && (
              <>
                <button
                  onClick={handlePrevPeriod}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Previous Period"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNextPeriod}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Next Period"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}

            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800">
              <Calendar size={14} className="text-blue-400 shrink-0" />
              <span className="text-xs font-mono font-bold text-white">
                {periodBounds?.display_range || "Loading period..."}
              </span>
            </div>

            {/* Direct date picker jump */}
            {periodType === "weekly" && (
              <input
                type="date"
                onChange={(e) => {
                  if (e.target.value) setReferenceDate(e.target.value);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300"
                title="Select any date to jump to containing week"
              />
            )}
            {periodType === "monthly" && (
              <input
                type="month"
                onChange={(e) => {
                  if (e.target.value) setReferenceDate(`${e.target.value}-01`);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300"
                title="Select month"
              />
            )}
          </div>

          {periodType === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                placeholder="Start Date"
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                placeholder="End Date"
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300"
              />
            </div>
          )}

          <div className="text-[11px] text-slate-400">
            Rule: <span className="text-emerald-400 font-semibold">New week activity starts at ₹0</span> • Historical unpaid debts preserved
          </div>
        </div>
      </div>

      {/* ── Summary Cards (Mobile Swipeable / Grid) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Customer Charges */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Customer Charges</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Period Invoiced
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-white tracking-tight">
            {formatINR(summary?.period_customer_charges)}
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center justify-between">
            <span>{summary?.total_invoices_issued || 0} invoices issued</span>
            <span className="text-slate-500">Taxable: {formatINR(summary?.taxable_value_period)}</span>
          </p>
        </div>

        {/* Card 2: Cash Collected */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Payments Collected</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Cash In
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-emerald-400 tracking-tight">
            {formatINR(summary?.payments_collected)}
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center justify-between">
            <span>{summary?.payment_transactions_count || 0} recorded payments</span>
            <span className="text-emerald-500/80 font-medium">Actual movement</span>
          </p>
        </div>

        {/* Card 3: Approved Expenses */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Operating Expenses</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Approved
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-purple-300 tracking-tight">
            {formatINR(summary?.approved_operating_expenses)}
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center justify-between">
            <span>Trips: {formatINR(summary?.approved_trip_expenses)}</span>
            <span>Maint: {formatINR(summary?.completed_vehicle_maintenance)}</span>
          </p>
        </div>

        {/* Card 4: Outstanding Receivables */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Outstanding Due</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Balance Sheet
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-amber-400 tracking-tight">
            {formatINR(summary?.outstanding_receivables)}
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center justify-between">
            <span>{summary?.unpaid_invoices_count || 0} unpaid</span>
            <span>{summary?.partially_paid_invoices_count || 0} partial</span>
          </p>
        </div>
      </div>

      {/* Secondary Metrics Strip: Taxes, Driver Payables, Settlements, Profit */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div>
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Tax Charged</span>
          <p className="text-lg font-bold text-white mt-0.5">{formatINR(summary?.tax_charged_period)}</p>
          <span className="text-[10px] text-slate-400">On issued invoices</span>
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Driver Payable Generated</span>
          <p className="text-lg font-bold text-blue-400 mt-0.5">{formatINR(summary?.driver_payable_generated)}</p>
          <span className="text-[10px] text-slate-400">Allocated driver pay</span>
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Driver Settlements Paid</span>
          <p className="text-lg font-bold text-emerald-400 mt-0.5">{formatINR(summary?.driver_settlements_paid)}</p>
          <span className="text-[10px] text-slate-400">Disbursed in period</span>
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Cash Operating Profit</span>
          <p className={`text-lg font-bold mt-0.5 ${(summary?.cash_operating_profit || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatINR(summary?.cash_operating_profit)}
          </p>
          <span className="text-[10px] text-slate-400">Collected − Approved Expenses</span>
        </div>
      </div>

      {/* Payment Channel Collections & Status Breakdown Strip */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Payment Channels & Collection Methods
          </span>
          <span className="text-[11px] text-slate-400">
            Reconciled collections for period
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-blue-400">UPI Collections</span>
            <p className="text-base font-black text-white mt-0.5">{formatINR(summary?.upi_collections)}</p>
            <span className="text-[10px] text-slate-500">Scan & Pay / QR</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-purple-400">Net Banking</span>
            <p className="text-base font-black text-white mt-0.5">{formatINR(summary?.net_banking_collections)}</p>
            <span className="text-[10px] text-slate-500">Gateway direct</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-emerald-400">Pay on Delivery</span>
            <p className="text-base font-black text-white mt-0.5">{formatINR(summary?.pay_on_delivery_collections)}</p>
            <span className="text-[10px] text-slate-500">Driver collected</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400">Bank Transfer</span>
            <p className="text-base font-black text-white mt-0.5">{formatINR(summary?.bank_transfer_collections)}</p>
            <span className="text-[10px] text-slate-500">NEFT / RTGS</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-amber-400">POD Awaiting</span>
            <p className="text-base font-black text-amber-300 mt-0.5">{formatINR(summary?.pod_awaiting_collection)}</p>
            <span className="text-[10px] text-slate-500">Due at delivery</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-cyan-400">Pending Confirms</span>
            <p className="text-base font-black text-white mt-0.5">{summary?.pending_confirmations_count || 0}</p>
            <span className="text-[10px] text-slate-500">Verification pending</span>
          </div>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveSubTab("overview")}
          className={`px-4 py-2 rounded-xl transition ${activeSubTab === "overview" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
        >
          Bookings Ledger ({totalBookings})
        </button>
        <button
          onClick={() => setActiveSubTab("expenses")}
          className={`px-4 py-2 rounded-xl transition ${activeSubTab === "expenses" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
        >
          Expenses Breakdown
        </button>
        <button
          onClick={() => setActiveSubTab("settlements")}
          className={`px-4 py-2 rounded-xl transition ${activeSubTab === "settlements" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
        >
          Driver Settlements
        </button>
      </div>

      {/* ── Content View 1: Bookings Ledger (Responsive Table & Mobile Cards) ── */}
      {activeSubTab === "overview" && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search by Request #, customer, destination, cargo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") fetchFinanceData(); }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => { setPage(1); fetchFinanceData(); }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
            >
              Search
            </button>
          </div>

          {/* Mobile Card List (Screen < md) */}
          <div className="md:hidden space-y-3">
            {bookings.length === 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
                No bookings recorded in this reporting period.
              </div>
            )}
            {bookings.map((row) => (
              <div
                key={row.request_id}
                onClick={() => openBooking360(row.request_id)}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition active:bg-slate-850 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-black text-blue-400">{row.request_number}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {row.trip_status}
                  </span>
                </div>

                <div className="text-xs font-bold text-white mb-1 truncate">{row.customer_name}</div>
                <div className="text-[11px] text-slate-400 mb-2 truncate">
                  {row.pickup_address} → {row.destination_address}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Invoice</span>
                    <span className="font-bold text-white">{formatINR(row.invoice_total)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Paid</span>
                    <span className="font-bold text-emerald-400">{formatINR(row.amount_paid)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Due</span>
                    <span className="font-bold text-amber-400">{formatINR(row.amount_due)}</span>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Expenses: {formatINR(row.approved_trip_expenses)}</span>
                  <span className="text-blue-400 font-semibold flex items-center gap-1">
                    Audit 360° <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Data Table (Screen >= md) */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3.5">Request #</th>
                    <th className="px-4 py-3.5">Customer & Route</th>
                    <th className="px-4 py-3.5">Cargo</th>
                    <th className="px-4 py-3.5">Trip Status</th>
                    <th className="px-4 py-3.5 text-right">Invoice Total</th>
                    <th className="px-4 py-3.5 text-right">Paid</th>
                    <th className="px-4 py-3.5 text-right">Due</th>
                    <th className="px-4 py-3.5 text-right">Expenses</th>
                    <th className="px-4 py-3.5 text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {bookings.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No bookings found for the selected period.
                      </td>
                    </tr>
                  )}
                  {bookings.map((row) => (
                    <tr key={row.request_id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-blue-400">{row.request_number}</span>
                        <div className="text-[10px] text-slate-500">
                          {new Date(row.booking_date).toLocaleDateString("en-IN")}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-semibold text-white truncate">{row.customer_name}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {row.pickup_address} → {row.destination_address}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.goods_type}</div>
                        <div className="text-[10px] text-slate-500">{row.weight_tons} Tons</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {row.trip_status}
                        </span>
                        {row.vehicle_registration && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.vehicle_registration}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-white">
                        {formatINR(row.invoice_total)}
                        {row.tax_amount ? (
                          <div className="text-[10px] text-slate-500">Tax: {formatINR(row.tax_amount)}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                        {formatINR(row.amount_paid)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-400">
                        {formatINR(row.amount_due)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-purple-300">
                        {formatINR(row.approved_trip_expenses)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openBooking360(row.request_id)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white transition text-xs font-bold"
                        >
                          View 360°
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Content View 2: Expenses Breakdown ── */}
      {activeSubTab === "expenses" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white">Operating Expenses By Category</h3>
            <span className="text-xs text-slate-400">
              Total Approved: <strong className="text-white">{formatINR(expensesBreakdown?.total_approved_operating_expenses)}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {expensesBreakdown?.categories?.map((cat: any) => (
              <div key={cat.category} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs uppercase text-slate-300 tracking-wider">{cat.category}</span>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {formatINR(cat.approved_amount)}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span>Approved Count:</span>
                    <span className="font-semibold text-white">{cat.approved_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending Approval:</span>
                    <span className="text-amber-400">{cat.pending_count} ({formatINR(cat.pending_amount)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rejected:</span>
                    <span className="text-red-400">{cat.rejected_count} ({formatINR(cat.rejected_amount)})</span>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs uppercase text-slate-300 tracking-wider">Vehicle Maintenance</span>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {formatINR(expensesBreakdown?.vehicle_maintenance_completed)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Completed scheduled & repair maintenance workshops during this period.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Content View 3: Driver Settlements ── */}
      {activeSubTab === "settlements" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white">Driver Settlements Allocation & Disbursement</h3>
            <span className="text-xs text-slate-400">CargoX Internal Margins Protected</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Settlements Generated
              </span>
              <p className="text-2xl font-black text-blue-400">{formatINR(settlementBreakdown?.total_payout_generated)}</p>
              <div className="text-xs text-slate-400 mt-2 space-y-1">
                <div>Driver Payable: {formatINR(settlementBreakdown?.driver_payable_generated)}</div>
                <div>CargoX Service Fee: {formatINR(settlementBreakdown?.service_fee_generated)}</div>
                <div>Reimbursements: {formatINR(settlementBreakdown?.reimbursements_generated)}</div>
                <div>Deductions: {formatINR(settlementBreakdown?.deductions_generated)}</div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Settlements Paid
              </span>
              <p className="text-2xl font-black text-emerald-400">{formatINR(settlementBreakdown?.total_payout_paid)}</p>
              <p className="text-xs text-slate-400 mt-2">
                {settlementBreakdown?.settlements_paid_count || 0} settlements successfully transferred to drivers in this period.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Pending Payment Liabilities
              </span>
              <p className="text-2xl font-black text-amber-400">{formatINR(settlementBreakdown?.outstanding_settlement_liability)}</p>
              <p className="text-xs text-slate-400 mt-2">
                {settlementBreakdown?.pending_payment_count || 0} generated settlements awaiting disbursement.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Booking 360° Financial Audit Slide-over / Modal ── */}
      {selectedBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
            <button
              onClick={() => { setSelectedBookingId(null); setBookingDetail(null); }}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X size={18} />
            </button>

            {detailLoading || !bookingDetail ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                <RefreshCw size={24} className="animate-spin text-blue-400 mx-auto mb-3" />
                Loading comprehensive booking audit...
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                      {bookingDetail.request_number}
                    </span>
                    <span className="text-xs text-slate-400">360° Financial Audit</span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-1">
                    {bookingDetail.customer_company_name}
                  </h2>
                </div>

                {/* Section A: Booking & Trip Summary */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                  <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-2">Trip Specifications</h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>Route: <span className="font-semibold text-white">{bookingDetail.pickup_address} → {bookingDetail.destination_address}</span></div>
                    <div>Distance: <span className="font-semibold text-white">{bookingDetail.distance_km ? `${bookingDetail.distance_km} km` : "—"}</span></div>
                    <div>Cargo: <span className="font-semibold text-white">{bookingDetail.goods_type} ({bookingDetail.weight_tons} Tons)</span></div>
                    <div>Vehicle: <span className="font-semibold text-white font-mono">{bookingDetail.vehicle_registration || "Unassigned"}</span></div>
                    <div>Driver: <span className="font-semibold text-white">{bookingDetail.driver_name || "Unassigned"}</span></div>
                    <div>Status: <span className="font-semibold text-emerald-400">{bookingDetail.booking_status}</span></div>
                  </div>
                </div>

                {/* Section B: Invoicing & Collections */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-3">
                  <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">Customer Invoicing</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Invoice Total</span>
                      <span className="font-bold text-white text-sm">{formatINR(bookingDetail.invoice_total)}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{bookingDetail.invoice_number || "Draft"}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Collected</span>
                      <span className="font-bold text-emerald-400 text-sm">{formatINR(bookingDetail.amount_paid)}</span>
                      <span className="text-[10px] text-emerald-500/80 block mt-0.5">Paid</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Outstanding</span>
                      <span className="font-bold text-amber-400 text-sm">{formatINR(bookingDetail.amount_due)}</span>
                      <span className="text-[10px] text-amber-500/80 block mt-0.5">Due</span>
                    </div>
                  </div>
                </div>

                {/* Section C: Driver Allocation (Admin-only confidential breakdown) */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">
                      Driver Allocation & Margin Snapshot
                    </h4>
                    <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                      CONFIDENTIAL ADMIN ONLY
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-slate-300">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Service Fee ({bookingDetail.service_fee_percentage || 4}%)</span>
                      <span className="font-bold text-blue-400 text-sm">{formatINR(bookingDetail.service_fee_amount)}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Driver Payable</span>
                      <span className="font-bold text-white text-sm">{formatINR(bookingDetail.driver_payable_amount)}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Settlement Status</span>
                      <span className="font-bold text-purple-300 text-sm">{bookingDetail.settlement_status || "PENDING"}</span>
                    </div>
                  </div>
                </div>

                {/* Section D: Itemized Trip Expenses */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">Itemized Trip Expenses</h4>
                    <span className="text-xs font-bold text-purple-300">
                      Total Approved: {formatINR(bookingDetail.total_approved_expenses)}
                    </span>
                  </div>
                  {bookingDetail.expenses.length === 0 ? (
                    <p className="text-slate-500 italic py-2">No expenses logged on this trip.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {bookingDetail.expenses.map((exp: any) => (
                        <div key={exp.id} className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 text-xs">
                          <div>
                            <span className="font-bold text-white mr-2">{exp.category}</span>
                            <span className="text-slate-500 text-[10px]">{new Date(exp.date).toLocaleDateString("en-IN")}</span>
                            {exp.description && <p className="text-slate-400 text-[11px] mt-0.5">{exp.description}</p>}
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-white block">{formatINR(exp.amount)}</span>
                            <span className={`text-[10px] font-bold ${exp.status === "APPROVED" ? "text-emerald-400" : exp.status === "REJECTED" ? "text-red-400" : "text-amber-400"}`}>
                              {exp.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
