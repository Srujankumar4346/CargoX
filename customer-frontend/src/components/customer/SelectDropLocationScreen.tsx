import { useState, useEffect } from "react";
import { ArrowLeft, Search, Crosshair, ArrowRight, X } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { api } from "../../services/api";

const pickupIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [22, 36],
  iconAnchor: [11, 36],
});

// Red Destination Icon
const dropIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface SelectDropLocationScreenProps {
  onBack: () => void;
  onConfirm: (address: string, coords: { lat: number; lng: number }, distanceKm: number, durationStr: string) => void;
  pickupCoords?: { lat: number; lng: number };
  pickupAddress?: string;
  initialDropAddress?: string;
}

function DropMapEvents({ onSelectCoords }: { onSelectCoords: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelectCoords(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function DropMapController({ pickupCoords, dropCoords }: { pickupCoords: { lat: number; lng: number }; dropCoords: { lat: number; lng: number } }) {
  const map = useMapEvents({});
  useEffect(() => {
    const bounds = L.latLngBounds(
      [pickupCoords.lat, pickupCoords.lng],
      [dropCoords.lat, dropCoords.lng]
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }, [pickupCoords, dropCoords, map]);
  return null;
}

export default function SelectDropLocationScreen({
  onBack,
  onConfirm,
  pickupCoords = { lat: 17.5375, lng: 78.4735 }, // Hyderabad
  initialDropAddress = "Vijayawada, Andhra Pradesh" // Screen 4 destination
}: SelectDropLocationScreenProps) {
  const [searchQuery, setSearchQuery] = useState(initialDropAddress);
  const [selectedAddress, setSelectedAddress] = useState(initialDropAddress);
  const [dropCoords, setDropCoords] = useState({ lat: 16.5062, lng: 80.6480 }); // Vijayawada
  const [distanceKm, setDistanceKm] = useState(275);
  const [durationStr, setDurationStr] = useState("5h 20m");
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([
    [pickupCoords.lat, pickupCoords.lng],
    [17.3850, 78.4867],
    [17.1500, 79.2000],
    [16.8500, 79.8000],
    [16.6500, 80.3000],
    [16.5062, 80.6480]
  ]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const destinations = [
    { name: "Vijayawada, Andhra Pradesh", lat: 16.5062, lng: 80.6480 },
    { name: "Warangal, Telangana", lat: 17.9689, lng: 79.5941 },
    { name: "Khammam, Telangana", lat: 17.2473, lng: 80.1514 },
    { name: "Guntur, Andhra Pradesh", lat: 16.3067, lng: 80.4365 },
    { name: "Pune, Maharashtra", lat: 18.5204, lng: 73.8567 },
    { name: "Bengaluru, Karnataka", lat: 12.9716, lng: 77.5946 },
    { name: "Chennai, Tamil Nadu", lat: 13.0827, lng: 80.2707 }
  ];

  // Debounced search for destination addresses
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 3 || searchQuery === selectedAddress) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=5&countrycodes=in`,
          { headers: { "Accept-Language": "en" } }
        );
        if (resp.ok) {
          const data = await resp.json();
          setSearchResults(data);
          setShowDropdown(true);
        }
      } catch (err) {
        console.warn("Destination search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedAddress]);

  const calculateActualRoute = async (destLat: number, destLng: number) => {
    // Check identical locations
    if (Math.abs(destLat - pickupCoords.lat) < 0.0001 && Math.abs(destLng - pickupCoords.lng) < 0.0001) {
      alert("Pickup and Drop locations cannot be identical. Please choose a different destination.");
      return;
    }

    setIsCalculating(true);
    try {
      const res = await api.calculateRoute({
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        destination_lat: destLat,
        destination_lng: destLng,
      });
      if (res && res.distance_km) {
        const dist = Math.round(Number(res.distance_km));
        setDistanceKm(dist);
        const mins = Number(res.estimated_duration_minutes || 60);
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        setDurationStr(hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`);
        if (Array.isArray(res.waypoints) && res.waypoints.length > 1) {
          setRoutePolyline(res.waypoints as [number, number][]);
        } else {
          setRoutePolyline([
            [pickupCoords.lat, pickupCoords.lng],
            [destLat, destLng]
          ]);
        }
      }
    } catch {
      // Haversine fallback
      const dLat = (destLat - pickupCoords.lat) * (Math.PI / 180);
      const dLon = (destLng - pickupCoords.lng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(pickupCoords.lat * (Math.PI / 180)) *
          Math.cos(destLat * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const approxRoadKm = Math.round(6371 * c * 1.25);
      setDistanceKm(Math.max(10, approxRoadKm));
      setRoutePolyline([
        [pickupCoords.lat, pickupCoords.lng],
        [destLat, destLng]
      ]);
    } finally {
      setIsCalculating(false);
    }
  };

  const reverseGeocodeDrop = async (lat: number, lng: number) => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (resp.ok) {
        const data = await resp.json();
        const formatted = data.display_name || `Pinned Destination (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        setSelectedAddress(formatted);
        setSearchQuery(formatted);
        return;
      }
    } catch {}
    const fallback = `Pinned Destination (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    setSelectedAddress(fallback);
    setSearchQuery(fallback);
  };

  const handleSelectSearchResult = (res: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(res.lat);
    const lng = parseFloat(res.lon);
    setSelectedAddress(res.display_name);
    setSearchQuery(res.display_name);
    setDropCoords({ lat, lng });
    setShowDropdown(false);
    calculateActualRoute(lat, lng);
  };

  const handleSelectDest = (dest: typeof destinations[0]) => {
    setSelectedAddress(dest.name);
    setSearchQuery(dest.name);
    setDropCoords({ lat: dest.lat, lng: dest.lng });
    setShowDropdown(false);
    calculateActualRoute(dest.lat, dest.lng);
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-50 flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-100 shadow-xs">
        <button
          onClick={onBack}
          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900">Select Drop Location</h1>
        <div className="w-6" />
      </div>

      {/* Floating Search Bar with Live Typing Autocomplete */}
      <div className="absolute top-16 left-4 right-4 z-20">
        <div className="relative flex items-center bg-white rounded-2xl shadow-lg border border-slate-200 p-1">
          <div className="pl-3 text-slate-400">
            <Search className={`w-4 h-4 ${isSearching ? "animate-pulse text-[#1e60ff]" : ""}`} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Type destination address, city or pin on map..."
            className="w-full bg-transparent px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Suggestion Dropdown */}
        {showDropdown && (
          <div className="mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-xs max-h-64 overflow-y-auto">
            {searchResults.length > 0 ? (
              searchResults.map((res, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectSearchResult(res)}
                  className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-slate-700 font-medium border-b border-slate-50 last:border-0 flex items-start gap-2"
                >
                  <Search className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{res.display_name}</span>
                </div>
              ))
            ) : (
              destinations.map((dest, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectDest(dest)}
                  className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-slate-700 font-medium border-b border-slate-50 last:border-0 flex justify-between items-center"
                >
                  <span>{dest.name}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Select Destination</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Leaflet Map with Route Polyline & Pin Drop Interaction */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[16.95, 79.55]}
          zoom={8}
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DropMapController pickupCoords={pickupCoords} dropCoords={dropCoords} />
          <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon} />
          <Marker position={[dropCoords.lat, dropCoords.lng]} icon={dropIcon} />
          <DropMapEvents
            onSelectCoords={async (lat, lng) => {
              setDropCoords({ lat, lng });
              await reverseGeocodeDrop(lat, lng);
              calculateActualRoute(lat, lng);
            }}
          />
          <Polyline
            positions={routePolyline}
            color="#1e60ff"
            weight={4}
            opacity={0.85}
          />
        </MapContainer>
      </div>

      {/* Route Badge pill matching Screen 4 reference ("275 km | 5h 20m") */}
      <div className="absolute top-[36%] right-8 z-10">
        <div className="bg-[#0b1329] text-white px-3 py-2 rounded-xl shadow-xl border border-white/10 text-center">
          <p className="text-xs font-bold leading-tight">{isCalculating ? "Calculating..." : `${distanceKm} km`}</p>
          <p className="text-[10px] text-slate-300 font-medium mt-0.5">{isCalculating ? "Please wait" : durationStr}</p>
        </div>
      </div>

      {/* Relocate control */}
      <div className="absolute bottom-36 right-4 z-20">
        <button
          onClick={() => handleSelectDest(destinations[0])}
          className="p-3 rounded-full bg-white shadow-lg border border-slate-200 text-slate-700 hover:text-[#1e60ff] transition-all"
        >
          <Crosshair className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Confirmation Card matching Screen 4 */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] p-5 border-t border-slate-100">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Selected Drop Location</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">{selectedAddress}</p>
          </div>
        </div>

        <button
          onClick={() => onConfirm(selectedAddress, dropCoords, distanceKm, durationStr)}
          className="w-full bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
        >
          <span>Confirm Destination</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
