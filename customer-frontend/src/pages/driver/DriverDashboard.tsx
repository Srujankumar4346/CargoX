import { useState, useEffect } from "react";
import { MapPin, Navigation, Phone, WifiOff, CheckCircle, Clock, QrCode, RotateCw, Copy, ExternalLink, IndianRupee } from "lucide-react";

interface DriverTrip {
  trip_id: string;
  request_id: string;
  request_number: string;
  status: string;
  goods_type: string;
  goods_description?: string;
  weight_tons: number;
  special_instructions?: string;
  pickup_company_name: string;
  pickup_address: string;
  pickup_contact_person?: string;
  pickup_phone?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  destination_company_name: string;
  destination_address: string;
  destination_contact_person?: string;
  destination_phone?: string;
  destination_lat?: number;
  destination_lng?: number;
  vehicle_registration: string;
  vehicle_type: string;
  assigned_at: string;
  pickup_started_at?: string;
  started_at?: string;
  arrived_at?: string;
  current_lat?: number;
  current_lng?: number;
  customer_name?: string;
  payment_method?: string;
  collection_status?: string;
  amount_due_for_collection?: string | number;
  invoice_number?: string;
  invoice_total_amount?: string | number;
  invoice_paid_amount?: string | number;
  business_name?: string;
  cargox_upi_id?: string;
  qr_image_url?: string;
  upi_uri?: string;
  payment_status_display?: string;
  gateway_order_id?: string;
  gateway_key_id?: string;
  payment_instructions?: string;
}

// IndexedDB Helper for Offline Location Telemetry Queue
const DB_NAME = "CargoX_Driver_PWA";
const DB_VERSION = 1;
const STORE_NAME = "gps_telemetry_queue";

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const queueLocationOffline = async (tripId: string, lat: number, lng: number) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.add({
      trip_id: tripId,
      lat,
      lng,
      captured_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("Failed to queue GPS offline in IndexedDB:", e);
  }
};

const flushLocationQueue = async (sendLocationFn: (tripId: string, lat: number, lng: number) => Promise<void>) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getAllReq = store.getAll();
    getAllReq.onsuccess = async () => {
      const items = getAllReq.result;
      if (items && items.length > 0) {
        for (const item of items) {
          try {
            await sendLocationFn(item.trip_id, item.lat, item.lng);
          } catch (err) {
            console.error("Failed to push queued location:", err);
          }
        }
        // Clear store after flush attempt
        const clearTx = db.transaction(STORE_NAME, "readwrite");
        clearTx.objectStore(STORE_NAME).clear();
      }
    };
  } catch (e) {
    console.error("Failed to flush IndexedDB location queue:", e);
  }
};

export default function DriverDashboard() {
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [locationLog, setLocationLog] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [paymentState, setPaymentState] = useState<string>("Payment Due");
  const [paymentLoading, setPaymentLoading] = useState(false);

  const fetchActiveTrip = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/driver/trips/active", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
          "Content-Type": "application/json"
        }
      });
      if (res.status === 404) {
        setTrip(null);
      } else if (!res.ok) {
        throw new Error("Failed to load active trip details");
      } else {
        const data = await res.json();
        setTrip(data);
        if (data.payment_status_display === "Paid" || parseFloat(data.amount_due_for_collection || "0") <= 0) {
          setPaymentState("Payment Successful");
        } else if (data.payment_status_display) {
          setPaymentState(data.payment_status_display);
        }
      }
    } catch (err: any) {
      setError(err.message || "Network error loading trip");
    } finally {
      setLoading(false);
    }
  };

  const handlePayCargoXNow = async () => {
    if (!trip) return;
    setPaymentLoading(true);
    try {
      const res = await fetch(`/api/v1/driver/trips/${trip.trip_id}/pay-cargox-now`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
          "Content-Type": "application/json"
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Payment order creation failed");
      }
      const data = await res.json();
      setPaymentOrder(data);
      setPaymentState(data.payment_status_display || "Waiting for Payment");
      fetchActiveTrip();
    } catch (err: any) {
      alert(err.message || "Could not initiate payment");
      setPaymentState("Payment Failed");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!trip) return;
    setPaymentLoading(true);
    try {
      const res = await fetch(`/api/v1/driver/trips/${trip.trip_id}/payment-status`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
          "Content-Type": "application/json"
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentState(data.status);
        if (data.is_fully_paid) {
          alert("Payment verified! Balance settled in full.");
        }
        fetchActiveTrip();
      }
    } catch (err) {
      console.error("Status check failed:", err);
    } finally {
      setPaymentLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveTrip();

    const handleOnline = () => {
      setIsOffline(false);
      flushLocationQueue(sendLocationApi);
      fetchActiveTrip();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const sendLocationApi = async (tripId: string, lat: number, lng: number) => {
    const res = await fetch(`/api/v1/driver/trips/${tripId}/location`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ lat, lng })
    });
    if (!res.ok) throw new Error("Location push failed");
  };

  // Watch GPS Position
  useEffect(() => {
    if (!trip || !["DRIVER_ASSIGNED", "PICKUP_IN_PROGRESS", "IN_TRANSIT", "ARRIVED"].includes(trip.status)) {
      return;
    }

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const timestamp = new Date().toLocaleTimeString();
          if (navigator.onLine) {
            try {
              await sendLocationApi(trip.trip_id, latitude, longitude);
              setLocationLog(prev => [`[${timestamp}] GPS Pushed: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, ...prev.slice(0, 4)]);
            } catch (e) {
              await queueLocationOffline(trip.trip_id, latitude, longitude);
              setLocationLog(prev => [`[${timestamp}] GPS Queued Offline: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, ...prev.slice(0, 4)]);
            }
          } else {
            await queueLocationOffline(trip.trip_id, latitude, longitude);
            setLocationLog(prev => [`[${timestamp}] GPS Queued Offline: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, ...prev.slice(0, 4)]);
          }
        },
        (err) => console.warn("GPS Access Error:", err.message),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [trip]);

  const handleStateAction = async (actionPath: string) => {
    if (isOffline) {
      alert("State transitions cannot be executed offline. Please reconnect to network to trigger state update.");
      return;
    }
    if (!trip) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/driver/trips/${trip.trip_id}/${actionPath}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
          "Content-Type": "application/json"
        }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "State update failed");
      }
      const updatedTrip = await res.json();
      setTrip(updatedTrip);
    } catch (e: any) {
      alert(e.message || "Failed to update trip status");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-20 flex justify-between items-center shadow-lg">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-lg">
            CX
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-100 leading-tight">CargoX Driver PWA</h1>
            <p className="text-xs text-slate-400">Mobile Execution Console</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <a
            href="tel:18001234567"
            className="flex items-center space-x-1 px-3 py-1.5 bg-rose-600/20 text-rose-400 border border-rose-600/30 rounded-full text-xs font-semibold hover:bg-rose-600/30 transition"
            title="Call Operations Desk"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Ops Desk</span>
          </a>
        </div>
      </header>

      {/* Network Status Banner */}
      {isOffline && (
        <div className="bg-amber-600 text-amber-950 font-bold px-4 py-2 text-xs flex items-center justify-between sticky top-14 z-20">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-4 h-4" />
            <span>OFFLINE MODE — Status actions disabled until reconnected. GPS updates queued in IndexedDB.</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {loading ? (
          <div className="p-8 text-center text-slate-400 animate-pulse">Loading active trip assignment...</div>
        ) : error ? (
          <div className="p-4 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-xl text-sm">
            {error}
          </div>
        ) : !trip ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <Clock className="w-12 h-12 text-slate-600 mx-auto" />
            <h2 className="text-lg font-bold text-slate-200">No Active Trip Assigned</h2>
            <p className="text-xs text-slate-400">You currently have no active trip dispatch. Waiting for Admin assignment.</p>
            <button
              onClick={fetchActiveTrip}
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
            >
              Refresh Active Trip
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Trip Status Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-slate-400 block">Trip Request</span>
                  <span className="text-lg font-extrabold text-emerald-400">{trip.request_number}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Vehicle</span>
                  <span className="text-sm font-bold text-slate-200">{trip.vehicle_registration} ({trip.vehicle_type})</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400">Current Status:</span>
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold rounded-full text-xs tracking-wide">
                  {trip.status}
                </span>
              </div>
            </div>

            {/* Cargo Operational Details */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cargo Info</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Goods Type</span>
                  <span className="font-semibold text-slate-200">{trip.goods_type}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Weight</span>
                  <span className="font-semibold text-slate-200">{trip.weight_tons} Tons</span>
                </div>
              </div>
              {trip.special_instructions && (
                <div className="pt-2 text-xs">
                  <span className="text-slate-500 block">Special Instructions</span>
                  <span className="text-amber-300 font-medium">{trip.special_instructions}</span>
                </div>
              )}
            </div>

            {/* Pickup & Delivery Location Cards */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
              {/* Pickup */}
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl mt-0.5">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="flex-1 text-xs">
                  <span className="text-blue-400 font-bold block uppercase tracking-wider text-[10px]">Pickup Origin</span>
                  <span className="font-bold text-slate-100 text-sm block">{trip.pickup_company_name}</span>
                  <p className="text-slate-300 mt-0.5">{trip.pickup_address}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {trip.pickup_phone && (
                      <a href={`tel:${trip.pickup_phone}`} className="inline-flex items-center space-x-1 text-blue-400 hover:underline">
                        <Phone className="w-3 h-3" />
                        <span>{trip.pickup_phone} {trip.pickup_contact_person ? `(${trip.pickup_contact_person})` : ""}</span>
                      </a>
                    )}
                    <a
                      href={trip.pickup_lat && trip.pickup_lng ? `https://www.google.com/maps/dir/?api=1&destination=${trip.pickup_lat},${trip.pickup_lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trip.pickup_address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg font-bold hover:bg-blue-600/30 transition text-[11px]"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Navigate to Pickup</span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800"></div>

              {/* Destination */}
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl mt-0.5">
                  <Navigation className="w-5 h-5" />
                </div>
                <div className="flex-1 text-xs">
                  <span className="text-emerald-400 font-bold block uppercase tracking-wider text-[10px]">Delivery Destination</span>
                  <span className="font-bold text-slate-100 text-sm block">{trip.destination_company_name}</span>
                  <p className="text-slate-300 mt-0.5">{trip.destination_address}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {trip.destination_phone && (
                      <a href={`tel:${trip.destination_phone}`} className="inline-flex items-center space-x-1 text-emerald-400 hover:underline">
                        <Phone className="w-3 h-3" />
                        <span>{trip.destination_phone} {trip.destination_contact_person ? `(${trip.destination_contact_person})` : ""}</span>
                      </a>
                    )}
                    <a
                      href={trip.destination_lat && trip.destination_lng ? `https://www.google.com/maps/dir/?api=1&destination=${trip.destination_lat},${trip.destination_lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trip.destination_address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-lg font-bold hover:bg-emerald-600/30 transition text-[11px]"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Navigate to Drop</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Sequential Primary Action Button */}
            <div className="pt-2">
              {trip.status === "DRIVER_ASSIGNED" && (
                <button
                  disabled={actionLoading || isOffline}
                  onClick={() => handleStateAction("start-pickup")}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-base rounded-2xl shadow-lg transition active:scale-[0.98]"
                >
                  {actionLoading ? "Updating..." : "Start Pickup"}
                </button>
              )}

              {trip.status === "PICKUP_IN_PROGRESS" && (
                <button
                  disabled={actionLoading || isOffline}
                  onClick={() => handleStateAction("start-transit")}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-base rounded-2xl shadow-lg transition active:scale-[0.98]"
                >
                  {actionLoading ? "Updating..." : "Complete Pickup & Start Transit"}
                </button>
              )}

              {trip.status === "IN_TRANSIT" && (
                <button
                  disabled={actionLoading || isOffline}
                  onClick={() => handleStateAction("arrive")}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-extrabold text-base rounded-2xl shadow-lg transition active:scale-[0.98]"
                >
                  {actionLoading ? "Updating..." : "Mark Arrived at Destination"}
                </button>
              )}

              {trip.status === "ARRIVED" && (
                <div className="w-full py-3 bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-center text-xs font-bold rounded-2xl flex items-center justify-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Arrived at Destination — Awaiting Verification</span>
                </div>
              )}
            </div>

            {/* RAPIDO / UBER-STYLE DESTINATION COLLECT PAYMENT SECTION */}
            {["ARRIVED", "POD_SUBMITTED", "DELIVERED"].includes(trip.status) && (
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <IndianRupee className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">Collect Customer Payment</h3>
                      <p className="text-[10px] text-slate-400">Direct settlement to CargoX corporate current account</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
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

                {/* Outstanding Ledger Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Booking / Trip</span>
                    <span className="font-extrabold text-slate-200">#{trip.request_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Customer</span>
                    <span className="font-bold text-slate-200 truncate block">{trip.customer_name || trip.pickup_company_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Invoice Total</span>
                    <span className="font-bold text-slate-300">
                      ₹{trip.invoice_total_amount ? parseFloat(String(trip.invoice_total_amount)).toFixed(2) : "0.00"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Amount Due</span>
                    <span className="font-black text-emerald-400 text-sm">
                      ₹{trip.amount_due_for_collection ? parseFloat(String(trip.amount_due_for_collection)).toFixed(2) : "0.00"}
                    </span>
                  </div>
                </div>

                {/* Destination Actions */}
                {parseFloat(String(trip.amount_due_for_collection || "0")) > 0 ? (
                  <div className="space-y-3">
                    <div className="flex space-x-2">
                      <button
                        disabled={paymentLoading}
                        onClick={handlePayCargoXNow}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-1.5 transition active:scale-[0.98]"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>{paymentLoading ? "Creating Order..." : "Pay CargoX Now"}</span>
                      </button>
                      <button
                        disabled={paymentLoading}
                        onClick={handleCheckPaymentStatus}
                        className="py-3 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center space-x-1"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${paymentLoading ? "animate-spin text-emerald-400" : ""}`} />
                        <span>Status</span>
                      </button>
                    </div>

                    {/* QR Display */}
                    {(paymentState === "QR Ready" || paymentState === "Waiting for Payment") && (paymentOrder || trip.qr_image_url) && (
                      <div className="p-4 rounded-xl bg-white text-slate-900 text-center space-y-2">
                        <img
                          src={paymentOrder?.qr_image_url || trip.qr_image_url}
                          alt="CargoX UPI QR"
                          className="w-44 h-44 mx-auto object-contain"
                        />
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Scan with Google Pay, PhonePe, Paytm, or BHIM
                        </div>
                        <div className="text-lg font-black text-emerald-700">
                          ₹{parseFloat(String(trip.amount_due_for_collection || "0")).toFixed(2)}
                        </div>
                        <div className="flex justify-center space-x-2 pt-1">
                          {(paymentOrder?.upi_uri || trip.upi_uri) && (
                            <a
                              href={paymentOrder?.upi_uri || trip.upi_uri}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg flex items-center space-x-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Open App</span>
                            </a>
                          )}
                          <button
                            onClick={() => {
                              const uri = paymentOrder?.upi_uri || trip.upi_uri;
                              if (uri) {
                                navigator.clipboard.writeText(uri);
                                alert("Link copied!");
                              }
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-lg border border-slate-300 flex items-center space-x-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Link</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-center text-xs text-emerald-300 font-bold flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Payment Received in Full. Trip completes on delivery.</span>
                  </div>
                )}
              </div>
            )}

            {/* GPS Telemetry Log Widget */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 text-xs space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                <span>GPS Telemetry Feed</span>
                <span className="text-emerald-400 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Active</span>
                </span>
              </div>
              {locationLog.length === 0 ? (
                <div className="text-slate-600 text-[11px] italic">Monitoring GPS coordinates...</div>
              ) : (
                locationLog.map((log, idx) => (
                  <div key={idx} className="text-[11px] text-slate-400 font-mono">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
