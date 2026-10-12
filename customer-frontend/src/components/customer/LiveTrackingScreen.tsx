import { useState } from "react";
import { ArrowLeft, Share2, MoreVertical, Phone, MessageSquare } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";

const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const dropIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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
  driverName = "Ravi Kumar",
  driverPhone = "+91 98765 43210",
  vehiclePlate = "TS 09 AB 1234",
  vehicleModel = "Mahindra Bolero Pik-Up",
  vehicleCapacity = "2 Ton",
  etaString = "Today, 2:30 PM (2h 15m)",
  remainingKm = 120,
  speedKmH = 72
}: LiveTrackingScreenProps) {
  const [mapType, setMapType] = useState<"Map" | "Satellite">("Map");
  const [liveData, setLiveData] = useState<any>(null);
  const [truckPos, setTruckPos] = useState<[number, number]>([16.9200, 79.9500]);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([
    [17.3850, 78.4867],
    [17.1500, 79.2000],
    [16.9200, 79.9500],
    [16.7000, 80.2000],
    [16.5062, 80.6480]
  ]);

  useEffect(() => {
    if (requestId) {
      let isMounted = true;
      api.getTracking(requestId)
        .then((res) => {
          if (isMounted && res) {
            setLiveData(res);
            if (res.current_lat && res.current_lng) {
              setTruckPos([res.current_lat, res.current_lng]);
            }
            if (Array.isArray(res.breadcrumbs) && res.breadcrumbs.length > 0) {
              const pts: [number, number][] = res.breadcrumbs.map((b: any) => [b.lat, b.lng]);
              setRouteCoords(pts);
            }
          }
        })
        .catch(() => {});
      return () => { isMounted = false; };
    }
  }, [requestId]);

  const activeDriverName = liveData?.driver_name || driverName;
  const activeDriverPhone = liveData?.driver_phone || driverPhone;
  const activePlate = liveData?.vehicle_registration || vehiclePlate;
  const activeVehicleType = liveData?.vehicle_type || vehicleModel;
  const activeCapacity = liveData?.vehicle_capacity_tons ? `${liveData.vehicle_capacity_tons} Ton` : vehicleCapacity;

  // Hyderabad to Vijayawada route coordinates
  const hyderabad = [17.3850, 78.4867] as [number, number];
  const vijayawada = [16.5062, 80.6480] as [number, number];

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

      {/* Interactive Leaflet Map */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[16.9200, 79.9500]}
          zoom={8}
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
          <Marker position={hyderabad} icon={pickupIcon} />
          <Marker position={vijayawada} icon={dropIcon} />
          <Marker position={truckPos} icon={truckIcon} />
          <Polyline positions={routeCoords} color="#1e60ff" weight={4} opacity={0.85} />
        </MapContainer>
      </div>

      {/* Moving Speed Pill matching Screen 10 ("Moving 72 km/h") */}
      <div className="absolute top-[32%] right-10 z-10">
        <div className="bg-[#0b1329] text-white px-3 py-2 rounded-xl shadow-xl border border-white/10 text-center">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Moving</p>
          <p className="text-xs font-black tracking-tight mt-0.5">{speedKmH} km/h</p>
        </div>
      </div>

      {/* Bottom Live Tracking Details Panel matching Screen 10 reference */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] p-5 border-t border-slate-100 max-w-md mx-auto">
        {/* Driver Contact & Info */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img
              src="/images/driver-avatar.png"
              alt={activeDriverName}
              className="w-12 h-12 rounded-full object-cover border-2 border-blue-100 shadow-xs"
            />
            <div>
              <h2 className="text-sm font-bold text-slate-900">{activeDriverName}</h2>
              <p className="text-xs text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                <span className="text-amber-500">★ 4.8</span>
                <span className="text-slate-400 font-normal">(120 trips)</span>
              </p>
            </div>
          </div>

          {/* Call and Message buttons */}
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
        </div>

        {/* Vehicle Registration & Details */}
        <div className="py-2.5 border-b border-slate-100">
          <p className="text-[10px] text-slate-400 font-semibold">Vehicle: <span className="text-slate-700 font-bold">{activeVehicleType}</span></p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-black text-slate-900 tracking-wider bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {activePlate}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-xs text-slate-600 font-semibold">{activeCapacity}</span>
          </div>
        </div>

        {/* ETA and Remaining Distance matching Screen 10 */}
        <div className="pt-2.5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-semibold">Estimated Arrival</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5">{etaString}</p>
            <div className="mt-1">
              <span className="text-[10px] text-slate-400 font-semibold">Remaining Distance: </span>
              <span className="text-xs font-extrabold text-[#1e60ff]">{remainingKm} km</span>
            </div>
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
