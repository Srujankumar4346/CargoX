import { useState, useMemo, useEffect } from "react";
import {
  Package, Truck, User, ChevronUp,
  CheckCircle, Navigation, Sparkles,
  ArrowRight, Info, Send, Eye, XCircle, Zap, RotateCw
} from "lucide-react";

// ── Types matching actual backend schemas ──────────────────────────────────────
interface Booking {
  id: string;
  request_number: string;
  status: string;
  // Cargo
  goods_type: string;
  goods_description?: string | null;
  weight_tons: number;
  special_instructions?: string | null;
  // Pickup
  pickup_company_name: string;
  pickup_address: string;
  pickup_contact_person?: string | null;
  pickup_phone?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  // Destination
  destination_company_name: string;
  destination_address: string;
  destination_contact_person?: string | null;
  destination_phone?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  // Metrics
  distance_km?: number | null;
  // Pricing / Quote details
  booked_price?: number | null;
  customer_booked_price?: number | null;
  vehicle_capacity_tons?: number | null;
  selected_vehicle_id?: string | null;
  quotation?: {
    id: string;
    quotation_number?: string;
    status: string;
    distance_km: number;
    base_rate_per_km: number;
    internal_base_cost: number;
    cargox_margin: number;
    base_fare: number;
    distance_charge: number;
    capacity_surcharge: number;
    handling_surcharge: number;
    customer_total_charge: number;
    service_fee_percentage?: number | null;
    service_fee_amount?: number | null;
    driver_payable_amount?: number | null;
    selected_vehicle_id?: string | null;
    created_at?: string;
    accepted_at?: string;
  } | null;
  created_at: string;
  updated_at: string;
  cancellation_reason?: string | null;
}

interface Vehicle {
  id: string;
  registration_number: string;
  type: string;
  capacity_tons: number | string;
  status: string;
  is_deletable?: boolean;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  license_number: string;
  status: string;
  age?: number;
}

interface AiRec {
  vehicle?: { vehicle?: { id: string; vehicle_number?: string }; score?: number; reasons?: string[] };
  price?: { total?: number; base?: number; distance?: number; margin?: number };
}

interface Props {
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
  activePricing: any;
  aiRecommendations: Record<string, AiRec>;
  onApprove: (bookingId: string) => Promise<void>;
  onCancel?: (bookingId: string) => Promise<void>;
  onUnassign?: (bookingId: string) => Promise<void>;
  onCreateTrip: (
    booking: Booking,
    vehicleId: string,
    driverId: string,
    commissionPercentage?: number,
    driverPayout?: number,
    commissionAmount?: number
  ) => Promise<void>;
  onGetAiRec: (booking: Booking) => Promise<void>;
}



const FILTER_TABS = [
  { label: "All Requests", value: "ALL" },
  { label: "Pending Approval", value: "SUBMITTED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "In Transit", value: "IN_TRANSIT" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Completed", value: "COMPLETED" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusColor(status: string): string {
  switch (status) {
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "bg-amber-500/15 text-amber-300 border border-amber-500/30";
    case "QUOTED":
    case "ACCEPTED":
      return "bg-blue-500/15 text-blue-300 border border-blue-500/30";
    case "VEHICLE_ASSIGNED":
    case "DRIVER_ASSIGNED":
    case "PICKUP_IN_PROGRESS":
      return "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30";
    case "IN_TRANSIT":
      return "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30";
    case "ARRIVED":
    case "POD_SUBMITTED":
      return "bg-teal-500/15 text-teal-300 border border-teal-500/30";
    case "DELIVERED":
    case "COMPLETED":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
    case "REJECTED":
    case "CUSTOMER_CANCELLED":
      return "bg-red-500/15 text-red-400 border border-red-500/30";
    default:
      return "bg-slate-700/50 text-slate-400 border border-slate-600";
  }
}

function statusDot(status: string): string {
  switch (status) {
    case "SUBMITTED":
    case "UNDER_REVIEW": return "bg-amber-400";
    case "ACCEPTED":
    case "QUOTED": return "bg-blue-400";
    case "IN_TRANSIT": return "bg-cyan-400";
    case "DELIVERED":
    case "COMPLETED": return "bg-emerald-400";
    case "REJECTED":
    case "CUSTOMER_CANCELLED": return "bg-red-400";
    default: return "bg-slate-500";
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch {
    return iso;
  }
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

// Map selected_vehicle_id or goods_description to user-friendly vehicle model name
function getRequestedVehicleType(booking: Booking): { name: string; capacity?: string; isPartLoad?: boolean } {
  const vehId = (booking.selected_vehicle_id || booking.quotation?.selected_vehicle_id || "").toLowerCase();
  const desc = (booking.goods_description || "").toLowerCase();

  if (vehId === "part-load" || desc.includes("part load") || desc.includes("shared truck")) {
    return { name: "Part Load (Shared Truck)", capacity: "1-3000 kg", isPartLoad: true };
  }
  if (vehId === "tata-ace" || desc.includes("tata ace")) {
    return { name: "Tata Ace", capacity: "750 kg" };
  }
  if (vehId === "pickup-8ft" || desc.includes("pickup 8ft") || desc.includes("dost")) {
    return { name: "Pickup 8ft (Dost)", capacity: "1200 kg" };
  }
  if (vehId === "pickup-9ft" || desc.includes("pickup 9ft") || desc.includes("bolero")) {
    return { name: "Pickup 9ft (Bolero)", capacity: "1700 kg" };
  }
  if (vehId === "14ft-open" || desc.includes("14ft (open)") || desc.includes("14ft open")) {
    return { name: "14ft (Open)", capacity: "3500 kg" };
  }
  if (vehId === "14ft-closed" || desc.includes("14ft (closed)") || desc.includes("14ft closed")) {
    return { name: "14ft (Closed)", capacity: "3500 kg" };
  }
  if (vehId === "17ft-closed" || desc.includes("17ft closed") || desc.includes("17ft")) {
    return { name: "17ft Closed", capacity: "6000 kg" };
  }

  // Fallback to weight-based deduction if available
  const weight = Number(booking.weight_tons || 0);
  if (weight > 0 && weight <= 0.75) return { name: "Tata Ace", capacity: "750 kg" };
  if (weight > 0.75 && weight <= 1.2) return { name: "Pickup 8ft", capacity: "1200 kg" };
  if (weight > 1.2 && weight <= 1.7) return { name: "Pickup 9ft", capacity: "1700 kg" };
  if (weight > 1.7 && weight <= 3.5) return { name: "14ft Truck", capacity: "3500 kg" };
  if (weight > 3.5) return { name: "17ft+ Heavy Truck", capacity: "6000 kg" };

  return { name: "Standard Cargo Truck", capacity: "Flexible" };
}



// ── Subcomponent: Expanded Detail Workspace Matching Reference Design ─────────────
function ExpandedWorkspace({
  booking,
  vehicles,
  drivers,
  activePricing,
  aiRec,
  onClose,
  onApprove,
  onCancel,
  onUnassign,
  onCreateTrip,
  onGetAiRec,
}: {
  booking: Booking;
  vehicles: Vehicle[];
  drivers: Driver[];
  activePricing: any;
  aiRec?: AiRec;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onCancel?: (id: string) => Promise<void>;
  onUnassign?: (id: string) => Promise<void>;
  onCreateTrip: (
    booking: Booking,
    vehicleId: string,
    driverId: string,
    commissionPercentage?: number,
    driverPayout?: number,
    commissionAmount?: number
  ) => Promise<void>;
  onGetAiRec: (booking: Booking) => Promise<void>;
}) {
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isGettingAi, setIsGettingAi] = useState(false);

  // Filter vehicles: must be AVAILABLE and capacity >= weight
  const cargoWeightTons = Number(booking.weight_tons || 0);
  const availableVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const cap = parseFloat(String(v.capacity_tons || 0));
      return v.status === "AVAILABLE" && cap >= cargoWeightTons;
    });
  }, [vehicles, cargoWeightTons]);

  const availableDrivers = useMemo(() => {
    return drivers.filter((d) => d.status === "AVAILABLE");
  }, [drivers]);

  // Pre-select first eligible vehicle and driver if not selected
  useEffect(() => {
    if (!selectedVehicle && availableVehicles.length > 0) {
      setSelectedVehicle(String(availableVehicles[0].id));
    }
  }, [availableVehicles, selectedVehicle]);

  useEffect(() => {
    if (!selectedDriver && availableDrivers.length > 0) {
      setSelectedDriver(String(availableDrivers[0].id));
    }
  }, [availableDrivers, selectedDriver]);

  const chosenVehicle = vehicles.find((v) => String(v.id) === selectedVehicle);
  const chosenDriver = drivers.find((d) => String(d.id) === selectedDriver);

  // Authoritative quotation numbers
  const quote = booking.quotation;
  const distKm = quote?.distance_km ?? Number(booking.distance_km || 0);
  const ratePerKm = quote?.base_rate_per_km ?? (activePricing ? parseFloat(activePricing.base_rate_per_km || "20") : 20);

  // Base Freight = distance * rate
  const baseFreightAmount = quote
    ? (quote.distance_charge && quote.distance_charge > 0 ? quote.distance_charge : Math.round(distKm * ratePerKm))
    : Math.round(distKm * ratePerKm);

  // Additional charges (base fare / flat fee / capacity surcharge)
  const additionalCharges = quote
    ? Math.round((quote.base_fare || 0) + (quote.capacity_surcharge || 0))
    : Math.round(parseFloat(activePricing?.base_flat_fare || "300"));

  // Handling charges
  const handlingCharges = quote ? Math.round(quote.handling_surcharge || 0) : 0;

  // Taxable Fare (Customer total freight amount strictly EXCLUDING GST)
  const taxableFare = useMemo(() => {
    if (quote && quote.customer_total_charge && Number(quote.customer_total_charge) > 0) {
      return Math.round(Number(quote.customer_total_charge));
    }
    if (booking.booked_price && Number(booking.booked_price) > 0) {
      return Math.round(Number(booking.booked_price));
    }
    return Math.round(baseFreightAmount + additionalCharges + handlingCharges);
  }, [quote, booking.booked_price, baseFreightAmount, additionalCharges, handlingCharges]);

  // GST 5% on transport logistics (standard freight without ITC)
  const gstRate = 0.05;
  const gstAmount = Math.round(taxableFare * gstRate);
  const totalCustomerAmount = taxableFare + gstAmount;

  // Percentage-based commission state (default 5%)
  const [commissionPctInput, setCommissionPctInput] = useState<string>("5");

  // Dynamic monetary calculations:
  // commission_amount = round(taxable_fare * comm_pct / 100)
  // driver_payment = taxable_fare - commission_amount
  // total_allocated = driver_payment + commission_amount
  // difference = taxable_fare - total_allocated
  const { commPct, commAmount, driverPay, totalAllocated, remainingDiff } = useMemo(() => {
    const rawPct = parseFloat(commissionPctInput);
    const validPct = isNaN(rawPct) ? 0 : Math.min(100, Math.max(0, rawPct));
    const calculatedComm = Math.round((taxableFare * validPct) / 100);
    const calculatedDriver = Math.max(0, taxableFare - calculatedComm);
    const allocated = calculatedComm + calculatedDriver;
    const diff = taxableFare - allocated;
    return {
      commPct: validPct,
      commAmount: calculatedComm,
      driverPay: calculatedDriver,
      totalAllocated: allocated,
      remainingDiff: diff,
    };
  }, [taxableFare, commissionPctInput]);

  const driverPct = taxableFare > 0 ? ((driverPay / taxableFare) * 100).toFixed(1) : "0.0";
  const commissionDisplayPct = taxableFare > 0 ? ((commAmount / taxableFare) * 100).toFixed(1) : "0.0";

  // Check validation rules
  const isPctValid = !isNaN(parseFloat(commissionPctInput)) && parseFloat(commissionPctInput) >= 0 && parseFloat(commissionPctInput) <= 100;
  const canDispatch = ["ACCEPTED", "SUBMITTED", "QUOTED"].includes(booking.status);
  const isAlreadyDispatched = [
    "VEHICLE_ASSIGNED", "DRIVER_ASSIGNED", "PICKUP_IN_PROGRESS",
    "IN_TRANSIT", "ARRIVED", "POD_SUBMITTED", "DELIVERED", "COMPLETED",
  ].includes(booking.status);

  const canCancel = !["DELIVERED", "COMPLETED", "CUSTOMER_CANCELLED", "REJECTED"].includes(booking.status);

  async function handleApprove() {
    setIsApproving(true);
    try { await onApprove(booking.id); } finally { setIsApproving(false); }
  }

  async function handleCancel() {
    if (!onCancel) return;
    setIsCancelling(true);
    try { await onCancel(booking.id); } finally { setIsCancelling(false); }
  }

  async function handleDispatch() {
    if (!selectedVehicle || !selectedDriver || !isPctValid) return;
    setIsDispatching(true);
    try {
      await onCreateTrip(
        booking,
        selectedVehicle,
        selectedDriver,
        commPct,
        driverPay,
        commAmount
      );
    } finally {
      setIsDispatching(false);
    }
  }

  async function handleAi() {
    setIsGettingAi(true);
    try { await onGetAiRec(booking); } finally { setIsGettingAi(false); }
  }

  // Format dates for Pricing & Quotation Details
  const createdDateStr = booking.created_at ? formatDate(booking.created_at) : "17 Oct 2026, 07:12 pm";
  const acceptedDateStr = booking.updated_at ? formatDate(booking.updated_at) : "17 Oct 2026, 08:45 pm";

  return (
    <div className="border-t border-slate-800 bg-[#0b1324] text-slate-100 p-6 space-y-5" style={{ animation: 'fade-in 0.2s ease forwards' }}>
      
      {/* ── HEADER: Request Details + Status Pipeline + Action Buttons ── */}
      <div className="bg-[#111c38] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Request Title, Badge & Pipeline */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Truck size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-lg font-bold text-white tracking-tight">Request Details</h3>
                  <span className="text-sm font-semibold text-slate-400">#{booking.request_number}</span>
                  <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {booking.status === "ACCEPTED" ? "Accepted" : booking.status.replace(/_/g, " ")}
                  </span>
                  {(() => {
                    const reqVeh = getRequestedVehicleType(booking);
                    return (
                      <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        <Truck size={12} className="text-blue-400" />
                        <span>Wanted: <strong className="text-white">{reqVeh.name}</strong></span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Stepper Pipeline */}
            <div className="flex items-center gap-2 sm:gap-6 pt-1 flex-wrap">
              {/* Step 1: Request */}
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-emerald-500/40">
                  <CheckCircle size={14} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Request</p>
                  <p className="text-[10px] text-slate-400">17 Oct, 08:45 pm</p>
                </div>
              </div>
              <div className="w-8 sm:w-12 h-0.5 bg-emerald-500/60" />

              {/* Step 2: Quotation */}
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-emerald-500/40">
                  <CheckCircle size={14} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Quotation</p>
                  <p className="text-[10px] text-slate-400">Generated</p>
                </div>
              </div>
              <div className="w-8 sm:w-12 h-0.5 bg-blue-500/60" />

              {/* Step 3: Trip */}
              <div className="flex items-center gap-2.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isAlreadyDispatched ? "bg-emerald-500 text-white" : "border-2 border-blue-500 bg-blue-500/20 text-blue-400"
                }`}>
                  {isAlreadyDispatched ? <CheckCircle size={14} /> : <div className="w-2 h-2 rounded-full bg-blue-400" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Trip</p>
                  <p className="text-[10px] text-slate-400">{isAlreadyDispatched ? "Assigned" : "Not Assigned"}</p>
                </div>
              </div>
              <div className="w-8 sm:w-12 h-0.5 bg-slate-700/60" />

              {/* Step 4: Completed */}
              <div className="flex items-center gap-2.5 opacity-60">
                <div className="w-6 h-6 rounded-full border border-slate-600 bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-300">Completed</p>
                  <p className="text-[10px] text-slate-500">Pending</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 justify-center">
            {aiRec?.vehicle?.vehicle && (
              <div className="text-[10px] text-purple-300 bg-purple-950/40 border border-purple-500/30 px-3 py-1.5 rounded-lg">
                ✨ AI Recommends: {aiRec.vehicle.vehicle.vehicle_number || "Suggested Vehicle"} ({aiRec.vehicle.score || 95}% match)
              </div>
            )}
            {booking.status === "SUBMITTED" && (
              <button
                id={`approve-btn-${booking.id}`}
                onClick={handleApprove}
                disabled={isApproving}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md shadow-emerald-950/40 disabled:opacity-60"
              >
                <CheckCircle size={14} className="text-white" />
                {isApproving ? "Approving..." : "Approve Request"}
              </button>
            )}
            <button
              onClick={handleAi}
              disabled={isGettingAi}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#3b1261]/80 hover:bg-[#4d1680] text-purple-200 border border-purple-500/40 transition shadow-md shadow-purple-950/40 disabled:opacity-60"
            >
              <Sparkles size={14} className="text-purple-300" />
              {isGettingAi ? "Analyzing..." : "Get AI Recommendation"}
            </button>
            {canCancel && onCancel && (
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-[#3a1523]/80 hover:bg-[#521c30] text-red-300 border border-red-500/30 transition disabled:opacity-50"
              >
                <XCircle size={14} className="text-red-400" />
                {isCancelling ? "Cancelling..." : "Cancel Order"}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition rounded-lg hover:bg-slate-800/60"
            >
              <ChevronUp size={14} /> Collapse Details
            </button>
          </div>
        </div>
      </div>

      {/* ── 2-COLUMN MAIN CONTENT GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ════════════════════ LEFT COLUMN ════════════════════ */}
        <div className="space-y-5">

          {/* 1. Customer & Trip Information Card */}
          <div className="bg-[#111c38] border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                <User size={15} />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">Customer &amp; Trip Information</h4>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Customer Name</span>
                <span className="text-slate-100 font-semibold">{booking.pickup_company_name || "Srujan Kumar Sangepu"}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Customer Mobile</span>
                <span className="text-slate-100 font-semibold font-mono">{booking.pickup_phone || "8919271456"}</span>
              </div>

              <div className="flex justify-between items-start py-1 border-b border-slate-800/60 gap-4">
                <span className="text-slate-400 font-medium shrink-0">Pickup Location</span>
                <div className="flex items-start gap-1.5 text-right justify-end max-w-[280px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 mt-0.5 shadow-sm shadow-emerald-400/50" />
                  <span className="text-slate-200 leading-snug">{booking.pickup_address}</span>
                </div>
              </div>

              <div className="flex justify-between items-start py-1 border-b border-slate-800/60 gap-4">
                <span className="text-slate-400 font-medium shrink-0">Drop Location</span>
                <div className="flex items-start gap-1.5 text-right justify-end max-w-[280px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0 mt-0.5 shadow-sm shadow-red-400/50" />
                  <span className="text-slate-200 leading-snug">{booking.destination_address}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Distance (Route)</span>
                <div className="flex items-center gap-1.5 font-bold text-slate-100">
                  <Navigation size={13} className="text-teal-400" />
                  <span>{distKm} km</span>
                </div>
              </div>

              {/* Customer Requested Vehicle Type */}
              {(() => {
                const reqVeh = getRequestedVehicleType(booking);
                return (
                  <div className="flex justify-between items-center py-1.5 border-b border-blue-500/20 bg-blue-950/20 px-2 rounded-lg -mx-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-blue-400 font-semibold">Requested Vehicle</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">Customer Choice</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-xs font-black text-white">{reqVeh.name}</span>
                        {reqVeh.capacity && (
                          <span className="block text-[10px] text-blue-300/80 font-mono">Max: {reqVeh.capacity}</span>
                        )}
                      </div>
                      <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                        <Truck size={12} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Cargo Type</span>
                <div className="flex items-center gap-1.5 text-slate-100 font-semibold">
                  <Package size={13} className="text-amber-400" />
                  <span>{booking.goods_type}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Cargo Weight</span>
                <div className="flex items-center gap-1.5 font-bold text-slate-100">
                  <span className="text-blue-400 font-black">⚖</span>
                  <span>{booking.weight_tons} Ton</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Dimensions (L × W × H)</span>
                <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                  <span className="text-purple-400">🧊</span>
                  <span>2.0 × 1.5 × 1.5 m</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-medium">Handling Type</span>
                <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                  <span className="text-blue-400">🛡</span>
                  <span>{booking.special_instructions ? "Fragile / Special Care" : "Standard"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Assign Vehicle Card */}
          <div className="bg-[#111c38] border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                  <Truck size={15} />
                </div>
                <h4 className="text-sm font-bold text-white tracking-tight">Assign Vehicle</h4>
              </div>
            </div>

            {/* Vehicle Selection dropdown */}
            <div className="mb-3">
              <select
                id={`vehicle-select-${booking.id}`}
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#0d162d] text-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none transition"
                aria-label="Select vehicle for assignment"
              >
                <option value="">Select Available Vehicle...</option>
                {availableVehicles.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.type} [{v.registration_number}] — {v.capacity_tons} Ton
                  </option>
                ))}
              </select>
            </div>

            {/* Rich Vehicle Card Display */}
            {chosenVehicle ? (
              <div className="bg-[#0e1730] border border-slate-700/80 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {/* Vehicle Icon / Thumbnail */}
                  <div className="w-16 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                    <Truck size={28} className="text-slate-300" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white">{chosenVehicle.type}</h5>
                    <div className="flex items-center gap-4 mt-1 text-xs">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Payload Capacity</span>
                        <span className="font-bold text-slate-100">{chosenVehicle.capacity_tons} Ton</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Vehicle Number</span>
                        <span className="font-bold text-slate-100 font-mono">{chosenVehicle.registration_number}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  Selected
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No vehicle selected or none available with ≥ {booking.weight_tons}T capacity.</p>
            )}
          </div>

          {/* 3. Assign Driver Card */}
          <div className="bg-[#111c38] border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-500/15 flex items-center justify-center text-teal-400">
                  <User size={15} />
                </div>
                <h4 className="text-sm font-bold text-white tracking-tight">Assign Driver</h4>
              </div>
            </div>

            {/* Driver Selection dropdown */}
            <div className="mb-3">
              <select
                id={`driver-select-${booking.id}`}
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#0d162d] text-slate-200 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none transition"
                aria-label="Select driver for assignment"
              >
                <option value="">Select Available Driver...</option>
                {availableDrivers.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name} — {d.phone} ({d.license_number})
                  </option>
                ))}
              </select>
            </div>

            {/* Rich Driver Card Display */}
            {chosenDriver ? (
              <div className="bg-[#0e1730] border border-slate-700/80 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {/* Driver Avatar */}
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <User size={24} className="text-slate-300" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white">{chosenDriver.name}</h5>
                    <div className="text-xs text-slate-400 space-y-0.5 mt-0.5">
                      <p>Mobile: <span className="text-slate-200 font-mono font-medium">{chosenDriver.phone}</span></p>
                      <p>License: <span className="text-slate-200 font-mono font-medium">{chosenDriver.license_number}</span></p>
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  Selected
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No available driver selected.</p>
            )}
          </div>

          {/* 4. Allocation Summary Card (with Donut Chart) */}
          <div className="bg-[#111c38] border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                <span className="text-xs font-bold">🥧</span>
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">Allocation Summary</h4>
            </div>

            <div className="flex items-center justify-between gap-6">
              {/* Left: Summary rows */}
              <div className="space-y-4 flex-1">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shrink-0 shadow-sm shadow-teal-400/50" />
                    <span className="text-xs font-semibold text-slate-300">Driver Payment</span>
                  </div>
                  <div className="ml-4.5 flex items-baseline gap-2">
                    <span className="text-base font-extrabold text-white font-mono">₹{driverPay.toLocaleString("en-IN")}</span>
                    <span className="text-xs text-slate-400 font-mono">{driverPct}%</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 shadow-sm shadow-amber-400/50" />
                    <span className="text-xs font-semibold text-slate-300">CargoX Commission</span>
                  </div>
                  <div className="ml-4.5 flex items-baseline gap-2">
                    <span className="text-base font-extrabold text-white font-mono">₹{commAmount.toLocaleString("en-IN")}</span>
                    <span className="text-xs text-slate-400 font-mono">{commissionDisplayPct}%</span>
                  </div>
                </div>
              </div>

              {/* Right: SVG Donut Chart */}
              <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#1e293b"
                    strokeWidth="12"
                  />
                  {/* Driver Payment Slice (teal/blue) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#0284c7"
                    strokeWidth="12"
                    strokeDasharray={`${(parseFloat(driverPct) / 100) * 238.76} 238.76`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />
                  {/* CargoX Commission Slice (amber) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#f59e0b"
                    strokeWidth="12"
                    strokeDasharray={`${(parseFloat(commissionDisplayPct) / 100) * 238.76} 238.76`}
                    strokeDashoffset={`-${(parseFloat(driverPct) / 100) * 238.76}`}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
                  <span className="text-xs font-black text-white font-mono leading-tight">₹{taxableFare.toLocaleString("en-IN")}</span>
                  <span className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">Taxable Fare</span>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* ════════════════════ RIGHT COLUMN ════════════════════ */}
        <div className="space-y-5">

          {/* 1. Customer Fare & GST Breakdown Card */}
          <div className="bg-[#111c38] border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-bold">
                  ₹
                </div>
                <h4 className="text-sm font-bold text-white tracking-tight">Customer Fare &amp; GST Breakdown</h4>
              </div>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                From Accepted Quotation
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-medium">Base Freight ({distKm} km @ ₹{ratePerKm}/km)</span>
                <span className="text-slate-100 font-mono font-bold text-sm">₹{baseFreightAmount.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-medium">Additional Charges</span>
                <span className="text-slate-100 font-mono font-bold text-sm">₹{additionalCharges.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-medium">Handling Charge (Standard)</span>
                <span className="text-slate-100 font-mono font-bold text-sm">₹{handlingCharges.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-slate-300 font-bold">Taxable Amount</span>
                <span className="text-slate-100 font-mono font-black text-sm">₹{taxableFare.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center pb-2">
                <span className="text-slate-400 font-medium">GST (5%)</span>
                <span className="text-slate-200 font-mono font-bold text-sm">₹{gstAmount.toLocaleString("en-IN")}</span>
              </div>

              {/* Total Customer Amount Banner */}
              <div className="bg-[#193774] border border-blue-500/40 rounded-xl px-4 py-3 flex items-center justify-between mt-2">
                <span className="text-xs font-bold text-white tracking-wide">Total Customer Amount (Incl. GST)</span>
                <span className="text-lg font-black text-white font-mono">₹{totalCustomerAmount.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* 2. Pricing & Quotation Details Card */}
          <div className="bg-[#111c38] border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                  <Package size={15} />
                </div>
                <h4 className="text-sm font-bold text-white tracking-tight">Pricing &amp; Quotation Details</h4>
              </div>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Generated at Approval
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Distance (GPS)</span>
                <span className="text-slate-100 font-mono font-bold">{distKm} km</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Rate (Active Config)</span>
                <span className="text-slate-100 font-mono font-bold">₹{ratePerKm.toFixed(2)} / km</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Quotation Status</span>
                <span className="text-emerald-400 font-bold">Generated</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Quotation ID</span>
                <span className="text-slate-200 font-mono font-semibold">{quote?.quotation_number || `QUO-${new Date().getFullYear()}-${booking.id.substring(0, 5).toUpperCase()}`}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Generated On</span>
                <span className="text-slate-300">{createdDateStr}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-medium">Accepted On</span>
                <span className="text-slate-300">{acceptedDateStr}</span>
              </div>
            </div>
          </div>

          {/* 3. Driver Payment & CargoX Commission Card (Percentage-Based) */}
          <div className="bg-[#111c38] border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                <span className="text-xs font-bold">💼</span>
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">Driver Payment &amp; CargoX Commission</h4>
            </div>

            {/* Info callout banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-950/40 border border-blue-900/60 text-xs text-blue-200/90 leading-relaxed">
              <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
              <span>Allocate the customer's taxable fare (excluding GST) between driver payment and CargoX commission using commission percentage.</span>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Customer Taxable Fare */}
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Customer Taxable Fare</span>
                <span className="text-lg font-black text-white font-mono">₹{taxableFare.toLocaleString("en-IN")}</span>
              </div>

              {/* CargoX Commission (%) Input */}
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <label htmlFor={`commission-pct-${booking.id}`} className="text-slate-400 font-medium">
                  CargoX Commission (%)
                </label>
                <div className="relative w-28">
                  <input
                    id={`commission-pct-${booking.id}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={commissionPctInput}
                    onChange={(e) => setCommissionPctInput(e.target.value)}
                    className="w-full pl-3 pr-7 py-1.5 rounded-lg border border-slate-700 bg-[#0d162d] text-slate-100 text-sm font-mono font-bold text-right focus:border-blue-500 focus:outline-none transition"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>

              {/* Commission Amount (₹) */}
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <div>
                  <span className="text-slate-400 font-medium block">Commission Amount (₹)</span>
                  <span className="text-[10px] text-slate-500 font-mono">({commPct}% of ₹{taxableFare.toLocaleString("en-IN")})</span>
                </div>
                <span className="text-base font-extrabold text-white font-mono">₹{commAmount.toLocaleString("en-IN")}</span>
              </div>

              {/* Driver Payment (Remaining Balance) */}
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <div>
                  <span className="text-slate-400 font-medium block">Driver Payment (Remaining Balance)</span>
                  <span className="text-[10px] text-slate-500 font-mono">(₹{taxableFare.toLocaleString("en-IN")} - ₹{commAmount.toLocaleString("en-IN")})</span>
                </div>
                <span className="text-base font-extrabold text-white font-mono">₹{driverPay.toLocaleString("en-IN")}</span>
              </div>

              {/* Total Allocated Amount */}
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Total Allocated Amount</span>
                <span className="text-base font-black text-emerald-400 font-mono">₹{totalAllocated.toLocaleString("en-IN")}</span>
              </div>

              {/* Remaining / Difference */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-medium">Remaining / Difference</span>
                <span className={`text-base font-black font-mono ${remainingDiff === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  ₹{remainingDiff.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. TRIP & DISPATCH BOTTOM BANNER ── */}
      <div className="bg-[#111c38] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Send size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-tight">Trip &amp; Dispatch</h4>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                <Info size={13} className="text-blue-400" />
                <span>
                  {!selectedVehicle
                    ? "Select an available vehicle to proceed."
                    : !selectedDriver
                    ? "Select an available driver to proceed."
                    : !isPctValid
                    ? "Commission percentage must be between 0% and 100%."
                    : "All required details are completed. You can now create the trip and dispatch."}
                </span>
              </div>
            </div>
          </div>

          {!isAlreadyDispatched && canDispatch && (
            <button
              id={`dispatch-btn-${booking.id}`}
              onClick={handleDispatch}
              disabled={isDispatching || !selectedVehicle || !selectedDriver || !isPctValid}
              className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 w-full md:w-auto"
            >
              <Send size={16} />
              {isDispatching ? "Creating Trip..." : "Create Trip & Dispatch"}
            </button>
          )}

          {isAlreadyDispatched && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-400 text-xs font-bold">
                <CheckCircle size={15} />
                Trip Dispatched &amp; Driver Assigned
              </div>

              {onUnassign && ["DRIVER_ASSIGNED", "VEHICLE_ASSIGNED"].includes(booking.status) && (
                <button
                  type="button"
                  disabled={isUnassigning}
                  onClick={async () => {
                    const confirmChange = window.confirm(
                      `Are you sure you want to change the assignment for ${booking.request_number}? This will reset the booking back to ACCEPTED and release the vehicle/driver.`
                    );
                    if (!confirmChange) return;
                    setIsUnassigning(true);
                    try {
                      await onUnassign(booking.id);
                    } catch (e: any) {
                      alert(`Could not change assignment: ${e?.message || e}`);
                    } finally {
                      setIsUnassigning(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <RotateCw size={13} className={isUnassigning ? "animate-spin" : ""} />
                  <span>{isUnassigning ? "Resetting..." : "Change Assignment (Unassign)"}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Main DispatchBoard Component ───────────────────────────────────────────────
export default function DispatchBoard({
  bookings,
  vehicles,
  drivers,
  activePricing,
  aiRecommendations,
  onApprove,
  onCancel,
  onUnassign,
  onCreateTrip,
  onGetAiRec,
}: Props) {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const DISPATCH_STATUSES = [
    "SUBMITTED", "UNDER_REVIEW", "QUOTED", "ACCEPTED",
    "VEHICLE_ASSIGNED", "DRIVER_ASSIGNED", "PICKUP_IN_PROGRESS",
    "IN_TRANSIT", "ARRIVED", "POD_SUBMITTED", "DELIVERED"
  ];

  const filtered = useMemo(() => {
    let result = bookings.filter((b) => DISPATCH_STATUSES.includes(b.status));

    if (activeFilter !== "ALL") {
      result = result.filter((b) => b.status === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) =>
        b.request_number?.toLowerCase().includes(q) ||
        b.pickup_company_name?.toLowerCase().includes(q) ||
        b.destination_company_name?.toLowerCase().includes(q) ||
        b.pickup_address?.toLowerCase().includes(q) ||
        b.destination_address?.toLowerCase().includes(q) ||
        b.goods_type?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [bookings, activeFilter, searchQuery]);

  const pendingCount = bookings.filter((b) => b.status === "SUBMITTED").length;
  const acceptedCount = bookings.filter((b) => b.status === "ACCEPTED").length;
  const inTransitCount = bookings.filter((b) => b.status === "IN_TRANSIT").length;

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">Dispatch Board</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Review requests, verify requirements, assign resources and create trips
            </p>
          </div>

          {/* Live stat pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {pendingCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-amber-400">{pendingCount} Pending Approval</span>
              </div>
            )}
            {acceptedCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                <span className="text-xs font-bold text-blue-400">{acceptedCount} Ready to Dispatch</span>
              </div>
            )}
            {inTransitCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                <Zap size={10} className="text-cyan-400" />
                <span className="text-xs font-bold text-cyan-400">{inTransitCount} In Transit</span>
              </div>
            )}
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <input
              id="dispatch-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search request, customer, location, cargo..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-700 bg-slate-800/60 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none transition"
              aria-label="Search dispatch requests"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {FILTER_TABS.map((tab) => {
              const count = tab.value === "ALL"
                ? bookings.filter((b) => DISPATCH_STATUSES.includes(b.status)).length
                : bookings.filter((b) => b.status === tab.value).length;
              if (tab.value !== "ALL" && count === 0) return null;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                    activeFilter === tab.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700"
                  }`}
                  aria-pressed={activeFilter === tab.value}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Request List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 border border-slate-700">
            <Package size={24} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold mb-1">
            {searchQuery ? "No requests match your search" : "No requests in this category"}
          </p>
          <p className="text-slate-600 text-sm">
            {searchQuery ? "Try a different search term" : "New requests will appear here automatically"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((booking) => {
            const isExpanded = expandedId === booking.id;
            return (
              <div
                key={booking.id}
                className={`bg-slate-900/80 border rounded-xl overflow-hidden transition-all duration-200 ${
                  isExpanded
                    ? "border-blue-500/40 shadow-lg shadow-blue-900/20"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Always-visible compact row */}
                <div className="flex items-center gap-3 px-5 py-4 flex-wrap">
                  {/* Request # */}
                  <div className="shrink-0 min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot(booking.status)}`} />
                      <span className="text-sm font-black text-slate-100 font-mono">{booking.request_number}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 ml-4">{shortDate(booking.created_at)}</span>
                  </div>

                  {/* Route */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-bold text-slate-200 truncate">{booking.pickup_company_name}</span>
                      <ArrowRight size={11} className="text-slate-600 shrink-0" />
                      <span className="text-sm text-slate-400 truncate">{booking.destination_company_name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {booking.pickup_address?.split(",")[0]}
                      </span>
                      <ArrowRight size={8} className="text-slate-700 shrink-0" />
                      <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {booking.destination_address?.split(",")[0]}
                      </span>
                      {booking.distance_km && (
                        <span className="text-[10px] text-blue-400 font-semibold shrink-0">{booking.distance_km} km</span>
                      )}
                    </div>
                  </div>

                  {/* Requested Vehicle & Weight */}
                  <div className="shrink-0 text-right hidden sm:block">
                    {(() => {
                      const reqVeh = getRequestedVehicleType(booking);
                      return (
                        <div className="flex items-center gap-2 justify-end">
                          <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/25 text-right">
                            <div className="flex items-center gap-1 justify-end text-[11px] font-black text-blue-300">
                              <Truck size={11} className="text-blue-400 shrink-0" />
                              <span>{reqVeh.name}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-medium">{booking.weight_tons}T • {booking.goods_type}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Status */}
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide shrink-0 ${statusColor(booking.status)}`}>
                    {booking.status.replace(/_/g, " ")}
                  </span>

                  {/* CTA */}
                  <button
                    onClick={() => toggleExpand(booking.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                      isExpanded
                        ? "bg-blue-600 text-white"
                        : "bg-blue-600/15 text-blue-400 border border-blue-600/25 hover:bg-blue-600/25"
                    }`}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? `Collapse ${booking.request_number}` : `View and assign ${booking.request_number}`}
                  >
                    {isExpanded ? (
                      <><ChevronUp size={12} /> Collapse</>
                    ) : (
                      <><Eye size={12} /> View &amp; Assign</>
                    )}
                  </button>
                </div>

                {/* Expanded workspace */}
                {isExpanded && (
                  <ExpandedWorkspace
                    booking={booking}
                    vehicles={vehicles}
                    drivers={drivers}
                    activePricing={activePricing}
                    aiRec={aiRecommendations[booking.id]}
                    onClose={() => setExpandedId(null)}
                    onApprove={onApprove}
                    onCancel={onCancel}
                    onUnassign={onUnassign}
                    onCreateTrip={onCreateTrip}
                    onGetAiRec={onGetAiRec}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
