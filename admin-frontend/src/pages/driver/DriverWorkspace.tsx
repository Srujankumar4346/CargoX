import { useEffect, useState } from "react";
import { Activity, ClipboardList, Navigation, Package, Wallet, MapPin, Clock, Menu, X, CheckCircle2, Truck, IndianRupee, ArrowRight, User, QrCode, RotateCw, Copy, ExternalLink } from "lucide-react";
import { useAuth, UserButton, useUser } from "@clerk/react";
import { api } from "../../services/api";
import NotificationDropdown from "../../components/NotificationDropdown";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";

const driverSidebar = [
  { label: "Dashboard", icon: Activity },
  { label: "Current Orders", icon: ClipboardList },
  { label: "Previous Orders", icon: Package },
  { label: "Tracking", icon: Navigation },
  { label: "Payments", icon: Wallet },
  { label: "Profile", icon: User },
];

const normalizeStatus = (status: string | undefined) => (status || "").toUpperCase().replace(/ /g, "_");

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  const tone = ["AVAILABLE", "COMPLETED", "DELIVERED"].includes(normalized)
    ? "text-emerald-300 bg-emerald-400/10 border-emerald-400/20"
    : ["SUBMITTED", "REQUESTED", "ACCEPTED", "UNDER_REVIEW", "IN_TRANSIT", "PICKED_UP", "POD_SUBMITTED"].includes(normalized)
      ? "text-amber-300 bg-amber-400/10 border-amber-400/20"
      : ["REJECTED", "CUSTOMER_CANCELLED", "INACTIVE"].includes(normalized)
        ? "text-red-300 bg-red-400/10 border-red-400/20"
        : "text-blue-300 bg-blue-400/10 border-blue-400/20";
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold tracking-[0.12em] ${tone}`}>{status?.replace(/_/g, " ") || "UNKNOWN"}</span>;
}

const openGoogleMapsLocation = (lat?: number | null, lng?: number | null, address?: string | null) => {
  let url = "";
  if (lat && lng) {
    url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  } else if (address) {
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    alert("Location coordinates or address not available.");
  }
};

const openGoogleMapsRoute = (pickupLat?: number | null, pickupLng?: number | null, pickupAddress?: string | null, destLat?: number | null, destLng?: number | null, destAddress?: string | null) => {
  const origin = (pickupLat && pickupLng) ? `${pickupLat},${pickupLng}` : pickupAddress;
  const destination = (destLat && destLng) ? `${destLat},${destLng}` : destAddress;

  if (origin && destination) {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  } else if (destination) {
    openGoogleMapsLocation(destLat, destLng, destAddress);
  } else if (origin) {
    openGoogleMapsLocation(pickupLat, pickupLng, pickupAddress);
  } else {
    alert("Route details not available.");
  }
};

export default function DriverWorkspace() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("Dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [paymentState, setPaymentState] = useState<string>("Payment Due");
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const handlePayCargoXNow = async () => {
    if (!activeTrip) return;
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    setInitiatingPayment(true);
    try {
      const order = await api.driverPayCargoXNow(targetTripId);
      setPaymentOrder(order);
      setPaymentState(order.payment_status_display || "Waiting for Payment");
      await loadDriverData();
    } catch (err: any) {
      alert(`Payment initiation failed: ${err.message}`);
      setPaymentState("Payment Failed");
    } finally {
      setInitiatingPayment(false);
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!activeTrip) return;
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    setCheckingStatus(true);
    try {
      const res = await api.getDriverPaymentStatus(targetTripId);
      setPaymentState(res.status);
      if (res.is_fully_paid) {
        alert("Payment Confirmed! Outstanding balance settled.");
      }
      await loadDriverData();
    } catch (err: any) {
      alert(`Could not verify payment status: ${err.message}`);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleCopyPaymentLink = () => {
    const link = paymentOrder?.payment_link || activeTrip?.upi_uri;
    if (link) {
      navigator.clipboard.writeText(link);
      alert("Payment link copied to clipboard!");
    } else {
      alert("No active payment link available.");
    }
  };

  const loadDriverData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user) {
        const p = await api.getCurrentUserProfile();
        setProfile(p);
      }
      const activeRes = await api.getDriverActiveTrip();
      const historyRes = await api.getDriverTripsHistory();

      setActiveTrip(activeRes);
      setHistory(Array.isArray(historyRes) ? historyRes : []);
      if (activeRes) {
        if (activeRes.payment_status_display === "Paid" || parseFloat(activeRes.amount_due_for_collection || "0") <= 0) {
          setPaymentState("Payment Successful");
        } else if (activeRes.payment_status_display) {
          setPaymentState(activeRes.payment_status_display);
        } else {
          setPaymentState("Payment Due");
        }
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load driver workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((isLoaded && isSignedIn) || localStorage.getItem("access_token")) {
      loadDriverData();
    }
  }, [isLoaded, isSignedIn]);

  const handleAction = async (action: string) => {
    if (!activeTrip) return;
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    try {
      switch (action) {
        case 'start-pickup':
          await api.driverStartPickup(targetTripId);
          break;
        case 'start-transit':
          await api.driverStartTransit(targetTripId);
          break;
        case 'arrive':
          await api.driverArrive(targetTripId);
          break;
        case 'submit-pod':
          const podName = prompt("Enter receiver name for POD:");
          if (!podName) return;
          await api.driverSubmitPOD(targetTripId, { receiver_name: podName, signature: "signed" });
          break;
      }
      loadDriverData();
    } catch (e: any) {
      alert(`Action failed: ${e.message}`);
    }
  };

  const completedTrips = history.filter((t) => ["COMPLETED", "DELIVERED"].includes(normalizeStatus(t.status)));

  const renderDashboard = () => (
    <div className="space-y-6 fade-in max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Good Morning, {user?.firstName || user?.fullName || profile?.email?.split('@')[0] || "Driver"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">Here are your deliveries for today.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-blue-500/10 p-2 text-blue-400"><Truck size={20} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-white">{activeTrip ? 1 : 0}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Current Delivery</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400"><CheckCircle2 size={20} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-white">{completedTrips.length}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Completed Deliveries</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-amber-500/10 p-2 text-amber-400"><Clock size={20} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-white">0</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Pending Pickup</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-purple-500/10 p-2 text-purple-400"><IndianRupee size={20} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-white">{history.length}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Total Payments</p>
          <p className="text-[10px] text-slate-600">This Month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
        {/* Left Column: Current Delivery */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10 relative">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-lg font-bold text-white">Current Delivery</h2>
               {activeTrip && <StatusBadge status={activeTrip.status} />}
            </div>

            {activeTrip ? (
              <>
                <div className="mb-6">
                  <div className="text-xl font-bold text-white flex items-center gap-2">
                    Trip #{activeTrip.request_number || activeTrip.request?.request_number || String(activeTrip.trip_id || activeTrip.id).slice(-8).toUpperCase()}
                  </div>
                  <div className="text-sm text-slate-500">Order #{activeTrip.request_number || activeTrip.booking_id || "ORD"}</div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
                  <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950 p-4 relative w-full">
                    <div className="flex items-start gap-3">
                      <MapPin className="text-blue-500 shrink-0 mt-1" size={20} />
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Pickup Location</div>
                        <div className="font-semibold text-white text-sm mb-1">{activeTrip.pickup_company_name || activeTrip.request?.pickup_company_name || activeTrip.request?.customer_name || "Pickup"}</div>
                        <div className="text-xs text-slate-500 line-clamp-2">{activeTrip.pickup_address || activeTrip.request?.pickup_address}</div>
                        <button
                          onClick={() => openGoogleMapsLocation(activeTrip.pickup_lat || activeTrip.request?.pickup_lat, activeTrip.pickup_lng || activeTrip.request?.pickup_lng, activeTrip.pickup_address || activeTrip.request?.pickup_address)}
                          className="mt-3 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md flex items-center gap-2 font-medium transition cursor-pointer"
                        >
                          <Navigation size={12}/> Navigate to Pickup
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-600 shrink-0 hidden md:block">
                    <ArrowRight size={24} />
                  </div>
                  <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950 p-4 relative w-full">
                    <div className="flex items-start gap-3">
                      <MapPin className="text-red-500 shrink-0 mt-1" size={20} />
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Destination</div>
                        <div className="font-semibold text-white text-sm mb-1">{activeTrip.destination_company_name || activeTrip.request?.destination_company_name || "Destination"}</div>
                        <div className="text-xs text-slate-500 line-clamp-2">{activeTrip.destination_address || activeTrip.request?.destination_address}</div>
                        <button
                          onClick={() => openGoogleMapsLocation(activeTrip.destination_lat || activeTrip.request?.destination_lat, activeTrip.destination_lng || activeTrip.request?.destination_lng, activeTrip.destination_address || activeTrip.request?.destination_address)}
                          className="mt-3 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md flex items-center gap-2 font-medium transition cursor-pointer"
                        >
                          <Navigation size={12}/> Navigate to Destination
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 border-y border-slate-800 py-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                      <Package size={14}/> Cargo Type
                    </div>
                    <div className="text-white font-medium text-sm">{activeTrip.goods_type || activeTrip.request?.goods_type || "Cargo"}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                      <Package size={14}/> Weight
                    </div>
                    <div className="text-white font-medium text-sm">{activeTrip.weight_tons ?? activeTrip.request?.weight_tons ?? "0"} Tons</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                      <Truck size={14}/> Vehicle
                    </div>
                    <div className="text-white font-medium text-sm">{activeTrip.vehicle_registration || activeTrip.vehicle?.registration_number || "Assigned"}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                      <Wallet size={14}/> Payment Type
                    </div>
                    <div className="text-white font-medium text-sm flex items-center gap-2">
                       {activeTrip.payment_type || "UPI"} <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">{activeTrip.payment_status || "Pending"}</span>
                    </div>
                  </div>
                </div>

                {/* Progress Timeline */}
                <div className="relative pt-2 pb-6">
                  <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-800"></div>
                  
                  {/* Need to determine progress based on status */}
                  <div className="relative z-10 flex justify-between">
                     <div className="flex flex-col items-center">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center"></div>
                        <div className="text-[10px] text-emerald-400 mt-2 font-semibold">Assigned</div>
                     </div>
                     <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full border-4 border-slate-900 flex items-center justify-center ${["IN_TRANSIT", "ARRIVED", "DELIVERED", "COMPLETED", "POD_SUBMITTED"].includes(normalizeStatus(activeTrip.status)) ? "bg-emerald-500" : "bg-slate-700"}`}></div>
                        <div className={`text-[10px] mt-2 font-semibold ${["IN_TRANSIT", "ARRIVED", "DELIVERED", "COMPLETED", "POD_SUBMITTED"].includes(normalizeStatus(activeTrip.status)) ? "text-emerald-400" : "text-slate-500"}`}>In Transit</div>
                     </div>
                     <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full border-4 border-slate-900 flex items-center justify-center ${["ARRIVED", "DELIVERED", "COMPLETED", "POD_SUBMITTED"].includes(normalizeStatus(activeTrip.status)) ? "bg-emerald-500" : "bg-slate-700"}`}></div>
                        <div className={`text-[10px] mt-2 font-semibold ${["ARRIVED", "DELIVERED", "COMPLETED", "POD_SUBMITTED"].includes(normalizeStatus(activeTrip.status)) ? "text-emerald-400" : "text-slate-500"}`}>Arrived</div>
                     </div>
                     <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full border-4 border-slate-900 flex items-center justify-center ${["DELIVERED", "COMPLETED"].includes(normalizeStatus(activeTrip.status)) ? "bg-emerald-500" : "bg-slate-700"}`}></div>
                        <div className={`text-[10px] mt-2 font-semibold ${["DELIVERED", "COMPLETED"].includes(normalizeStatus(activeTrip.status)) ? "text-emerald-400" : "text-slate-500"}`}>Delivered</div>
                     </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-2">
                  <button onClick={() => alert("Updating location...")} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-2">
                     <Navigation size={14} /> Update Location
                  </button>
                  {["DRIVER_ASSIGNED", "ASSIGNED"].includes(normalizeStatus(activeTrip.status)) && (
                    <button onClick={() => handleAction("start-pickup")} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition flex items-center gap-2">
                       Start Pickup
                    </button>
                  )}
                  {normalizeStatus(activeTrip.status) === "PICKUP_IN_PROGRESS" && (
                    <button onClick={() => handleAction("start-transit")} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition flex items-center gap-2">
                       Start Transit
                    </button>
                  )}
                  {normalizeStatus(activeTrip.status) === "IN_TRANSIT" && (
                    <button onClick={() => handleAction("arrive")} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition flex items-center gap-2">
                       <MapPin size={14}/> Arrive at Destination
                    </button>
                  )}
                  {normalizeStatus(activeTrip.status) === "ARRIVED" && (
                    <button onClick={() => handleAction("submit-pod")} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition flex items-center gap-2">
                       <ClipboardList size={14}/> Submit POD
                    </button>
                  )}
                  {normalizeStatus(activeTrip.status) === "POD_SUBMITTED" && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                      <Clock size={14} className="animate-spin text-amber-400" />
                      POD Submitted — Awaiting Admin Verification
                    </div>
                  )}
                  {normalizeStatus(activeTrip.status) === "DELIVERED" && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      POD Verified & Delivered
                    </div>
                  )}
                </div>

                {/* RAPIDO / UBER-STYLE ARRIVAL COLLECT CUSTOMER PAYMENT SECTION */}
                {["ARRIVED", "POD_SUBMITTED", "DELIVERED"].includes(normalizeStatus(activeTrip.status)) && (
                  <div className="mt-8 rounded-xl border-2 border-emerald-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                            <IndianRupee size={18} />
                          </span>
                          <h3 className="text-base font-bold text-white tracking-wide uppercase">
                            Collect Customer Payment
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Direct merchant settlement to CargoX Logistics corporate current account.
                        </p>
                      </div>

                      {/* State Badge */}
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ${
                          paymentState === "Payment Successful"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : paymentState === "Waiting for Payment"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse"
                            : paymentState === "Payment Failed"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            : paymentState === "Payment Partially Completed"
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        }`}>
                          ● {paymentState}
                        </span>
                      </div>
                    </div>

                    {/* Financial Summary Ledger Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-5 p-4 rounded-lg bg-slate-900/90 border border-slate-800/80">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Customer</span>
                        <span className="text-xs font-bold text-slate-200 truncate block mt-0.5">
                          {activeTrip.customer_name || activeTrip.pickup_company_name || activeTrip.request?.pickup_company_name || "Valued Client"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Invoice Total</span>
                        <span className="text-xs font-bold text-slate-200 block mt-0.5">
                          ₹{activeTrip.invoice_total_amount ? parseFloat(activeTrip.invoice_total_amount).toFixed(2) : (activeTrip.amount_due_for_collection ? parseFloat(activeTrip.amount_due_for_collection).toFixed(2) : "0.00")}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Amount Paid</span>
                        <span className="text-xs font-bold text-emerald-400 block mt-0.5">
                          ₹{activeTrip.invoice_paid_amount ? parseFloat(activeTrip.invoice_paid_amount).toFixed(2) : "0.00"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Balance Due</span>
                        <span className="text-base font-extrabold text-white block mt-0.5">
                          ₹{activeTrip.amount_due_for_collection ? parseFloat(activeTrip.amount_due_for_collection).toFixed(2) : "0.00"}
                        </span>
                      </div>
                    </div>

                    {/* Destination Payment Trigger Button & Actions */}
                    {parseFloat(activeTrip.amount_due_for_collection || "0") > 0 ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            disabled={initiatingPayment}
                            onClick={handlePayCargoXNow}
                            className="flex-1 min-w-[200px] py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                          >
                            <QrCode size={18} />
                            {initiatingPayment ? "Generating CargoX Payment..." : "Pay CargoX Now"}
                          </button>

                          <button
                            disabled={checkingStatus}
                            onClick={handleCheckPaymentStatus}
                            className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition cursor-pointer"
                          >
                            <RotateCw size={14} className={checkingStatus ? "animate-spin text-emerald-400" : ""} />
                            Check Status
                          </button>
                        </div>

                        {/* Customer Dynamic Payment Display */}
                        {(paymentState === "QR Ready" || paymentState === "Waiting for Payment") && (paymentOrder || activeTrip.qr_image_url) && (
                          <div className="p-5 rounded-xl bg-white text-slate-900 shadow-2xl flex flex-col md:flex-row items-center gap-6 mt-4">
                            <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-200 shrink-0 text-center">
                              <img
                                src={paymentOrder?.qr_image_url || activeTrip.qr_image_url}
                                alt="CargoX Corporate UPI QR"
                                className="w-48 h-48 mx-auto object-contain"
                              />
                              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mt-2">
                                Scan with any UPI app
                              </span>
                            </div>

                            <div className="flex-1 space-y-2 text-center md:text-left">
                              <div className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded uppercase tracking-wider">
                                Official CargoX Beneficiary
                              </div>
                              <h4 className="text-lg font-black text-slate-950">
                                {paymentOrder?.business_name || activeTrip.business_name || "CargoX Logistics"}
                              </h4>
                              <p className="text-xs text-slate-600 font-mono">
                                UPI: <span className="font-bold text-slate-900">{paymentOrder?.cargox_upi_id || activeTrip.cargox_upi_id || "CargoX Current Account"}</span>
                              </p>
                              <p className="text-xs text-slate-600">
                                Invoice: <span className="font-bold text-slate-900">{activeTrip.invoice_number || "CX-INV"}</span>
                              </p>
                              <div className="text-2xl font-black text-emerald-700 py-1">
                                ₹{parseFloat(activeTrip.amount_due_for_collection || "0").toFixed(2)}
                              </div>

                              <div className="flex flex-wrap gap-2 pt-2">
                                {(paymentOrder?.upi_uri || activeTrip.upi_uri) && (
                                  <a
                                    href={paymentOrder?.upi_uri || activeTrip.upi_uri}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                                  >
                                    <ExternalLink size={12} /> Open UPI App
                                  </a>
                                )}
                                <button
                                  onClick={handleCopyPaymentLink}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-slate-300 transition cursor-pointer"
                                >
                                  <Copy size={12} /> Copy Payment Link
                                </button>
                                <button
                                  onClick={handleCheckPaymentStatus}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <RotateCw size={12} /> Verify Payment
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                          <CheckCircle2 size={24} />
                        </div>
                        <h4 className="text-sm font-bold text-emerald-200">Payment Fully Completed</h4>
                        <p className="text-xs text-emerald-400/80">
                          Invoice #{activeTrip.invoice_number || "CX-INV"} is settled in full. Trip completes automatically once delivery is confirmed.
                        </p>
                      </div>
                    )}
                  </div>
                )}

              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-slate-400">You have no active deliveries.</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
               <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Activity</h2>
               <button className="text-xs text-blue-400 font-semibold">View All</button>
            </div>
            
            <div className="space-y-4">
               {activeTrip ? (
                 <>
                   <div className="flex gap-4 items-start">
                     <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20"></div>
                     <div className="flex-1">
                       <div className="flex justify-between">
                         <p className="text-sm font-semibold text-white">Trip Assigned</p>
                         <span className="text-xs text-slate-500">Today</span>
                       </div>
                       <p className="text-xs text-slate-400 mt-1">Trip assigned to you</p>
                     </div>
                   </div>
                 </>
               ) : (
                 <p className="text-xs text-slate-500">No recent activity.</p>
               )}
            </div>
          </div>
        </div>

        {/* Right Column: Tracking & Details */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-sm font-bold text-white tracking-wider uppercase">Route & Tracking</h2>
               <button
                 onClick={() => {
                   if (!activeTrip) return;
                   openGoogleMapsRoute(
                     activeTrip.pickup_lat || activeTrip.request?.pickup_lat,
                     activeTrip.pickup_lng || activeTrip.request?.pickup_lng,
                     activeTrip.pickup_address || activeTrip.request?.pickup_address,
                     activeTrip.destination_lat || activeTrip.request?.destination_lat,
                     activeTrip.destination_lng || activeTrip.request?.destination_lng,
                     activeTrip.destination_address || activeTrip.request?.destination_address
                   );
                 }}
                 className="text-xs text-blue-400 border border-blue-400/30 rounded px-2 py-1 hover:bg-blue-400/10 cursor-pointer"
               >
                 Open in Maps
               </button>
            </div>
            
            <div className="rounded-lg overflow-hidden border border-slate-700 h-64 bg-slate-800 relative flex items-center justify-center">
               <MapContainer center={[17.3850, 78.4867]} zoom={6} scrollWheelZoom={false} className="h-full w-full z-0">
                  <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {activeTrip && (activeTrip.pickup_lat || activeTrip.request?.pickup_lat) && (activeTrip.destination_lat || activeTrip.request?.destination_lat) && (
                     <>
                        <CircleMarker center={[activeTrip.pickup_lat || activeTrip.request.pickup_lat, activeTrip.pickup_lng || activeTrip.request.pickup_lng]} radius={6} color="#3b82f6" fillColor="#3b82f6" fillOpacity={1}></CircleMarker>
                        <CircleMarker center={[activeTrip.destination_lat || activeTrip.request.destination_lat, activeTrip.destination_lng || activeTrip.request.destination_lng]} radius={6} color="#ef4444" fillColor="#ef4444" fillOpacity={1}></CircleMarker>
                     </>
                  )}
               </MapContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Trip Details</h2>
            <div className="space-y-3 text-sm">
               <div className="grid grid-cols-[120px_1fr] gap-2">
                 <div className="text-slate-500 flex items-center gap-2"><ClipboardList size={14}/> Order Number</div>
                 <div className="text-white font-medium">{activeTrip?.request_number || activeTrip?.request?.request_number || "—"}</div>
               </div>
               <div className="grid grid-cols-[120px_1fr] gap-2">
                 <div className="text-slate-500 flex items-center gap-2"><Truck size={14}/> Trip Number</div>
                 <div className="text-white font-medium">{activeTrip?.trip_id ? `CX-${String(activeTrip.trip_id).slice(-8).toUpperCase()}` : (activeTrip?.id ? `CX-${String(activeTrip.id).padStart(4, '0')}` : "—")}</div>
               </div>
               <div className="grid grid-cols-[120px_1fr] gap-2">
                 <div className="text-slate-500 flex items-center gap-2"><MapPin className="text-blue-500" size={14}/> Pickup</div>
                 <div className="text-white">{activeTrip?.pickup_address || activeTrip?.request?.pickup_address || "—"}</div>
               </div>
               <div className="grid grid-cols-[120px_1fr] gap-2">
                 <div className="text-slate-500 flex items-center gap-2"><MapPin className="text-red-500" size={14}/> Destination</div>
                 <div className="text-white">{activeTrip?.destination_address || activeTrip?.request?.destination_address || "—"}</div>
               </div>
               <div className="grid grid-cols-[120px_1fr] gap-2 pt-2 border-t border-slate-800">
                 <div className="text-slate-500 flex items-center gap-2"><Activity size={14}/> Distance</div>
                 <div className="text-white">{(activeTrip?.distance_km ?? activeTrip?.request?.distance_km) ? `${activeTrip?.distance_km ?? activeTrip?.request?.distance_km} km` : "—"}</div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCurrentOrders = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Current Orders</h2>
      {activeTrip ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
           <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <div>
                 <p className="text-sm text-slate-400">Order #{activeTrip.request_number || activeTrip.booking_id || "ORD"}</p>
                 <p className="text-xl font-bold text-white">Trip #{activeTrip.request_number || activeTrip.request?.request_number || String(activeTrip.trip_id || activeTrip.id).slice(-8).toUpperCase()}</p>
              </div>
              <StatusBadge status={activeTrip.status} />
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                 <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pickup</p>
                 <p className="text-white text-sm">{activeTrip.pickup_address || activeTrip.request?.pickup_address}</p>
              </div>
              <div>
                 <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Destination</p>
                 <p className="text-white text-sm">{activeTrip.destination_address || activeTrip.request?.destination_address}</p>
              </div>
           </div>
        </div>
      ) : (
        <p className="text-slate-400">No active orders.</p>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Previous Orders</h2>
      <div className="space-y-4">
        {history.length > 0 ? history.map((trip: any) => (
          <div key={trip.trip_id || trip.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col md:flex-row justify-between gap-4">
             <div>
                <p className="font-bold text-white text-lg">Trip #{trip.request_number || trip.request?.request_number || trip.trip_id || trip.id}</p>
                <p className="text-sm text-slate-400 mt-1">{trip.pickup_address || trip.request?.pickup_address || "Pickup"} → {trip.destination_address || trip.request?.destination_address || "Destination"}</p>
                <p className="text-xs text-slate-500 mt-2">Cargo: {trip.goods_type || trip.request?.goods_type} | Weight: {trip.weight_tons ?? trip.request?.weight_tons}t</p>
             </div>
             <div className="text-left md:text-right flex flex-col justify-between">
                <div><StatusBadge status={trip.status} /></div>
                <div className="mt-3 text-sm text-slate-300">
                   Payment: <span className="text-white font-medium">{trip.payment_status || "Completed"}</span> ({trip.payment_type || "UPI"})
                </div>
             </div>
          </div>
        )) : (
          <p className="text-slate-400">No previous orders found.</p>
        )}
      </div>
    </div>
  );

  const renderTracking = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Route & Tracking</h2>
      {activeTrip ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 h-[600px]">
           <MapContainer center={[17.3850, 78.4867]} zoom={6} scrollWheelZoom={false} className="h-full w-full rounded-lg">
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {activeTrip.request?.pickup_lat && activeTrip.request?.destination_lat && (
                 <>
                    <CircleMarker center={[activeTrip.request.pickup_lat, activeTrip.request.pickup_lng]} radius={8} color="#3b82f6" fillColor="#3b82f6" fillOpacity={1}></CircleMarker>
                    <CircleMarker center={[activeTrip.request.destination_lat, activeTrip.request.destination_lng]} radius={8} color="#ef4444" fillColor="#ef4444" fillOpacity={1}></CircleMarker>
                 </>
              )}
           </MapContainer>
        </div>
      ) : (
        <p className="text-slate-400">No active tracking available.</p>
      )}
    </div>
  );

  const renderPayments = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Payments</h2>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 max-w-2xl">
         <p className="text-sm text-slate-400 mb-6">Payment information is restricted to operational status only. For settlement details, contact dispatch.</p>
         
         <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-800">
               <span className="text-slate-300">Payment Type</span>
               <span className="font-bold text-white bg-slate-800 px-3 py-1 rounded">{activeTrip?.payment_type || "Not Specified"}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-800">
               <span className="text-slate-300">Current Status</span>
               <StatusBadge status={activeTrip?.payment_status || "PENDING"} />
            </div>
         </div>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Profile</h2>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 max-w-2xl">
         <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold">
               {user?.firstName?.[0] || profile?.email?.[0]?.toUpperCase() || "D"}
            </div>
            <div>
               <h3 className="text-xl font-bold text-white">{user?.fullName || profile?.email || "Driver Name"}</h3>
               <p className="text-blue-400 text-sm font-semibold">Verified Driver</p>
            </div>
         </div>
         
          <div className="space-y-4 pt-4 border-t border-slate-800 text-sm">
            <div className="grid grid-cols-[150px_1fr]">
               <span className="text-slate-500">Email</span>
               <span className="text-slate-200">{user?.primaryEmailAddress?.emailAddress || profile?.email}</span>
            </div>
            <div className="grid grid-cols-[150px_1fr]">
               <span className="text-slate-500">Account Status</span>
               <span className="text-emerald-400 font-medium">Active</span>
            </div>
         </div>
      </div>
    </div>
  );

  const contentMap: Record<string, any> = {
    Dashboard: renderDashboard(),
    "Current Orders": renderCurrentOrders(),
    "Previous Orders": renderHistory(),
    Tracking: renderTracking(),
    Payments: renderPayments(),
    Profile: renderProfile(),
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row relative">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-lg tracking-wide flex items-center gap-2">
             <Truck size={18} className="text-blue-400"/> CargoX
          </span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationDropdown userType="DRIVER" userId={0} />
          {isSignedIn ? <UserButton /> : (
            <button 
              onClick={() => { localStorage.removeItem("access_token"); window.location.href = "/"; }}
              className="text-sm font-semibold text-red-400 border border-red-500/30 rounded px-2 py-1"
            >
              Log out
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sidebar Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-[#0B1120] border-r border-slate-800 text-white min-h-screen flex flex-col shadow-2xl
        transition-transform duration-300 ease-in-out
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-5 pb-2">
          <div className="flex items-center gap-3 mb-2">
            <Truck size={24} className="text-blue-500" />
            <h2 className="text-2xl font-bold tracking-wider">CargoX</h2>
            <button 
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 mt-6">
          {driverSidebar.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => { setSelectedTab(label); setIsMobileSidebarOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                 selectedTab === label 
                   ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                   : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 border-b border-slate-800 bg-slate-900/50 items-center justify-between px-8 sticky top-0 z-10 backdrop-blur-sm">
           <div></div>
           <div className="flex items-center gap-5">
              <NotificationDropdown userType="DRIVER" userId={0} />
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                    DR
                 </div>
                 <div className="text-right">
                    <p className="text-sm font-bold text-white">{user?.fullName || profile?.email?.split('@')[0] || "Driver"}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Driver</p>
                 </div>
                 {isSignedIn ? <UserButton /> : (
                    <button 
                      onClick={() => { localStorage.removeItem("access_token"); window.location.href = "/"; }}
                      className="text-xs font-semibold text-red-400 border border-red-500/30 rounded px-2 py-1 ml-2"
                    >
                      Log out
                    </button>
                 )}
              </div>
           </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}
          {loading ? (
             <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
             </div>
          ) : (
             contentMap[selectedTab] || contentMap.Dashboard
          )}
        </main>
      </div>
    </div>
  );
}
