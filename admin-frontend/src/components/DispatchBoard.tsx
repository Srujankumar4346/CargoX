import { useState, useMemo } from "react";
import {
  MapPin, Package, Truck, User, ChevronDown, ChevronUp,
  CheckCircle, Clock, Navigation, ExternalLink, Sparkles, Bot,
  ArrowRight, AlertCircle, Info, Send, Eye, Zap
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
  onCreateTrip: (booking: Booking, vehicleId: string, driverId: string) => Promise<void>;
  onGetAiRec: (booking: Booking) => Promise<void>;
}

// ── Real DeliveryRequest status lifecycle from backend enums ─────────────────
const STATUS_PIPELINE = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUOTED",
  "ACCEPTED",
  "VEHICLE_ASSIGNED",
  "DRIVER_ASSIGNED",
  "PICKUP_IN_PROGRESS",
  "IN_TRANSIT",
  "ARRIVED",
  "POD_SUBMITTED",
  "DELIVERED",
  "COMPLETED",
];

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

function googleMapsLink(lat?: number | null, lng?: number | null, address?: string): string {
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return "#";
}

function googleMapsRouteLink(booking: Booking): string {
  const pickup = booking.pickup_lat && booking.pickup_lng
    ? `${booking.pickup_lat},${booking.pickup_lng}`
    : encodeURIComponent(booking.pickup_address);
  const dest = booking.destination_lat && booking.destination_lng
    ? `${booking.destination_lat},${booking.destination_lng}`
    : encodeURIComponent(booking.destination_address);
  if (booking.pickup_lat && booking.destination_lat) {
    return `https://www.google.com/maps/dir/?api=1&origin=${pickup}&destination=${dest}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${pickup}&destination=${dest}`;
}

function statusPipelineIndex(status: string): number {
  return STATUS_PIPELINE.indexOf(status);
}

// ── Subcomponent: Status Pipeline ─────────────────────────────────────────────
function StatusPipeline({ status }: { status: string }) {
  const currentIdx = statusPipelineIndex(status);
  const isTerminal = status === "REJECTED" || status === "CUSTOMER_CANCELLED";

  if (isTerminal) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 w-fit">
        <AlertCircle size={13} className="text-red-400" />
        <span className="text-xs font-semibold text-red-400">{status.replace("_", " ")}</span>
      </div>
    );
  }

  const visible = STATUS_PIPELINE.slice(0, 7);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all
              ${active ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30" :
                done ? "bg-emerald-500/20 text-emerald-400" :
                "bg-slate-800 text-slate-600"}`}>
              {done && <CheckCircle size={9} />}
              {s.replace(/_/g, " ")}
            </div>
            {i < visible.length - 1 && (
              <ArrowRight size={8} className={done ? "text-emerald-500" : "text-slate-700"} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Subcomponent: Pricing Card ─────────────────────────────────────────────────
function PricingCard({ booking, activePricing }: { booking: Booking; activePricing: any }) {
  const hasCoords = !!(booking.pickup_lat && booking.destination_lat);
  const distKm = booking.distance_km ?? null;

  const canEstimate = distKm && activePricing;
  const ratePerKm = activePricing
    ? (parseFloat(activePricing.base_rate_per_km || "0") + parseFloat(activePricing.margin_per_km || "0"))
    : null;
  const estimatedTotal = canEstimate && ratePerKm ? (distKm * ratePerKm) : null;

  const needsApproval = booking.status === "SUBMITTED" || booking.status === "UNDER_REVIEW";

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center">
          <span className="text-emerald-400 text-sm font-bold">₹</span>
        </div>
        <h4 className="text-sm font-semibold text-slate-200">Pricing & Quotation</h4>
      </div>

      <div className="space-y-2">
        {distKm && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Distance {hasCoords ? "(GPS)" : "(Estimated)"}</span>
            <span className="text-slate-200 font-medium">{distKm} km</span>
          </div>
        )}
        {ratePerKm && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Rate (Active Config)</span>
            <span className="text-slate-200 font-medium">₹{ratePerKm.toFixed(2)} / km</span>
          </div>
        )}

        {needsApproval ? (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-amber-400 font-semibold">Quotation Status</span>
              <span className="text-amber-400 font-bold">Not Generated</span>
            </div>
            {estimatedTotal && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Frontend Estimate Only</span>
                <span className="text-slate-400">~₹{estimatedTotal.toFixed(0)}</span>
              </div>
            )}
            <div className="mt-2 p-2 bg-blue-500/5 border border-blue-500/15 rounded-lg">
              <p className="text-[10px] text-blue-400 leading-relaxed">
                <Info size={9} className="inline mr-1" />
                Final price is set at approval using the active PricingConfig. Estimate above is indicative only.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-emerald-400 font-semibold">Quotation Status</span>
              <span className="text-emerald-400 font-bold">Generated at Approval</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Backend quotation was created at approval using the then-active PricingConfig.
              See Financials → Invoices for the authoritative amount.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Subcomponent: Expanded Detail Workspace ───────────────────────────────────
function ExpandedWorkspace({
  booking,
  vehicles,
  drivers,
  activePricing,
  aiRec,
  onClose,
  onApprove,
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
  onCreateTrip: (booking: Booking, vehicleId: string, driverId: string) => Promise<void>;
  onGetAiRec: (booking: Booking) => Promise<void>;
}) {
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isGettingAi, setIsGettingAi] = useState(false);

  const availableVehicles = vehicles.filter((v) => v.status === "AVAILABLE");
  const availableDrivers = drivers.filter((d) => d.status === "AVAILABLE");

  const chosenVehicle = vehicles.find((v) => String(v.id) === selectedVehicle);
  const chosenDriver = drivers.find((d) => String(d.id) === selectedDriver);

  const cargoWeight = booking.weight_tons;
  const capacityWarning = chosenVehicle
    ? cargoWeight > parseFloat(String(chosenVehicle.capacity_tons))
    : false;

  const hasCoords = !!(booking.pickup_lat && booking.pickup_lng && booking.destination_lat && booking.destination_lng);

  const canApprove = booking.status === "SUBMITTED";
  const canDispatch = ["ACCEPTED", "SUBMITTED", "QUOTED"].includes(booking.status);
  const isAlreadyDispatched = [
    "VEHICLE_ASSIGNED", "DRIVER_ASSIGNED", "PICKUP_IN_PROGRESS",
    "IN_TRANSIT", "ARRIVED", "POD_SUBMITTED", "DELIVERED", "COMPLETED",
  ].includes(booking.status);

  async function handleApprove() {
    setIsApproving(true);
    try { await onApprove(booking.id); } finally { setIsApproving(false); }
  }

  async function handleDispatch() {
    if (!selectedVehicle || !selectedDriver) return;
    setIsDispatching(true);
    try { await onCreateTrip(booking, selectedVehicle, selectedDriver); } finally { setIsDispatching(false); }
  }

  async function handleAi() {
    setIsGettingAi(true);
    try { await onGetAiRec(booking); } finally { setIsGettingAi(false); }
  }

  return (
    <div className="border-t border-slate-700/60 bg-slate-900/50" style={{ animation: 'fade-in 0.2s ease forwards' }}>
      {/* Close bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-800/40 border-b border-slate-700/40">
        <StatusPipeline status={booking.status} />
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition px-2 py-1 rounded hover:bg-slate-700/50"
          aria-label="Collapse request details"
        >
          <ChevronUp size={14} /> Collapse
        </button>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── LEFT COLUMN: Route + Cargo ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Route & Locations */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Navigation size={14} className="text-blue-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-200">Route & Locations</h4>
              </div>
              {booking.distance_km && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                  <span className="text-blue-300 text-xs font-bold">{booking.distance_km} km</span>
                  {!hasCoords && <span className="text-blue-500 text-[9px]">(est.)</span>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pickup */}
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Pickup</span>
                </div>
                <p className="text-sm font-bold text-slate-100 mb-0.5">{booking.pickup_company_name}</p>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">{booking.pickup_address}</p>
                {booking.pickup_contact_person && (
                  <p className="text-xs text-slate-500 mb-0.5">Contact: {booking.pickup_contact_person}</p>
                )}
                {booking.pickup_phone && (
                  <p className="text-xs text-slate-500 mb-2">Phone: {booking.pickup_phone}</p>
                )}
                {booking.pickup_lat && (
                  <p className="text-[9px] text-slate-600 font-mono mb-2">
                    {booking.pickup_lat.toFixed(5)}, {booking.pickup_lng?.toFixed(5)}
                    <span className="text-emerald-700 ml-1">(GPS)</span>
                  </p>
                )}
                <a
                  href={googleMapsLink(booking.pickup_lat, booking.pickup_lng, booking.pickup_address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition"
                  aria-label="Open pickup location in Google Maps"
                >
                  <ExternalLink size={10} />
                  {booking.pickup_lat ? "View GPS on Maps" : "Search on Maps"}
                </a>
              </div>

              {/* Drop */}
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-red-500/20 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                  </div>
                  <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Drop</span>
                </div>
                <p className="text-sm font-bold text-slate-100 mb-0.5">{booking.destination_company_name}</p>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">{booking.destination_address}</p>
                {booking.destination_contact_person && (
                  <p className="text-xs text-slate-500 mb-0.5">Contact: {booking.destination_contact_person}</p>
                )}
                {booking.destination_phone && (
                  <p className="text-xs text-slate-500 mb-2">Phone: {booking.destination_phone}</p>
                )}
                {booking.destination_lat && (
                  <p className="text-[9px] text-slate-600 font-mono mb-2">
                    {booking.destination_lat.toFixed(5)}, {booking.destination_lng?.toFixed(5)}
                    <span className="text-emerald-700 ml-1">(GPS)</span>
                  </p>
                )}
                <a
                  href={googleMapsLink(booking.destination_lat, booking.destination_lng, booking.destination_address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition"
                  aria-label="Open drop location in Google Maps"
                >
                  <ExternalLink size={10} />
                  {booking.destination_lat ? "View GPS on Maps" : "Search on Maps"}
                </a>
              </div>
            </div>

            {/* Route CTA */}
            <div className="mt-3 pt-3 border-t border-slate-700/40 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{booking.pickup_address?.split(",")[0]}</span>
                <ArrowRight size={10} className="shrink-0" />
                <span className="truncate">{booking.destination_address?.split(",")[0]}</span>
              </div>
              <a
                href={googleMapsRouteLink(booking)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition shadow-sm shrink-0"
                aria-label="Open full route in Google Maps"
              >
                <Navigation size={11} /> Open Route in Maps
              </a>
            </div>

            {!hasCoords && (
              <p className="mt-2 text-[10px] text-slate-600 flex items-center gap-1">
                <Info size={9} />
                GPS coordinates not stored for this request — Maps links use address-based search.
              </p>
            )}
          </div>

          {/* Cargo Information */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <Package size={14} className="text-orange-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Cargo Information</h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Weight — MOST PROMINENT */}
              <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/25 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] text-orange-400/70 uppercase tracking-widest font-semibold mb-1">Total Weight</p>
                <p className="text-3xl font-black text-orange-300 leading-none">{booking.weight_tons}</p>
                <p className="text-sm font-bold text-orange-400 mt-0.5">TON</p>
              </div>

              {/* Cargo Type */}
              <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Cargo Type</p>
                <p className="text-sm font-bold text-slate-100 uppercase">{booking.goods_type}</p>
              </div>

              {/* Special Handling */}
              <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Special Handling</p>
                <p className={`text-xs font-semibold ${booking.special_instructions ? "text-amber-400" : "text-slate-400"}`}>
                  {booking.special_instructions ? "⚠ Required" : "None"}
                </p>
              </div>
            </div>

            {booking.goods_description && (
              <div className="mt-3 p-3 bg-slate-900/40 rounded-lg border border-slate-700/30">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Description</p>
                <p className="text-xs text-slate-300 leading-relaxed">{booking.goods_description}</p>
              </div>
            )}
          </div>

          {/* Additional Requirements */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <AlertCircle size={14} className="text-purple-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Additional Requirements</h4>
            </div>
            {booking.special_instructions ? (
              <div className="space-y-2">
                {booking.special_instructions.split(/[\n,;]+/).filter(Boolean).map((line, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle size={11} className="text-purple-400 mt-0.5 shrink-0" />
                    <span>{line.trim()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No additional instructions provided.</p>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: Status + Pricing + Assignment ── */}
        <div className="space-y-4">

          {/* Status & Actions */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-slate-700 rounded-lg flex items-center justify-center">
                <Clock size={13} className="text-slate-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Status & Actions</h4>
            </div>
            <div className="space-y-2 text-xs mb-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Request</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${statusColor(booking.status)}`}>
                  {booking.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Quotation</span>
                <span className={`font-semibold ${booking.status === "SUBMITTED" ? "text-amber-400" : "text-emerald-400"}`}>
                  {booking.status === "SUBMITTED" ? "Not Generated" : "Generated"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Trip</span>
                <span className={`font-semibold ${isAlreadyDispatched ? "text-emerald-400" : "text-slate-500"}`}>
                  {isAlreadyDispatched ? "Assigned" : "Not Assigned"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Submitted</span>
                <span className="text-slate-300 text-[10px] text-right">{formatDate(booking.created_at)}</span>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="space-y-2">
              {canApprove && (
                <button
                  id={`approve-btn-${booking.id}`}
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md shadow-emerald-900/30 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  aria-label={`Approve delivery request ${booking.request_number}`}
                >
                  <CheckCircle size={15} />
                  {isApproving ? "Approving..." : "Approve Request"}
                </button>
              )}

              <button
                id={`ai-btn-${booking.id}`}
                onClick={handleAi}
                disabled={isGettingAi}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 hover:text-purple-200 transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                aria-label="Get AI vehicle and route recommendation"
              >
                <Sparkles size={14} />
                {isGettingAi ? "Analyzing..." : "Get AI Recommendation"}
              </button>
            </div>
          </div>

          {/* Pricing */}
          <PricingCard booking={booking} activePricing={activePricing} />

          {/* AI Recommendation (if available) */}
          {aiRec && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bot size={14} className="text-purple-400" />
                <h4 className="text-sm font-semibold text-purple-300">AI Intelligence Report</h4>
              </div>
              {aiRec.vehicle?.vehicle && (
                <div className="mb-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Recommended Vehicle</p>
                  <p className="text-xs font-semibold text-slate-200">
                    {aiRec.vehicle.vehicle.vehicle_number || `Vehicle #${String(aiRec.vehicle.vehicle.id).substring(0,8)}`}
                  </p>
                  {aiRec.vehicle.score !== undefined && (
                    <p className="text-[10px] text-purple-400">Confidence: {aiRec.vehicle.score}/100</p>
                  )}
                  {aiRec.vehicle.reasons?.map((r, i) => (
                    <p key={i} className="text-[10px] text-slate-500 mt-0.5">• {r}</p>
                  ))}
                </div>
              )}
              {aiRec.price && (
                <div className="pt-2 border-t border-purple-500/10">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">AI Price Estimate</p>
                  <p className="text-xs text-purple-300 font-semibold">₹{aiRec.price.total}</p>
                  <p className="text-[9px] text-slate-600 mt-0.5">Indicative only — backend quotation is authoritative</p>
                </div>
              )}
            </div>
          )}

          {/* Assign Vehicle */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Truck size={13} className="text-blue-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Assign Vehicle</h4>
            </div>

            <select
              id={`vehicle-select-${booking.id}`}
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 text-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none transition mb-2"
              aria-label="Select available vehicle for assignment"
            >
              <option value="">Select Available Vehicle...</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  [{v.registration_number}] {v.type} — {v.capacity_tons} Ton
                </option>
              ))}
            </select>

            {chosenVehicle && (
              <div className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                capacityWarning
                  ? "bg-red-500/5 border-red-500/20"
                  : "bg-slate-900/60 border-slate-700/40"
              }`}>
                <div className="flex justify-between">
                  <span className="text-slate-500">Registration</span>
                  <span className="text-slate-200 font-mono font-semibold">{chosenVehicle.registration_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="text-slate-300">{chosenVehicle.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Capacity</span>
                  <span className={`font-bold ${capacityWarning ? "text-red-400" : "text-emerald-400"}`}>
                    {chosenVehicle.capacity_tons} Ton
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cargo Weight</span>
                  <span className={`font-bold ${capacityWarning ? "text-red-400" : "text-orange-300"}`}>
                    {booking.weight_tons} Ton
                  </span>
                </div>
                {capacityWarning && (
                  <p className="text-red-400 text-[10px] pt-1.5 border-t border-red-500/20 leading-relaxed">
                    ⚠ Cargo ({booking.weight_tons}T) exceeds vehicle capacity ({chosenVehicle.capacity_tons}T).
                    Backend validation will enforce this constraint.
                  </p>
                )}
              </div>
            )}

            {availableVehicles.length === 0 && (
              <p className="text-xs text-slate-500 italic">No vehicles currently AVAILABLE.</p>
            )}
          </div>

          {/* Assign Driver */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-teal-500/10 rounded-lg flex items-center justify-center">
                <User size={13} className="text-teal-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Assign Driver</h4>
            </div>

            <select
              id={`driver-select-${booking.id}`}
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 text-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none transition mb-2"
              aria-label="Select available driver for assignment"
            >
              <option value="">Select Available Driver...</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name} — {d.phone}
                </option>
              ))}
            </select>

            {chosenDriver && (
              <div className="p-3 rounded-lg border border-slate-700/40 bg-slate-900/60 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Name</span>
                  <span className="text-slate-200 font-semibold">{chosenDriver.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone</span>
                  <span className="text-slate-300">{chosenDriver.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">License</span>
                  <span className="text-slate-400 font-mono">{chosenDriver.license_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className="text-emerald-400 font-semibold">AVAILABLE</span>
                </div>
              </div>
            )}

            {availableDrivers.length === 0 && (
              <p className="text-xs text-slate-500 italic">No drivers currently AVAILABLE.</p>
            )}
          </div>

          {/* Primary Dispatch CTA */}
          {!isAlreadyDispatched && canDispatch && (
            <button
              id={`dispatch-btn-${booking.id}`}
              onClick={handleDispatch}
              disabled={isDispatching || !selectedVehicle || !selectedDriver}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-black bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              aria-label={`Create trip and dispatch for ${booking.request_number}`}
            >
              <Send size={15} />
              {isDispatching ? "Creating Trip..." : "Create Trip & Dispatch"}
            </button>
          )}

          {isAlreadyDispatched && (
            <div className="flex items-center gap-2 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-400">Trip Dispatched</p>
                <p className="text-[10px] text-slate-500 mt-0.5">View status in Active Trips tab</p>
              </div>
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

                  {/* Weight */}
                  <div className="shrink-0 text-center hidden sm:block">
                    <p className="text-xl font-black text-orange-300 leading-none">{booking.weight_tons}T</p>
                    <p className="text-[9px] text-orange-500/70 uppercase tracking-widest font-semibold">{booking.goods_type}</p>
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
