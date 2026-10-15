import { useState } from "react";
import { ArrowLeft, Share2, MoreVertical, Phone, MessageSquare } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";

const truckIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

import { useEffect } from "react";
import { api } from "../../services/api";

interface LiveTrackingScreenProps {
  onBack: () => void;
  onViewDetails?: () => void;
  requestId?: string;
  bookingRef?: string;
  driverName?: string;
  driverPhone?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  vehicleCapacity?: string;
  etaString?: string;
  remainingKm?: number;
  speedKmH?: number;
}

export default function LiveTrackingScreen({
  onBack,
  onViewDetails,
  requestId,
  driverName,
  driverPhone,
  vehiclePlate,
  vehicleModel,
  vehicleCapacity,
  etaString,
  remainingKm,
  speedKmH
}: LiveTrackingScreenProps) {
  const [mapType, setMapType] = useState<"Map" | "Satellite">("Map");
  const [liveData, setLiveData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(requestId));
  const [truckPos, setTruckPos] = useState<[number, number] | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);

  useEffect(() => {
    if (requestId) {
      let isMounted = true;
      setIsLoading(true);
      api.getTracking(requestId)
        .then((res) => {
          if (isMounted && res) {
            setLiveData(res);
            if (res.current_lat && res.current_lng) {
              setTruckPos([res.current_lat, res.current_lng]);
            } else {
              setTruckPos(null);
            }
            if (Array.isArray(res.breadcrumbs) && res.breadcrumbs.length > 0) {
              const pts: [number, number][] = res.breadcrumbs.map((b: any) => [b.lat, b.lng]);
              setRouteCoords(pts);
            } else {
              setRouteCoords([]);
            }
          }
        })
        .catch((err) => {
          console.warn("Could not load tracking:", err);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
      return () => { isMounted = false; };
    } else {
      setIsLoading(false);
    }
  }, [requestId]);

  const activeDriverName = liveData?.driver_name || driverName || null;
  const activeDriverPhone = liveData?.driver_phone || driverPhone || null;
  const activePlate = liveData?.vehicle_registration || vehiclePlate || null;
  const activeVehicleType = liveData?.vehicle_type || vehicleModel || null;
  const activeCapacity = liveData?.vehicle_capacity_tons 
    ? `${liveData.vehicle_capacity_tons} Ton` 
    : (vehicleCapacity || null);
  const operationalStatus = liveData?.status || "SUBMITTED";
  const isDriverAssigned = Boolean(activeDriverName || activePlate);
  const hasLiveGps = Boolean(truckPos);

  return (
    <div className="relative min-h-screen w-full bg-slate-50 flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header matching Screen 10 */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-100 shadow-xs">
        <button
          onClick={onBack}
          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900">Live Tracking</h1>
        <div className="flex items-center gap-1">
          {isLoading && (
            <div className="w-4 h-4 border-2 border-[#1e60ff] border-t-transparent rounded-full animate-spin mr-1" />
          )}
          <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
            <Share2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map Type Switcher (Map / Satellite) matching Screen 10 */}
      <div className="absolute top-16 right-4 z-20">
        <div className="bg-white/95 backdrop-blur-md rounded-xl p-0.5 border border-slate-200 shadow-md flex items-center text-xs font-semibold">
          <button
            onClick={() => setMapType("Map")}
            className={`px-3 py-1 rounded-lg transition-all ${
              mapType === "Map" ? "bg-white text-slate-800 shadow-xs font-bold" : "text-slate-500"
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setMapType("Satellite")}
            className={`px-3 py-1 rounded-lg transition-all ${
              mapType === "Satellite" ? "bg-[#0b1329] text-white shadow-xs font-bold" : "text-slate-500"
            }`}
          >
            Satellite
          </button>
        </div>
      </div>

      {/* Interactive Leaflet Map with actual GPS marker or centered fallback */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={truckPos ? truckPos : [17.3850, 78.4867]}
          zoom={truckPos ? 12 : 7}
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={
              mapType === "Satellite"
                ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
          />
          {truckPos && <Marker position={truckPos} icon={truckIcon} />}
          {routeCoords.length > 1 && (
            <Polyline positions={routeCoords} color="#1e60ff" weight={4} opacity={0.85} />
          )}
        </MapContainer>
      </div>

      {/* GPS Status Notice Pill */}
      <div className="absolute top-[32%] right-4 z-10">
        {hasLiveGps ? (
          <div className="bg-[#0b1329] text-white px-3 py-2 rounded-xl shadow-xl border border-white/10 text-center">
            <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Live Signal</p>
            <p className="text-xs font-black tracking-tight mt-0.5">{speedKmH ? `${speedKmH} km/h` : "Active"}</p>
          </div>
        ) : (
          <div className="bg-[#0b1329]/90 backdrop-blur-md text-white px-3 py-2 rounded-xl shadow-xl border border-white/10 text-center max-w-[160px]">
            <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Location Status</p>
            <p className="text-[10px] text-slate-300 font-medium mt-0.5 leading-tight">Live location is not available yet.</p>
          </div>
        )}
      </div>

      {/* Bottom Live Tracking Details Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] p-5 pb-[max(env(safe-area-inset-bottom,20px),20px)] border-t border-slate-100 max-w-md mx-auto">
        {/* Operational Status Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shipment Status</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">
              {operationalStatus.replace(/_/g, " ")}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            operationalStatus === "DELIVERED" || operationalStatus === "COMPLETED"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : operationalStatus === "IN_TRANSIT"
              ? "bg-blue-50 text-[#1e60ff] border border-blue-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}>
            {operationalStatus === "SUBMITTED" || operationalStatus === "UNDER_REVIEW" 
              ? "Under Operations Review" 
              : operationalStatus.replace(/_/g, " ")}
          </span>
        </div>

        {/* Driver Contact & Info or Authentic Awaiting State */}
        {isDriverAssigned ? (
          <>
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-[#1e60ff] flex items-center justify-center font-bold text-base border-2 border-blue-200 shadow-xs">
                  {activeDriverName ? activeDriverName.charAt(0) : "D"}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{activeDriverName || "Assigned Driver"}</h2>
                  <p className="text-xs text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                    <span className="text-emerald-600 font-medium">Verified CargoX Carrier</span>
                  </p>
                </div>
              </div>

              {/* Call and Message buttons */}
              {activeDriverPhone && (
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${activeDriverPhone}`}
                    className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 text-slate-700 hover:text-emerald-600 hover:border-emerald-200 flex items-center justify-center transition-colors"
                    title="Call Driver"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <a
                    href={`sms:${activeDriverPhone}`}
                    className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center transition-colors"
                    title="Message Driver"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>

            {/* Vehicle Registration & Details */}
            <div className="py-2.5 border-b border-slate-100">
              <p className="text-[10px] text-slate-400 font-semibold">Vehicle: <span className="text-slate-700 font-bold">{activeVehicleType || "Commercial Freight Vehicle"}</span></p>
              <div className="flex items-center gap-2 mt-0.5">
                {activePlate && (
                  <span className="text-xs font-black text-slate-900 tracking-wider bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    {activePlate}
                  </span>
                )}
                {activeCapacity && (
                  <>
                    <span className="text-slate-400">|</span>
                    <span className="text-xs text-slate-600 font-semibold">{activeCapacity}</span>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <span className="text-lg">⏳</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Vehicle & Driver Assignment Pending</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                Driver will be assigned by CargoX operations after route review.
              </p>
            </div>
          </div>
        )}

        {/* ETA or Latest Update Timestamp */}
        <div className="pt-2.5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-semibold">
              {liveData?.last_location_update ? "Latest Location Update" : "Trip Schedule"}
            </p>
            <p className="text-xs font-bold text-slate-900 mt-0.5">
              {liveData?.last_location_update 
                ? new Date(liveData.last_location_update).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                : etaString || "Estimated upon dispatch"}
            </p>
            {remainingKm !== undefined && (
              <div className="mt-1">
                <span className="text-[10px] text-slate-400 font-semibold">Remaining Distance: </span>
                <span className="text-xs font-extrabold text-[#1e60ff]">{remainingKm} km</span>
              </div>
            )}
          </div>

          <button
            onClick={onViewDetails}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}
