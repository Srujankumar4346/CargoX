import { useEffect, useState } from "react";
import { Activity, ClipboardList, Navigation, Package, Wallet, MapPin, Clock, Menu, X, CheckCircle2, Truck, IndianRupee, ArrowRight, User } from "lucide-react";
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
                        <button className="mt-3 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md flex items-center gap-2 font-medium transition">
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
                        <button className="mt-3 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md flex items-center gap-2 font-medium transition">
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
                    <button disabled className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 bg-slate-800 transition flex items-center gap-2 cursor-not-allowed">
                       <CheckCircle2 size={14}/> Complete Delivery
                    </button>
                  )}
                </div>
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
               <button className="text-xs text-blue-400 border border-blue-400/30 rounded px-2 py-1 hover:bg-blue-400/10">Open in Maps</button>
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
