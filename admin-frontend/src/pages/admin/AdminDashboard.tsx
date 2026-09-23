import { useState, useEffect } from "react";
import { LogOut, Map as MapIcon, Download, Bot, Sparkles, ShieldCheck, RefreshCw, AlertCircle, Users, Eye, Edit2, Trash2, UserPlus, UserMinus, Menu, X, AlertTriangle, Activity, Truck, UserRound, ClipboardList, IndianRupee, Search, ArrowUpRight, MapPin, CircleCheck, Package, Radio, ChevronRight, Settings } from "lucide-react";
import { useAuth, UserButton, useUser, SignInButton } from "@clerk/react";
import { Link } from "react-router-dom";
import { api, setTokenGetter } from "../../services/api";
import NotificationDropdown from "../../components/NotificationDropdown";
import { generateInvoicePDF } from "../../utils/invoicePDF";
import ThemeToggle from "../../components/ThemeToggle";
import DispatchBoard from "../../components/DispatchBoard";
import FleetManagementPanel from "../../components/FleetManagementPanel";
import ActiveTripsPanel from "../../components/ActiveTripsPanel";
import AdminSettingsPanel from "../../components/AdminSettingsPanel";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

const normalizeStatus = (status: string | undefined) => (status || "").toUpperCase().replace(/ /g, "_");

const formatCurrency = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";
};

const formatDate = (value: string | undefined) => value
  ? new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  : "Recent";

function DashboardSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-800/80 ${className}`} aria-label="Loading" />;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  const tone = ["AVAILABLE", "COMPLETED", "DELIVERED"].includes(normalized)
    ? "text-emerald-300 bg-emerald-400/10 border-emerald-400/20"
    : ["SUBMITTED", "REQUESTED", "ACCEPTED", "UNDER_REVIEW"].includes(normalized)
      ? "text-amber-300 bg-amber-400/10 border-amber-400/20"
      : ["REJECTED", "CUSTOMER_CANCELLED", "INACTIVE"].includes(normalized)
        ? "text-red-300 bg-red-400/10 border-red-400/20"
        : "text-blue-300 bg-blue-400/10 border-blue-400/20";
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold tracking-[0.12em] ${tone}`}>{status?.replace(/_/g, " ") || "UNKNOWN"}</span>;
}

function SectionHeader({ icon, title, meta, onViewAll }: { icon: React.ReactNode; title: string; meta?: string; onViewAll?: () => void }) {
  return <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
    <div className="flex items-center gap-2.5"><span className="text-blue-400">{icon}</span><h2 className="text-sm font-bold tracking-[0.08em] text-white uppercase">{title}</h2>{meta && <span className="text-xs text-slate-500">{meta}</span>}</div>
    {onViewAll && <button onClick={onViewAll} className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300">View all <ChevronRight size={14} /></button>}
  </div>;
}

function FleetOperationsMap({ trips }: { trips: any[] }) {
  const locatedTrips = trips.filter((trip) => Number.isFinite(Number(trip.current_lat)) && Number.isFinite(Number(trip.current_lng)));
  if (!locatedTrips.length) return <div className="flex h-full min-h-70 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-6 text-center"><div className="rounded-full bg-blue-500/10 p-3 text-blue-400"><MapPin size={22} /></div><p className="text-sm font-semibold text-slate-200">Live fleet locations unavailable</p><p className="max-w-xs text-xs leading-5 text-slate-500">Location data will appear when active vehicle GPS data is available.</p></div>;
  const first = locatedTrips[0];
  return <div className="relative h-80 overflow-hidden rounded-xl border border-slate-800">
    <MapContainer center={[Number(first.current_lat), Number(first.current_lng)]} zoom={7} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {locatedTrips.map((trip) => <CircleMarker key={String(trip.id)} center={[Number(trip.current_lat), Number(trip.current_lng)]} radius={8} pathOptions={{ color: "#38bdf8", fillColor: "#0ea5e9", fillOpacity: 0.85 }}><Popup><strong>Trip #{String(trip.id).slice(-6)}</strong><br />{trip.request?.request_number || "Active trip"}<br />{trip.status}</Popup></CircleMarker>)}
    </MapContainer>
    <div className="pointer-events-none absolute left-3 top-3 z-400 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-slate-200 shadow-lg"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />{locatedTrips.length} live location{locatedTrips.length === 1 ? "" : "s"}</div>
  </div>;
}

// ── In-App Confirm Modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, confirmLabel, confirmClass, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-5">
          <div className="shrink-0 w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition shadow-sm ${confirmClass || 'bg-red-600 hover:bg-red-500'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Validation / formatting helpers ─────────────────────────────────────────
/** Title-case every word: "john doe" → "John Doe" */
const toTitleCase = (val: string) =>
  val.replace(/\b\w/g, (c) => c.toUpperCase());

/** Format Aadhaar: digits only → XXXX XXXX XXXX */
const formatAadhaar = (val: string) => {
  const digits = val.replace(/\D/g, "").slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
};

/** Indian vehicle registration: XX 00 XX 0000 (uppercase, no spaces stored) */
// Accepts: XX00XX0000 or XX0XX0000 — state(2) + district(2) + series(1-2) + num(4)
const VEHICLE_REG_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;

/** Indian driving licence hint: SSYYNNNNNNNNN (state 2 letters + RTO 2 digits + year 4 + 7 digits) */
// Common formats: TN0120210012345 or DL-0120110012345 — validated at submit
// ─────────────────────────────────────────────────────────────────────────────

// ── Mask Aadhaar (show only last 4 digits) ───────────────────────────────────
const maskAadhaar = (val: string) => {
  const digits = (val || "").replace(/\D/g, "");
  if (digits.length < 4) return "XXXX XXXX " + digits.padStart(4, 'X');
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
};
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<Record<number, any>>({});

  // Pricing
  const [activePricing, setActivePricing] = useState<any>(null);
  const [isUpdatingPricing, setIsUpdatingPricing] = useState(false);

  // Form states for strict validation
  const [newDriverAadhaar, setNewDriverAadhaar] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverAge, setNewDriverAge] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverLicense, setNewDriverLicense] = useState("");
  const [newVehicleReg, setNewVehicleReg] = useState("");

  // ── In-app Confirm Modal state ───────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmClass?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    onConfirm: () => {},
  });

  const showConfirm = (opts: {
    title: string;
    message: string;
    confirmLabel: string;
    confirmClass?: string;
    onConfirm: () => void;
  }) => {
    setConfirmModal({ open: true, ...opts });
  };

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, open: false }));
  // ─────────────────────────────────────────────────────────────────────────

  // Wire Clerk token retrieval into API service
  useEffect(() => {
    if (getToken) {
      setTokenGetter(getToken);
    }
  }, [getToken]);

  const loadData = async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const [v, d, inv, exp, dispatchRequests, finDash, tripList, pricingResp, usersList] = await Promise.allSettled([
        api.getVehicles(),
        api.getDrivers(),
        api.getInvoices(),
        api.getExpenses(),
        api.getBookings(),
        api.getFinancialDashboard(),
        api.getTrips(),
        api.getActivePricing(),
        api.getUsers()
      ]);
      
      if (v.status === 'fulfilled') setVehicles(v.value);
      if (d.status === 'fulfilled') setDrivers(d.value);
      if (inv.status === 'fulfilled') setInvoices(inv.value);
      if (exp.status === 'fulfilled') setExpenses(exp.value);
      if (exp.status === 'fulfilled') setExpenses(exp.value);
      if (pricingResp.status === 'fulfilled') setActivePricing(pricingResp.value);
      if (usersList.status === 'fulfilled') setUsers(usersList.value);
      
      if (dispatchRequests.status === 'fulfilled') {
        setBookings(dispatchRequests.value);
      } else {
        console.error("Failed to load dispatch requests:", dispatchRequests.reason);
      }
      
      if (tripList.status === 'fulfilled' && tripList.value && tripList.value.length > 0) {
        setTrips(tripList.value);
      } else if (dispatchRequests.status === 'fulfilled') {
        setTrips(dispatchRequests.value.filter((b: any) => b.status === 'IN TRANSIT' || b.status === 'DELIVERED'));
      }

      if (finDash.status === 'fulfilled') setDashboard(finDash.value);
    } catch (e: any) {
      console.error("loadData error:", e);
      setLoadError(e?.message || "Failed to load dashboard data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Trigger load when Clerk authentication is confirmed
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadData();
      const interval = setInterval(() => {
        loadData();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isLoaded, isSignedIn]);

  const handleApproveBooking = async (bookingId: string) => {
    try {
      const targetBooking = bookings.find((b: any) => String(b.id) === String(bookingId));
      let approvedDist: number | undefined = undefined;

      if (!targetBooking?.distance_km || Number(targetBooking.distance_km) <= 0) {
        const input = prompt(
          `This request (${targetBooking?.request_number || bookingId}) has no stored transport distance.\nPlease enter the approved transport distance in km to generate quotation and approve:`
        );
        if (!input) return; // User cancelled
        const parsedDist = parseFloat(input.trim());
        if (isNaN(parsedDist) || parsedDist <= 0) {
          alert("Please enter a valid positive number for distance in km.");
          return;
        }
        approvedDist = parsedDist;
      }

      await api.approveBooking(bookingId, approvedDist);
      alert("Booking approved successfully! Quotation generated and request is ready for dispatch.");
      loadData();
    } catch (e: any) {
      let msg = e?.message || String(e);
      try {
        const parsed = JSON.parse(msg.replace(/^Error:\s*/, ""));
        if (parsed.detail) {
          msg = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {
        // use raw msg
      }
      if (msg.includes("Cannot approve request without an actual approved distance")) {
        alert("Cannot approve this request because a valid transport distance has not been stored. Please specify the approved distance.");
      } else {
        alert(`Failed to approve booking: ${msg}`);
      }
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    const targetBooking = bookings.find((b: any) => String(b.id) === String(bookingId));
    const reason = prompt(
      `Are you sure you want to cancel request ${targetBooking?.request_number || bookingId}?\n` +
      `Please provide an administrative reason for cancellation (required):`
    );
    if (!reason) return; // User cancelled prompt or empty
    if (!reason.trim()) {
      alert("A cancellation reason is required to cancel this order.");
      return;
    }

    try {
      await api.cancelBooking(bookingId, reason.trim());
      alert(`Request ${targetBooking?.request_number || bookingId} cancelled successfully.`);
      loadData();
    } catch (e: any) {
      let msg = e?.message || String(e);
      try {
        const parsed = JSON.parse(msg.replace(/^Error:\s*/, ""));
        if (parsed.detail) {
          msg = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {
        // use raw msg
      }
      alert(`Failed to cancel booking: ${msg}`);
    }
  };

  const handleAskAi = async (e: any) => {
      e.preventDefault();
      if (!aiQuery) return;
      setAiLoading(true);
      try {
          const res = await api.askAssistant(aiQuery);
          setAiResponse(res);
      } catch (err: any) {
          alert("Failed to query AI: " + err.message);
      } finally {
          setAiLoading(false);
      }
  };
  
  const handleGetTripRecommendation = async (booking: any) => {
      try {
          // 1. Vehicle recommendation
          const v_rec = await api.recommendVehicle(booking.weight_tons);
          
          // 2. Pricing estimation (Mock distance if coordinates aren't real, but we have a dedicated endpoint)
          const p_rec = booking.distance_km && booking.distance_km > 0
            ? await api.predictPrice(booking.distance_km, booking.weight_tons)
            : null;
          
          // 3. Route intelligence
          let r_rec = [];
          if (booking.pickup_lat && booking.destination_lat) {
             r_rec = await api.recommendRoute(booking.pickup_lat, booking.pickup_lng, booking.destination_lat, booking.destination_lng);
          }
          
          setAiRecommendations(prev => ({
              ...prev,
              [booking.id]: { vehicle: v_rec, price: p_rec, routes: r_rec }
          }));
          
      } catch(err: any) {
          alert("Error getting AI recommendations: " + err.message);
      }
  };

  const handleRecordPayment = async (invoiceId: number, amountDue: number) => {
    const amount = prompt(`Enter payment amount (Due: Rs. ${amountDue}):`);
    if (!amount) return;
    try {
      await api.createPayment({
        invoice_id: invoiceId,
        amount: parseFloat(amount),
        payment_method: "BANK_TRANSFER",
        payment_type: "MANUAL",
        recorded_by: "Admin"
      });
      alert("Payment recorded successfully!");
      loadData();
    } catch (e: any) {
      alert("Failed to record payment: " + e);
    }
  };

  const handleMarkInTransit = async (tripId: string) => {
    try {
      await api.markInTransit(tripId);
      alert("Trip marked as In Transit!");
      loadData();
    } catch (e: any) {
      alert("Failed: " + e.message);
    }
  };

  const handleForceComplete = async (tripId: string) => {
    showConfirm({
      title: "Complete Trip & Generate Invoice",
      message: "Mark this trip as COMPLETED? An invoice will be auto-generated and the vehicle/driver will be freed.",
      confirmLabel: "✓ Complete & Invoice",
      confirmClass: "bg-green-600 hover:bg-green-500",
      onConfirm: async () => {
        closeConfirm();
        try {
          await api.forceCompleteTrip(tripId);
          alert("Trip completed! Invoice has been generated. Check Financials tab.");
          loadData();
        } catch (e: any) {
          alert("Failed: " + e.message);
        }
      },
    });
  };

  const dashboardLoading = isRefreshing && !dashboard && !vehicles.length && !drivers.length && !bookings.length;
  const pendingBookings = bookings.filter((booking) => ["SUBMITTED", "REQUESTED", "ACCEPTED"].includes(normalizeStatus(booking.status)));
  const activeTrips = trips.filter((trip) => !["COMPLETED", "DELIVERED"].includes(normalizeStatus(trip.status)));
  const availableVehicles = vehicles.filter((vehicle) => normalizeStatus(vehicle.status) === "AVAILABLE");
  const availableDrivers = drivers.filter((driver) => normalizeStatus(driver.status) === "AVAILABLE");

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center text-[var(--text-primary)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-slate-400 font-medium">Connecting to CargoX Operations...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center border border-slate-700/60 shadow-2xl bg-slate-900/90 backdrop-blur rounded-2xl">
          <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
            <ShieldCheck size={36} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Admin Sign-in Required</h2>
          <p className="text-slate-400 text-sm mb-6">
            You are accessing the CargoX Admin Operations Portal on port 5174. Please sign in with your administrator account to dispatch shipments and view live operations.
          </p>
          <SignInButton mode="modal">
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
              <span>Sign In as Admin</span>
            </button>
          </SignInButton>
          <div className="mt-6 pt-4 border-t border-slate-800">
            <Link to="/" className="text-xs text-slate-400 hover:text-white transition">
              ← Return to CargoX Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <ConfirmModal
      open={confirmModal.open}
      title={confirmModal.title}
      message={confirmModal.message}
      confirmLabel={confirmModal.confirmLabel}
      confirmClass={confirmModal.confirmClass}
      onConfirm={confirmModal.onConfirm}
      onCancel={closeConfirm}
    />
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col md:flex-row relative">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open Navigation Menu"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-lg tracking-wide">CargoX Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <NotificationDropdown userType="ADMIN" userId={0} />
          <UserButton />
        </div>
      </div>

      {/* Mobile Sidebar Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop + Mobile Drawer) */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        w-72 md:w-64 bg-slate-900 border-r border-slate-800 text-white min-h-screen flex flex-col shadow-2xl
        transition-transform duration-300 ease-in-out
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-5 pb-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold tracking-wider">
              CargoX Admin
            </h2>
            <button 
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex justify-between items-center mb-5 text-sm text-slate-400">
             <span>Premium Ops</span>
             <div className="hidden md:block">
               <ThemeToggle />
             </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 mb-6 overflow-y-auto">
          <button 
            onClick={() => { setActiveTab('dashboard'); setIsMobileSidebarOpen(false); }} 
            className={`w-full text-left py-2.5 px-4 rounded flex items-center gap-3 transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
          >
             <MapIcon size={18} /> <span>Dashboard</span>
          </button>
          <button 
            onClick={() => { setActiveTab('bookings'); setIsMobileSidebarOpen(false); }} 
            className={`w-full text-left py-2.5 px-4 rounded flex items-center justify-between transition ${activeTab === 'bookings' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
          >
             <div className="flex items-center gap-3"><Sparkles size={18} /> <span>Dispatch</span></div>
             {bookings.filter(b => b.status === "REQUESTED" || b.status === "SUBMITTED" || b.status === "ACCEPTED").length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{bookings.filter(b => b.status === "REQUESTED" || b.status === "SUBMITTED" || b.status === "ACCEPTED").length}</span>
             )}
          </button>
          <button 
            onClick={() => { setActiveTab('vehicles'); setIsMobileSidebarOpen(false); }} 
            className={`w-full text-left py-2.5 px-4 rounded flex items-center gap-3 transition ${activeTab === 'vehicles' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
          >
             <MapIcon size={18}/> <span>Fleet Status</span>
          </button>
          <button 
            onClick={() => { setActiveTab('trips'); setIsMobileSidebarOpen(false); }} 
            className={`w-full text-left py-2.5 px-4 rounded flex items-center gap-3 transition ${activeTab === 'trips' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
          >
             <MapIcon size={18}/> <span>Active Trips</span>
          </button>
          <button 
            onClick={() => { setActiveTab('financials'); setIsMobileSidebarOpen(false); }} 
            className={`w-full text-left py-2.5 px-4 rounded flex items-center gap-3 transition ${activeTab === 'financials' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
          >
             <MapIcon size={18}/> <span>Financials</span>
          </button>
          <button 
            onClick={() => { setActiveTab('users'); setIsMobileSidebarOpen(false); }} 
            className={`w-full text-left px-4 py-2.5 rounded transition font-medium flex items-center gap-3 ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Users size={18} /> <span>Team Management</span>
          </button>
          <button 
            onClick={() => { setActiveTab('ai'); setIsMobileSidebarOpen(false); }} 
            className={`w-full text-left px-4 py-2.5 rounded transition font-medium flex items-center gap-3 ${activeTab === 'ai' ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Bot size={18} /> <span>AI Assistant</span>
          </button>
          <button
            onClick={() => { setActiveTab('settings'); setIsMobileSidebarOpen(false); }}
            className={`w-full text-left px-4 py-2.5 rounded transition font-medium flex items-center gap-3 ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Settings size={18} /> <span>Settings</span>
          </button>
        </nav>
        
        <div className="hidden md:block mb-4 px-3">
           <NotificationDropdown userType="ADMIN" userId={0} />
        </div>
        
        <div className="p-4 border-t border-slate-800 flex items-center justify-between mt-auto">
          <div className="flex items-center gap-3 min-w-0">
            <UserButton />
            <div className="truncate max-w-[120px]">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.primaryEmailAddress?.emailAddress || user?.fullName || "Admin User"}</p>
              <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider font-bold">ADMIN</span>
            </div>
          </div>
          <Link to="/" title="Exit to Home" className="p-2 text-slate-400 hover:text-red-400 transition rounded-lg hover:bg-slate-800">
            <LogOut size={18} />
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto w-full min-w-0">
        
        {activeTab === 'dashboard' && (
          <div className="fade-in mx-auto max-w-[1600px] space-y-6">
            <div className="-mx-4 -mt-4 flex min-h-16 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/70 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6 md:-mx-8 md:-mt-8 md:px-8">
              <div className="hidden items-center gap-3 sm:flex"><div className="rounded-lg bg-blue-500/15 p-2 text-blue-400"><Radio size={18} /></div><div><p className="text-sm font-bold text-white">CargoX Admin</p><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Transport Operations</p></div></div>
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 sm:mx-8 sm:max-w-xl"><Search size={16} className="shrink-0 text-slate-500" /><input className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600" placeholder="Search requests, customers, or locations..." aria-label="Search operations" /><span className="hidden rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500 md:inline">Ctrl K</span></div>
              <div className="flex items-center gap-3"><NotificationDropdown userType="ADMIN" userId={0} /><div className="hidden text-right sm:block"><p className="max-w-28 truncate text-xs font-semibold text-slate-200">{user?.fullName || user?.primaryEmailAddress?.emailAddress || "Admin"}</p><p className="text-[10px] uppercase tracking-wider text-emerald-400">Administrator</p></div><UserButton /></div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Live operations</div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Operations Dashboard</h1><p className="mt-1 text-sm text-slate-500">Live overview of requests, fleet dispatch, and trip tracking</p></div><button onClick={() => loadData()} disabled={isRefreshing} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-blue-500/50 hover:bg-slate-800 disabled:opacity-50"><RefreshCw size={15} className={isRefreshing ? "animate-spin text-blue-400" : ""} />{isRefreshing ? "Updating..." : "Refresh data"}</button></div>

            {loadError && <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300"><div className="flex items-center gap-2 text-sm"><AlertCircle size={17} />Unable to load all operational data.</div><button onClick={() => loadData()} className="text-xs font-bold underline">Retry</button></div>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[{ label: "Total requests", value: bookings.length, note: "All customer requests", icon: ClipboardList, tone: "text-blue-400", action: () => setActiveTab("bookings") }, { label: "Active trips", value: activeTrips.length, note: "Currently operational", icon: Truck, tone: "text-amber-400", action: () => setActiveTab("trips") }, { label: "Available fleet", value: `${availableVehicles.length} / ${vehicles.length || "—"}`, note: "Vehicles ready to dispatch", icon: MapIcon, tone: "text-emerald-400", action: () => setActiveTab("vehicles") }, { label: "Available drivers", value: `${availableDrivers.length} / ${drivers.length || "—"}`, note: "Drivers ready to assign", icon: UserRound, tone: "text-emerald-400", action: () => setActiveTab("vehicles") }, { label: "Total revenue", value: formatCurrency(dashboard?.revenue ?? dashboard?.total_invoiced), note: "Authoritative finance total", icon: IndianRupee, tone: "text-blue-400", action: () => setActiveTab("financials") }].map((kpi) => <button key={kpi.label} onClick={kpi.action} className="group rounded-xl border border-slate-800 bg-slate-900 p-4 text-left shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-slate-700"><div className="flex items-start justify-between"><span className={`rounded-lg bg-slate-800/80 p-2 ${kpi.tone}`}><kpi.icon size={17} /></span><ArrowUpRight size={15} className="text-slate-700 transition group-hover:text-blue-400" /></div>{dashboardLoading ? <DashboardSkeleton className="mt-4 h-8 w-24" /> : <p className="mt-4 text-2xl font-bold tracking-tight text-white">{kpi.value}</p>}<p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{kpi.label}</p><p className="mt-2 text-xs text-slate-600">{kpi.note}</p></button>)}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]"><section className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/10 sm:p-5"><SectionHeader icon={<MapIcon size={17} />} title="Live fleet location" meta={`${activeTrips.length} active trips`} />{dashboardLoading ? <DashboardSkeleton className="mt-4 h-80 w-full" /> : <div className="mt-4"><FleetOperationsMap trips={activeTrips} /></div>}</section><section className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/10 sm:p-5"><SectionHeader icon={<Activity size={17} />} title="Recent activity" /><div className="mt-4 space-y-1">{dashboardLoading ? [1, 2, 3, 4].map((item) => <DashboardSkeleton key={item} className="h-14 w-full" />) : [...trips.slice(0, 3).map((trip) => ({ id: `trip-${trip.id}`, icon: Truck, title: `Trip ${trip.request?.request_number || `#${String(trip.id).slice(-6)}`}`, detail: `${trip.request?.pickup_address || "Pickup"} → ${trip.request?.destination_address || "Destination"}`, status: trip.status, date: trip.assigned_at })), ...bookings.slice(0, 2).map((booking) => ({ id: `request-${booking.id}`, icon: Package, title: `Request ${booking.request_number || `#${String(booking.id).slice(-6)}`}`, detail: booking.pickup_address || "New delivery request", status: booking.status, date: booking.created_at }))].slice(0, 5).map((event) => <div key={event.id} className="flex gap-3 border-b border-slate-800/80 py-3 last:border-0"><div className="mt-0.5 rounded-lg bg-blue-500/10 p-2 text-blue-400"><event.icon size={15} /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-200">{event.title}</p><span className="shrink-0 text-[10px] text-slate-600">{formatDate(event.date)}</span></div><p className="mt-1 truncate text-xs text-slate-500">{event.detail}</p><StatusBadge status={event.status} /></div></div>)}{!trips.length && !bookings.length && <p className="py-12 text-center text-sm text-slate-500">No recent operational activity</p>}</div></section></div>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/10 sm:p-5"><SectionHeader icon={<ClipboardList size={17} />} title="Pending dispatch requests" meta={`${pendingBookings.length} need attention`} onViewAll={() => setActiveTab("bookings")} />{dashboardLoading ? <div className="mt-4 space-y-2">{[1, 2, 3].map((item) => <DashboardSkeleton key={item} className="h-12 w-full" />)}</div> : pendingBookings.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-190 text-left"><thead><tr className="text-[10px] uppercase tracking-[0.14em] text-slate-600"><th className="px-3 py-2">Request no.</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Cargo</th><th className="px-3 py-2">Weight</th><th className="px-3 py-2">Route</th><th className="px-3 py-2">Status</th><th /></tr></thead><tbody className="divide-y divide-slate-800/80">{pendingBookings.slice(0, 8).map((booking) => <tr key={booking.id} className="text-sm transition hover:bg-slate-800/30"><td className="px-3 py-3 font-semibold text-blue-300">{booking.request_number || `#${String(booking.id).slice(-8)}`}</td><td className="px-3 py-3 text-slate-300">{booking.pickup_company_name || booking.customer_name || "Customer request"}</td><td className="px-3 py-3 text-slate-400">{booking.goods_type || "Cargo"}</td><td className="px-3 py-3 font-bold text-white">{booking.weight_tons ?? "—"} t</td><td className="max-w-62.5 truncate px-3 py-3 text-xs text-slate-500">{booking.pickup_address || "Pickup"} → {booking.destination_address || "Destination"}</td><td className="px-3 py-3"><StatusBadge status={booking.status} /></td><td className="px-3 py-3 text-right"><button onClick={() => setActiveTab("bookings")} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-blue-400" aria-label="View request"><Eye size={16} /></button></td></tr>)}</tbody></table></div> : <div className="py-12 text-center"><CircleCheck className="mx-auto mb-2 text-emerald-400" size={22} /><p className="text-sm font-semibold text-slate-300">No pending dispatch requests</p><p className="mt-1 text-xs text-slate-600">New requests will appear here when submitted.</p></div>}</section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><section className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/10 sm:p-5"><SectionHeader icon={<MapIcon size={17} />} title="Fleet status" meta={`${vehicles.length} vehicles`} onViewAll={() => setActiveTab("vehicles")} /><div className="mt-3 divide-y divide-slate-800/80">{vehicles.slice(0, 5).map((vehicle) => <div key={vehicle.id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-slate-800 p-2 text-slate-400"><Truck size={16} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{vehicle.registration_number || vehicle.vehicle_number || "Vehicle"}</p><p className="text-xs text-slate-500">{vehicle.vehicle_type || "Fleet vehicle"} · {vehicle.capacity_tons ?? "—"} t</p></div></div><StatusBadge status={vehicle.status} /></div>)}{!vehicles.length && <p className="py-10 text-center text-sm text-slate-500">No fleet records available</p>}</div></section><section className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/10 sm:p-5"><SectionHeader icon={<UserRound size={17} />} title="Driver status" meta={`${drivers.length} drivers`} onViewAll={() => setActiveTab("vehicles")} /><div className="mt-3 divide-y divide-slate-800/80">{drivers.slice(0, 5).map((driver) => <div key={driver.id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-slate-800 p-2 text-slate-400"><UserRound size={16} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{driver.name || "Driver"}</p><p className="text-xs text-slate-500">{driver.phone || "Contact hidden"}</p></div></div><StatusBadge status={driver.status} /></div>)}{!drivers.length && <p className="py-10 text-center text-sm text-slate-500">No driver records available</p>}</div></section></div>
          </div>
        )}
        {activeTab === 'bookings' && (
          <div className="fade-in">
            <DispatchBoard
              bookings={bookings}
              vehicles={vehicles}
              drivers={drivers}
              activePricing={activePricing}
              aiRecommendations={aiRecommendations}
              onApprove={handleApproveBooking}
              onCreateTrip={async (booking: any, vehicleId: string, driverId: string) => {
                try {
                  const bookingId = typeof booking === "object" ? booking.id : booking;
                  const bookingStatus = typeof booking === "object" ? booking.status : null;
                  
                  if (bookingStatus === "SUBMITTED") {
                    let approvedDist: number | undefined = undefined;
                    if (!booking?.distance_km || Number(booking.distance_km) <= 0) {
                      const input = prompt(
                        `This request (${booking?.request_number || bookingId}) has no stored transport distance.\nPlease enter the approved transport distance in km before dispatch:`
                      );
                      if (!input) return; // User cancelled
                      const parsedDist = parseFloat(input.trim());
                      if (isNaN(parsedDist) || parsedDist <= 0) {
                        alert("Please enter a valid positive number for distance in km.");
                        return;
                      }
                      approvedDist = parsedDist;
                    }
                    await api.approveBooking(bookingId, approvedDist);
                  }

                  await api.createTrip({
                    booking_id: bookingId,
                    vehicle_id: vehicleId,
                    driver_id: driverId,
                  });
                  alert("Trip dispatched successfully! Vehicle and driver assigned.");
                  loadData();
                } catch (e: any) {
                  let msg = e?.message || String(e);
                  try {
                    const parsed = JSON.parse(msg.replace(/^Error:\s*/, ""));
                    if (parsed.detail) {
                      msg = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
                    }
                  } catch {
                    // keep raw
                  }
                  alert(`Failed to dispatch trip: ${msg}`);
                }
              }}
              onCancel={handleCancelBooking}
              onGetAiRec={handleGetTripRecommendation}
            />
          </div>
        )}
        
        {activeTab === 'ai' && (
          <div>
             <h1 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-2"><Bot size={32} className="text-purple-600"/> AI Business Assistant</h1>
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme p-6 max-w-3xl">
                <p className="text-muted mb-6">Ask CargoX AI about your business performance, revenue, expenses, and fleet status.</p>
                <form onSubmit={handleAskAi} className="flex gap-4 mb-8">
                    <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="e.g. What is our net profit this month?" className="flex-1 rounded-md border-border-theme shadow-sm focus:border-purple-500 focus:ring-purple-500 border p-3" required />
                    <button type="submit" disabled={aiLoading} className="bg-purple-600 text-white px-6 py-3 rounded-md font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                        {aiLoading ? "Thinking..." : <><Sparkles size={18}/> Ask AI</>}
                    </button>
                </form>
                
                {aiResponse && (
                    <div className="bg-surface-elevated rounded-lg p-6 border">
                        <h3 className="font-bold text-foreground mb-2">AI Response</h3>
                        <p className="text-foreground whitespace-pre-wrap">{aiResponse.answer}</p>
                        <div className="mt-4 pt-4 border-t">
                            <p className="text-xs text-muted font-medium">Data tools queried: {aiResponse.context_used?.join(', ')}</p>
                        </div>
                    </div>
                )}
             </div>
          </div>
        )}
        
        {activeTab === 'trips' && (
          <ActiveTripsPanel trips={trips} vehicles={vehicles} drivers={drivers} isRefreshing={isRefreshing} loadData={loadData} onMarkInTransit={handleMarkInTransit} onForceComplete={handleForceComplete} />
        )}

        {activeTab === 'vehicles' && (
          <FleetManagementPanel vehicles={vehicles} drivers={drivers} trips={trips} isRefreshing={isRefreshing} loadData={loadData} showConfirm={showConfirm} />
        )}
        {activeTab === 'vehicles' && false && (
          <div>
             <h1 className="text-3xl font-bold text-foreground mb-6">Fleet Status</h1>

             <h2 className="text-2xl font-bold text-foreground mb-4">Driver Profiles</h2>
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden mb-8">
                <div className="overflow-x-auto">
                   <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-surface-elevated">
                      <tr>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Driver Name</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Contact & Email</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">License / Aadhaar</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                         <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="bg-surface divide-y divide-gray-200">
                      {drivers.map((d: any, i: number) => (
                        editingDriver?.id === d.id ? (
                           <tr key={d.id}>
                               <td colSpan={5} className="px-6 py-4">
                                   <form onSubmit={async (e) => {
                                       e.preventDefault();
                                       const formData = new FormData(e.currentTarget);
                                       try {
                                           await api.updateDriver(d.id, {
                                               email: formData.get('email'),
                                               aadhaar_number: formData.get('aadhaar_number'),
                                               age: parseInt(formData.get('age') as string, 10),
                                               name: formData.get('name'),
                                               phone: formData.get('phone'),
                                               license_number: formData.get('license_number'),
                                               status: formData.get('status')
                                           });
                                           setEditingDriver(null);
                                           loadData();
                                       } catch (err: any) { alert('Failed to update driver: ' + err.message); }
                                   }} className="flex items-center gap-2">
                                       <input name="name" defaultValue={d.name} required className="w-full rounded border-border-theme bg-surface-elevated text-foreground p-2" />
                                       <input type="email" name="email" defaultValue={d.email} required className="w-full rounded border-border-theme bg-surface-elevated text-foreground p-2" />
                                       <input name="phone" defaultValue={d.phone} required className="w-full rounded border-border-theme bg-surface-elevated text-foreground p-2" />
                                       <input name="aadhaar_number" defaultValue={d.aadhaar_number} required className="w-full rounded border-border-theme bg-surface-elevated text-foreground p-2" />
                                       <input type="number" name="age" defaultValue={d.age} required min="18" max="75" className="w-full rounded border-border-theme bg-surface-elevated text-foreground p-2" />
                                       <input name="license_number" defaultValue={d.license_number} required className="w-full rounded border-border-theme bg-surface-elevated text-foreground p-2" />
                                       <select name="status" defaultValue={d.status} className="w-full rounded border-border-theme bg-surface-elevated text-foreground p-2">
                                           <option value="AVAILABLE">AVAILABLE</option>
                                           <option value="ON_TRIP">ON_TRIP</option>
                                           <option value="INACTIVE">INACTIVE</option>
                                       </select>
                                       <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">Save</button>
                                       <button type="button" onClick={() => setEditingDriver(null)} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-medium">Cancel</button>
                                   </form>
                               </td>
                           </tr>
                        ) : (
                        <tr key={d.id || i}>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{d.name}<div className="text-xs text-muted font-normal">Age: {d.age || 'N/A'}</div></td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{d.phone}<br/>{d.email}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{d.license_number}<br/>{maskAadhaar(d.aadhaar_number)}</td>
                           <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-bold ${d.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{d.status}</span></td>
                           <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => setEditingDriver(d)} 
                                        title="Edit Driver"
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-300 transition"
                                    >
                                        <Edit2 size={12} /> Edit
                                    </button>
                                     <button 
                                         onClick={() => showConfirm({
                                           title: "Delete Driver",
                                           message: `Are you sure you want to delete driver "${d.name}"? This action cannot be undone.`,
                                           confirmLabel: "Delete Driver",
                                           onConfirm: async () => {
                                             closeConfirm();
                                             try {
                                               await api.deleteDriver(d.id);
                                               loadData();
                                             } catch (err: any) { alert('Failed to delete driver: ' + err.message); }
                                           }
                                         })}
                                        title="Delete Driver"
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:text-red-300 transition"
                                    >
                                        <Trash2 size={12} /> Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                        )
                      ))}
                      {drivers.length === 0 && (
                          <tr>
                             <td colSpan={5} className="px-6 py-4 text-center text-muted">No drivers found.</td>
                          </tr>
                      )}
                   </tbody>
                </table>
                </div>
             </div>

             <div className="mt-4 bg-surface rounded-lg shadow-sm border border-border-theme p-6 mb-12">
                <h2 className="text-xl font-bold text-foreground mb-4">Add New Driver</h2>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const phone = (formData.get('phone') as string).replace(/\D/g, '');
                    const aadhaar = (formData.get('aadhaar_number') as string).replace(/\s/g, '');
                    if (phone.length !== 10) { alert('Mobile number must be exactly 10 digits.'); return; }
                    if (aadhaar.length !== 12) { alert('Aadhaar must be exactly 12 digits (XXXX XXXX XXXX).'); return; }
                    const age = parseInt(formData.get('age') as string, 10);
                    if (isNaN(age) || age < 18 || age > 75) { alert('Age must be between 18 and 75.'); return; }
                    try {
                        await api.createDriver({
                            email: formData.get('email'),
                            aadhaar_number: aadhaar,
                            age,
                            name: newDriverName,
                            phone: newDriverPhone,
                            license_number: newDriverLicense
                        });
                        alert('Driver added successfully');
                        loadData();
                        (e.target as HTMLFormElement).reset();
                        setNewDriverAadhaar("");
                        setNewDriverPhone("");
                        setNewDriverAge("");
                        setNewDriverName("");
                        setNewDriverLicense("");
                    } catch (err: any) {
                        alert('Failed to add driver: ' + err.message);
                    }
                }} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Email / Gmail</label>
                        <input
                          type="email" name="email" required
                          placeholder="driver@gmail.com"
                          className="w-full rounded-md border-border-theme shadow-sm border p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Aadhaar Number <span className="text-xs text-muted">(XXXX XXXX XXXX)</span>
                        </label>
                        <input
                          name="aadhaar_number" required
                          placeholder="1234 5678 9012"
                          maxLength={14}
                          inputMode="numeric"
                          pattern="\d{4} \d{4} \d{4}"
                          title="Enter 12-digit Aadhaar in format: XXXX XXXX XXXX"
                          value={newDriverAadhaar}
                          onChange={(e) => { setNewDriverAadhaar(formatAadhaar(e.target.value)); }}
                          className="w-full rounded-md border-border-theme shadow-sm border p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Age <span className="text-xs text-muted">(18–75)</span>
                        </label>
                        <input
                          type="number" name="age" required
                          placeholder="30" min="18" max="75"
                          inputMode="numeric"
                          value={newDriverAge}
                          onChange={(e) => {
                            let val = e.target.value;
                            if (val.length > 2) val = val.slice(0, 2);
                            setNewDriverAge(val);
                          }}
                          className="w-full rounded-md border-border-theme shadow-sm border p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Full Name <span className="text-xs text-muted">(Title Case)</span>
                        </label>
                        <input
                          name="name" required
                          placeholder="John Doe"
                          pattern="[A-Za-z ]+"
                          title="Name should contain letters only (each word starts with capital)"
                          value={newDriverName}
                          onChange={(e) => { setNewDriverName(toTitleCase(e.target.value.replace(/[^a-zA-Z ]/g, ""))); }}
                          className="w-full rounded-md border-border-theme shadow-sm border p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Mobile Number <span className="text-xs text-muted">(10 digits)</span>
                        </label>
                        <input
                          name="phone" required
                          placeholder="9876543210"
                          inputMode="numeric"
                          maxLength={10}
                          pattern="[0-9]{10}"
                          title="Enter exactly 10-digit mobile number without country code"
                          value={newDriverPhone}
                          onChange={(e) => { setNewDriverPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); }}
                          className="w-full rounded-md border-border-theme shadow-sm border p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Licence Number <span className="text-xs text-muted">(Indian DL format)</span>
                        </label>
                        <input
                          name="license_number" required
                          placeholder="TN0120210012345"
                          maxLength={20}
                          title="Indian driving licence format e.g. TN0120210012345"
                          value={newDriverLicense}
                          onChange={(e) => {
                            setNewDriverLicense(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
                          }}
                          className="w-full rounded-md border-border-theme shadow-sm border p-2"
                        />
                    </div>
                    <div className="md:col-span-3 lg:col-span-6">
                        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition">
                            Add Driver
                        </button>
                    </div>
                </form>
             </div>

             <h2 className="text-2xl font-bold text-foreground mb-4">Vehicles</h2>
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden">
                <div className="overflow-x-auto">
                   <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-surface-elevated">
                      <tr>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Vehicle</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Capacity</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                         <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="bg-surface divide-y divide-gray-200">
                      {vehicles.map((v: any, i: number) => (
                        editingVehicle?.id === v.id ? (
                            <tr key={v.id}>
                               <td colSpan={4} className="px-6 py-4">
                                   <form onSubmit={async (e) => {
                                       e.preventDefault();
                                       const formData = new FormData(e.currentTarget);
                                       try {
                                           await api.updateVehicle(v.id, {
                                               registration_number: formData.get('registration_number'),
                                               type: formData.get('type'),
                                               capacity_tons: formData.get('capacity_tons'),
                                               status: formData.get('status')
                                           });
                                           setEditingVehicle(null);
                                           loadData();
                                       } catch (err: any) { alert('Failed to update vehicle: ' + err.message); }
                                   }} className="flex items-center gap-2">
                                       <input name="registration_number" defaultValue={v.registration_number || `TG${String(10 + (i%90)).padStart(2, '0')}HS${String(1000 + i).padStart(4, '0')}`} required className="w-full rounded border-border-theme bg-surface-elevated text-foreground p-2" />
                                       <select name="type" defaultValue={v.type || "TRUCK"} className="w-full rounded border-border-theme bg-surface-elevated text-foreground p-2">
                                           <option value="OPEN">OPEN (Open Truck / Flatbed)</option>
                                           <option value="CONTAINER">CONTAINER (Closed Body)</option>
                                           <option value="TRAILER">TRAILER (Heavy Trailer)</option>
                                       </select>
                                       <input name="capacity_tons" type="number" step="0.1" defaultValue={v.capacity_tons || v.capacity || 10} required className="w-24 rounded border-border-theme bg-surface-elevated text-foreground p-2" />
                                       <select name="status" defaultValue={v.status} className="w-full rounded border-border-theme bg-surface-elevated text-foreground p-2">
                                           <option value="AVAILABLE">AVAILABLE</option>
                                           <option value="MAINTENANCE">MAINTENANCE</option>
                                           <option value="ON_TRIP">ON_TRIP</option>
                                       </select>
                                       <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">Save</button>
                                       <button type="button" onClick={() => setEditingVehicle(null)} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-medium">Cancel</button>
                                   </form>
                               </td>
                           </tr>
                        ) : (
                        <tr key={v.id || i}>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                              {v.type || "TRUCK"} - {v.registration_number || `TG${String(10 + (i%90)).padStart(2, '0')}HS${String(1000 + i).padStart(4, '0')}`} <br/>
                              <span className="text-xs text-muted">Driver: {drivers.find((d: any) => d.id === v.driver_id)?.name || drivers.find((d: any) => d.id === v.driver_id)?.full_name || 'Unassigned'}</span>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{v.capacity_tons || v.capacity || 10} Ton</td>
                           <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-bold ${v.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{v.status}</span></td>
                           <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => setEditingVehicle(v)} 
                                        title="Edit Vehicle"
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-300 transition"
                                    >
                                        <Edit2 size={12} /> Edit
                                    </button>
                                     {v.is_deletable && (
                                     <button 
                                         onClick={() => showConfirm({
                                           title: "Delete Vehicle",
                                           message: `Delete vehicle "${v.registration_number || v.vehicle_number}"? This vehicle has no trip history and will be permanently removed.`,
                                           confirmLabel: "Delete Vehicle",
                                           onConfirm: async () => {
                                             closeConfirm();
                                             try {
                                               await api.deleteVehicle(v.id);
                                               loadData();
                                             } catch (err: any) { alert('Failed to delete vehicle: ' + err.message); }
                                           }
                                         })}
                                        title="Delete Vehicle"
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:text-red-300 transition"
                                    >
                                        <Trash2 size={12} /> Delete
                                    </button>
                                     )}
                                </div>
                            </td>
                        </tr>
                        )
                      ))}
                      {vehicles.length === 0 && (
                          <tr>
                             <td colSpan={4} className="px-6 py-4 text-center text-muted">No vehicles found.</td>
                          </tr>
                      )}
                   </tbody>
                </table>
                </div>
             </div>
             
             <div className="mt-8 bg-surface rounded-lg shadow-sm border border-border-theme p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">Add New Vehicle</h2>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const regRaw = (formData.get('registration_number') as string).toUpperCase().replace(/[^A-Z0-9]/g, '');
                    if (!VEHICLE_REG_REGEX.test(regRaw)) {
                      alert('Invalid vehicle registration number.\nFormat: 2 letters + 2 digits + 1-2 letters + 4 digits\nExample: TG09HS1234 or MH02A1234');
                      return;
                    }
                    try {
                        await api.createVehicle({
                            registration_number: regRaw,
                            type: formData.get('type'),
                            capacity_tons: parseFloat(formData.get('capacity_tons') as string)
                        });
                        alert('Vehicle added successfully');
                        loadData();
                        (e.target as HTMLFormElement).reset();
                    } catch (err: any) {
                        alert('Failed to add vehicle: ' + err.message);
                    }
                }} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Registration Number
                          <span className="text-xs text-muted ml-1">(e.g. TG09HS1234)</span>
                        </label>
                        <input
                          name="registration_number" required
                          placeholder="TG09HS1234"
                          maxLength={11}
                          title="Indian vehicle registration format: 2 letters + 2 digits + 1-2 letters + 4 digits (e.g. TG09HS1234)"
                          value={newVehicleReg}
                          onChange={(e) => {
                            const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                            setNewVehicleReg(raw);
                            const valid = VEHICLE_REG_REGEX.test(raw);
                            e.target.setCustomValidity(valid || raw.length === 0 ? "" : "Format: 2 letters + 2 digits + 1-2 letters + 4 digits (e.g. TG09HS1234)");
                          }}
                          className="w-full rounded-md border-border-theme shadow-sm border p-2 font-mono tracking-widest"
                        />
                        <p className="text-xs text-muted mt-1">State (2) + District (2) + Series (1-2) + Number (4)</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                        <select name="type" required className="w-full rounded-md border-border-theme shadow-sm border p-2">
                            <option value="OPEN">OPEN (Open Truck / Flatbed)</option>
                            <option value="CONTAINER">CONTAINER (Closed Container)</option>
                            <option value="TRAILER">TRAILER (Heavy Trailer)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Capacity (Tons)</label>
                        <input
                          name="capacity_tons" type="number" step="0.1" required
                          placeholder="10" min="0.5" max="50"
                          className="w-full rounded-md border-border-theme shadow-sm border p-2"
                        />
                    </div>
                    <div>
                        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition">
                            Add Vehicle
                        </button>
                    </div>
                </form>
             </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <AdminSettingsPanel />
        )}

        {activeTab === 'financials' && (
          <div>
             <h1 className="text-3xl font-bold text-foreground mb-6">Business Dashboard</h1>
             
             {(() => {
                 const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0) || parseFloat(dashboard?.total_invoiced || 0);
                 const totalPaid = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount_paid || 0), 0) || parseFloat(dashboard?.total_collected || 0);
                 const totalDue = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount_due || 0), 0) || parseFloat(dashboard?.outstanding_balance || 0);
                 const totalExpenses = parseFloat(dashboard?.total_operating_expenses || dashboard?.expenses || 0);
                 const netProfit = totalInvoiced - totalExpenses;

                 return (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                      <div className="bg-surface p-6 rounded-lg shadow-sm border-l-4 border-green-500">
                          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Total Invoiced (Completed Trips)</h3>
                          <p className="text-3xl font-extrabold text-foreground mt-2">₹{totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-xs text-muted mt-1">{invoices.length} invoices generated</p>
                      </div>
                      <div className="bg-surface p-6 rounded-lg shadow-sm border-l-4 border-emerald-500">
                          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Collected / Paid</h3>
                          <p className="text-3xl font-extrabold text-emerald-400 mt-2">₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-xs text-muted mt-1">{invoices.filter(i => i.status === 'PAID').length} fully paid</p>
                      </div>
                      <div className="bg-surface p-6 rounded-lg shadow-sm border-l-4 border-amber-500">
                          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Outstanding Due</h3>
                          <p className="text-3xl font-extrabold text-amber-400 mt-2">₹{totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-xs text-muted mt-1">{invoices.filter(i => i.status === 'UNPAID').length} pending payment</p>
                      </div>
                      <div className="bg-surface p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
                          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Net Revenue</h3>
                          <p className="text-3xl font-extrabold text-blue-400 mt-2">₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-xs text-muted mt-1">Expenses: ₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      </div>
                  </div>
                 );
             })()}

             <h2 className="text-2xl font-bold text-foreground mb-4">Pricing Configuration</h2>
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme p-6 mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-muted uppercase">Base Delivery Rate</p>
                        {activePricing ? (
                            <p className="text-3xl font-bold text-foreground mt-1">₹{activePricing.base_rate_per_km} <span className="text-sm font-normal text-muted">/ km</span></p>
                        ) : (
                            <p className="text-xl text-muted mt-1">Not configured</p>
                        )}
                    </div>
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const newRate = parseFloat(formData.get('base_rate_per_km') as string);
                        try {
                            setIsUpdatingPricing(true);
                            await api.updatePricing(newRate);
                            await loadData();
                        } catch (err: any) {
                            alert("Failed to update pricing: " + err.message);
                        } finally {
                            setIsUpdatingPricing(false);
                            (e.target as HTMLFormElement).reset();
                        }
                    }} className="flex items-end gap-2">
                        <div>
                            <label className="block text-xs font-bold text-foreground mb-1">Set New Rate (₹/km)</label>
                            <input name="base_rate_per_km" type="number" step="0.1" required placeholder="22.0" className="w-32 rounded-md border-border-theme shadow-sm border p-2 text-sm" />
                        </div>
                        <button type="submit" disabled={isUpdatingPricing} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50">
                            {isUpdatingPricing ? 'Updating...' : 'Update'}
                        </button>
                    </form>
                </div>
             </div>

              <h2 className="text-2xl font-bold text-foreground mb-4">Invoices</h2>
              <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden mb-8">
                 <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-surface-elevated">
                       <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Invoice #</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Customer / Request</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Total</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Paid</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Due</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-gray-200">
                       {invoices.length === 0 && (
                         <tr><td colSpan={8} className="px-6 py-8 text-center text-muted">No invoices found. Complete a trip to generate an invoice.</td></tr>
                       )}
                       {invoices.map(inv => {
                         const booking = bookings.find((b: any) => b.id === inv.request_id);
                         return (
                         <tr key={inv.id} className="hover:bg-surface-elevated/40 transition">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground">{inv.invoice_number}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className="font-mono text-blue-400 font-semibold">{booking?.request_number || 'REQ-' + String(inv.request_id).slice(0, 8)}</span>
                              {booking?.pickup_company_name && (
                                <p className="text-xs text-muted mt-0.5">{booking.pickup_company_name}</p>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('en-IN') : '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground">₹{parseFloat(inv.total_amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-400">₹{parseFloat(inv.amount_paid || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-400">₹{parseFloat(inv.amount_due).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                inv.status === 'PARTIALLY_PAID' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>{inv.status}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* View Button */}
                                  <button
                                    onClick={() => generateInvoicePDF(inv, booking, false)}
                                    title="View Invoice"
                                    className="inline-flex items-center gap-1 bg-surface-elevated hover:bg-surface-elevated/80 text-foreground border border-border-theme px-2.5 py-1 rounded text-xs font-semibold transition"
                                  >
                                    <Eye size={12}/> View
                                  </button>
                                  {/* Download PDF */}
                                  <button
                                    onClick={() => generateInvoicePDF(inv, booking, true)}
                                    title="Download PDF"
                                    className="inline-flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 px-2.5 py-1 rounded text-xs font-semibold shadow-sm transition"
                                  >
                                    <Download size={12}/> Download PDF
                                  </button>
                                  {inv.status !== 'PAID' && (
                                      <button onClick={() => handleRecordPayment(inv.id, inv.amount_due)} className="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded font-semibold transition ml-1">Record Payment</button>
                                  )}
                                </div>
                            </td>
                         </tr>
                         );
                       })}
                    </tbody>
                 </table>
                 </div>
              </div>

             
              <h2 className="text-2xl font-bold text-foreground mb-4">Trip Expenses</h2>
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-surface-elevated">
                      <tr>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Trip ID</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Expense Type</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Amount</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Recorded By</th>
                      </tr>
                   </thead>
                   <tbody className="bg-surface divide-y divide-gray-200">
                      {expenses.map(exp => (
                        <tr key={exp.id}>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">Trip #{exp.trip_id}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground">{exp.expense_type}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">₹{exp.amount}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{exp.recorded_by}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
                </div>
             </div>
          </div>
        )}

          {activeTab === 'users' && (
           <div>
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-foreground">Team & User Management</h2>
             </div>
             
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-surface-elevated border-b border-border-theme">
                         <th className="p-4 font-semibold text-muted text-sm">User ID / Email</th>
                         <th className="p-4 font-semibold text-muted text-sm">Role</th>
                         <th className="p-4 font-semibold text-muted text-sm text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody>
                      {users.length === 0 ? (
                         <tr><td colSpan={3} className="p-4 text-center text-muted">No users found.</td></tr>
                      ) : (
                         users.map(u => (
                            <tr key={u.id} className="border-b border-border-theme last:border-0 hover:bg-surface-elevated/50 transition">
                               <td className="p-4">
                                  <p className="font-medium text-foreground">{u.email}</p>
                                  <p className="text-xs text-muted font-mono">{u.id}</p>
                               </td>
                               <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    u.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' : 
                                    u.role === 'DRIVER' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {u.role}
                                  </span>
                               </td>
                                <td className="p-4 text-right">
                                   <div className="flex items-center justify-end gap-2">
                                      {u.role !== 'ADMIN' && (
                                         <button
                                            onClick={() => showConfirm({
                                              title: "Promote to Admin",
                                              message: `Grant admin privileges to "${u.email}"? They will gain full access to the CargoX Admin Portal.`,
                                              confirmLabel: "Make Admin",
                                              confirmClass: "bg-blue-600 hover:bg-blue-500",
                                              onConfirm: async () => {
                                                closeConfirm();
                                                try {
                                                  await api.updateUserRole(u.id, "ADMIN");
                                                  alert("User promoted to Admin successfully.");
                                                  loadData();
                                                } catch (e: any) {
                                                  alert("Failed to promote: " + e.message);
                                                }
                                              }
                                            })}
                                            title="Make Admin"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-300 transition shadow-sm"
                                         >
                                            <UserPlus size={13} /> Make Admin
                                         </button>
                                      )}
                                     {u.role === 'ADMIN' && (
                                        <button 
                                            onClick={() => showConfirm({
                                              title: "Revoke Admin Privileges",
                                              message: `Remove admin access for "${u.email}"? They will be downgraded to a standard customer account and lose all admin capabilities immediately.`,
                                              confirmLabel: "Revoke Admin",
                                              confirmClass: "bg-red-600 hover:bg-red-500",
                                              onConfirm: async () => {
                                                closeConfirm();
                                                try {
                                                  await api.updateUserRole(u.id, "CUSTOMER_USER");
                                                  alert("Admin access revoked. User is now a standard customer.");
                                                  loadData();
                                                } catch (e: any) {
                                                  alert("Failed to revoke admin: " + e.message);
                                                }
                                              }
                                            })}
                                           title="Revoke Admin"
                                           className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:text-red-300 transition shadow-sm"
                                        >
                                           <UserMinus size={13} /> Revoke Admin
                                        </button>
                                     )}
                                  </div>
                               </td>
                            </tr>
                         ))
                      )}
                   </tbody>
                </table>
                </div>
             </div>
           </div>
         )}
      </div>

    </div>
    </>
  );
}

