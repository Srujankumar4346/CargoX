import { useEffect, useState } from "react";
import { Activity, ClipboardList, Navigation, Package, Wallet, MapPin, Clock } from "lucide-react";

const driverSidebar = [
  { label: "Dashboard", icon: Activity },
  { label: "Current Orders", icon: ClipboardList },
  { label: "Previous Orders", icon: Package },
  { label: "Tracking", icon: Navigation },
  { label: "Payments", icon: Wallet },
  { label: "Delivery / POD", icon: MapPin },
];

export default function DriverWorkspace() {
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("Dashboard");

  const loadDriverData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeRes, historyRes] = await Promise.all([
        fetch(`${(import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")}/api/v1/driver/trips/active`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        }).then((res) => (res.status === 404 ? null : res.json())),
        fetch(`${(import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")}/api/v1/driver/trips/history`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        }).then((res) => (res.ok ? res.json() : [])),
      ]);

      setActiveTrip(activeRes);
      setHistory(Array.isArray(historyRes) ? historyRes : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load driver workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriverData();
  }, []);

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="text-xl font-semibold text-white">Driver Dashboard</h2>
        <p className="mt-2 text-sm text-slate-400">Assigned operations and delivery-readiness for your current trip.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center gap-2 text-slate-300">
            <Package className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium">Current Order</span>
          </div>
          <div className="mt-4 text-lg font-semibold text-white">
            {activeTrip ? activeTrip.request_number || "Assigned trip" : "No active trip"}
          </div>
          <div className="mt-2 text-sm text-slate-400">
            {activeTrip ? `${activeTrip.pickup_address || "Pickup"} → ${activeTrip.destination_address || "Destination"}` : "No trip assigned"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center gap-2 text-slate-300">
            <Wallet className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium">Payment Status</span>
          </div>
          <div className="mt-4 text-lg font-semibold text-white">{activeTrip?.payment_status || "Not available"}</div>
          <div className="mt-2 text-sm text-slate-400">{activeTrip?.payment_type || "Payment type not exposed beyond operational status"}</div>
        </div>
      </div>
    </div>
  );

  const renderCurrentOrders = () => (
    <div className="space-y-4">
      {activeTrip ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Request</div>
              <div className="text-xl font-semibold text-white">{activeTrip.request_number || activeTrip.request_id}</div>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">
              {activeTrip.status}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Cargo</div>
              <div className="mt-2 text-sm text-slate-200">{activeTrip.goods_type || "Cargo"}</div>
              <div className="mt-2 text-sm text-slate-400">{activeTrip.goods_description || "No description provided"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Vehicle</div>
              <div className="mt-2 text-sm text-slate-200">{activeTrip.vehicle_registration || "Assigned vehicle"}</div>
              <div className="mt-2 text-sm text-slate-400">{activeTrip.weight_tons || 0} tons</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Pickup</div>
              <div className="mt-2 text-sm text-slate-200">{activeTrip.pickup_address}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Destination</div>
              <div className="mt-2 text-sm text-slate-200">{activeTrip.destination_address}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-6 text-slate-400">
          No active order is currently assigned to this driver.
        </div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-3">
      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-6 text-slate-400">
          No previous assigned orders found.
        </div>
      ) : (
        history.map((trip: any) => (
          <div key={trip.trip_id || trip.request_id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-white font-semibold">{trip.request_number || trip.request_id}</div>
              <span className="text-xs text-slate-400">{trip.status}</span>
            </div>
            <div className="mt-2 text-sm text-slate-400">{trip.pickup_address} → {trip.destination_address}</div>
          </div>
        ))
      )}
    </div>
  );

  const renderTracking = () => (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex items-center gap-2 text-slate-200">
        <Navigation className="h-4 w-4 text-sky-400" />
        <span className="font-medium">Assigned trip route</span>
      </div>
      <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Pickup</div>
          <div className="mt-2">{activeTrip?.pickup_address || "No active pickup"}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Destination</div>
          <div className="mt-2">{activeTrip?.destination_address || "No active destination"}</div>
        </div>
      </div>
    </div>
  );

  const renderPayments = () => (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="text-sm text-slate-300">Operational payment information only</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Payment Type</div>
          <div className="mt-2 font-medium text-white">{activeTrip?.payment_type || "UPI / COD"}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Payment Status</div>
          <div className="mt-2 font-medium text-white">{activeTrip?.payment_status || "Pending verification"}</div>
        </div>
      </div>
    </div>
  );

  const renderPOD = () => (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex items-center gap-2 text-slate-200">
        <ClipboardList className="h-4 w-4 text-amber-400" />
        <span className="font-medium">Delivery / POD</span>
      </div>
      <div className="mt-4 text-sm text-slate-400">
        POD and delivery updates remain subject to the existing backend driver workflow and state machine.
      </div>
    </div>
  );

  const contentMap: Record<string, any> = {
    Dashboard: renderDashboard(),
    "Current Orders": renderCurrentOrders(),
    "Previous Orders": renderHistory(),
    Tracking: renderTracking(),
    Payments: renderPayments(),
    "Delivery / POD": renderPOD(),
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-900/80 p-5 hidden lg:block">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">CargoX</div>
            <div className="mt-2 text-2xl font-bold text-white">Driver Workspace</div>
          </div>
          <nav className="space-y-2">
            {driverSidebar.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => setSelectedTab(label)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${selectedTab === label ? "bg-sky-500/15 text-white ring-1 ring-sky-500/25" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          <header className="mb-6 flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Operational Access</div>
              <h1 className="mt-2 text-2xl font-bold text-white">{selectedTab}</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              {loading ? "Loading" : "Live"}
            </div>
          </header>

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
          ) : null}

          {contentMap[selectedTab] || contentMap.Dashboard}
        </main>
      </div>
    </div>
  );
}
