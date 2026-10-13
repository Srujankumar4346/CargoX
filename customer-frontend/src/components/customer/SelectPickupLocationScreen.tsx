import { useState, useEffect } from "react";
import { ArrowLeft, Search, Crosshair, ArrowRight } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Leaflet default icon fix
const pickupIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface SelectPickupLocationScreenProps {
  onBack: () => void;
  onConfirm: (address: string, coords: { lat: number; lng: number }) => void;
  initialAddress?: string;
  initialCoords?: { lat: number; lng: number };
}

function LocationPickerEvents({ onSelectCoords }: { onSelectCoords: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelectCoords(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapController({ coords }: { coords: { lat: number; lng: number } }) {
  const map = useMapEvents({
    click() {}
  });
  useEffect(() => {
    map.flyTo([coords.lat, coords.lng], 14, { duration: 1.2 });
  }, [coords.lat, coords.lng, map]);
  return null;
}

export default function SelectPickupLocationScreen({
  onBack,
  onConfirm,
  initialAddress = "St. Martin's Engineering College, Hyderabad, Telangana",
  initialCoords = { lat: 17.5375, lng: 78.4735 }
}: SelectPickupLocationScreenProps) {
  const [searchQuery, setSearchQuery] = useState(initialAddress);
  const [selectedAddress, setSelectedAddress] = useState(initialAddress);
  const [coords, setCoords] = useState(initialCoords);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fallback preset suggestions
  const defaultPresets = [
    { name: "Secunderabad Railway Station, Hyderabad", lat: 17.4399, lng: 78.4983 },
    { name: "Kukatpally Industrial Area, Hyderabad", lat: 17.4849, lng: 78.4138 },
    { name: "Gachibowli Logistics Park, Hyderabad", lat: 17.4401, lng: 78.3489 }
  ];

  // Auto-detect current GPS on screen open if not already set by user
  useEffect(() => {
    if (navigator.geolocation && (!initialAddress || initialAddress.includes("St. Martin's"))) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          await reverseGeocode(lat, lng);
          setIsLocating(false);
        },
        () => {
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // Debounced live location search using Nominatim
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
        console.warn("Location search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedAddress]);

  // Reverse geocoding when user clicks/pins anywhere on the map
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (resp.ok) {
        const data = await resp.json();
        const formatted = data.display_name || `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        setSelectedAddress(formatted);
        setSearchQuery(formatted);
        return;
      }
    } catch {
      // Fallback
    }
    const fallback = `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    setSelectedAddress(fallback);
    setSearchQuery(fallback);
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          await reverseGeocode(lat, lng);
          setIsLocating(false);
        },
        (_err) => {
          setIsLocating(false);
          alert("Location permission denied or unavailable. Please pick a location manually or pin on map.");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleSelectResult = (res: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(res.lat);
    const lng = parseFloat(res.lon);
    setSelectedAddress(res.display_name);
    setSearchQuery(res.display_name);
    setCoords({ lat, lng });
    setShowDropdown(false);
  };

  const handleSelectPreset = (preset: typeof defaultPresets[0]) => {
    setSelectedAddress(preset.name);
    setSearchQuery(preset.name);
    setCoords({ lat: preset.lat, lng: preset.lng });
    setShowDropdown(false);
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
        <h1 className="text-base font-bold text-slate-900">Select Pickup Location</h1>
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
            placeholder="Type pickup address or landmark..."
            className="w-full bg-transparent px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl mr-1 text-xs font-bold"
            >
              ✕
            </button>
          )}
          <button
            onClick={handleGetCurrentLocation}
            title="Detect GPS Current Location"
            className="p-2 text-slate-500 hover:text-[#1e60ff] bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"
          >
            <Crosshair className={`w-4 h-4 ${isLocating ? "animate-spin text-[#1e60ff]" : ""}`} />
          </button>
        </div>

        {/* Suggestion & Search Dropdown */}
        {showDropdown && (
          <div className="mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-xs max-h-64 overflow-y-auto">
            {/* Quick Action: Use Current Location */}
            <div
              onClick={() => {
                handleGetCurrentLocation();
                setShowDropdown(false);
              }}
              className="px-4 py-2.5 bg-blue-50/70 hover:bg-blue-100/70 cursor-pointer text-[#1e60ff] font-bold border-b border-blue-100 flex items-center gap-2"
            >
              <Crosshair className="w-4 h-4 shrink-0" />
              <span>Use Current Device Location</span>
            </div>

            {/* Live Search Results */}
            {searchResults.length > 0 ? (
              searchResults.map((res, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectResult(res)}
                  className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-slate-700 font-medium border-b border-slate-50 last:border-0 flex items-start gap-2"
                >
                  <Search className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{res.display_name}</span>
                </div>
              ))
            ) : searchQuery.length < 3 ? (
              defaultPresets.map((preset, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectPreset(preset)}
                  className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-slate-700 font-medium border-b border-slate-50 last:border-0 flex items-center justify-between"
                >
                  <span className="truncate">{preset.name}</span>
                  <span className="text-[10px] text-slate-400 font-semibold shrink-0 ml-2">Preset</span>
                </div>
              ))
            ) : null}
          </div>
        )}
      </div>

      {/* Leaflet Map filling background */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[coords.lat, coords.lng]}
          zoom={14}
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController coords={coords} />
          <Marker position={[coords.lat, coords.lng]} icon={pickupIcon} />
          <LocationPickerEvents
            onSelectCoords={async (lat, lng) => {
              setCoords({ lat, lng });
              await reverseGeocode(lat, lng);
            }}
          />
        </MapContainer>
      </div>

      {/* Center floating pin card matching Screen 3 reference */}
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-blue-100/60 p-3 max-w-[260px] text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#1e60ff]">Current Location</p>
          <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">{selectedAddress}</p>
        </div>
      </div>

      {/* Map Control: GPS Relocate Button */}
      <div className="absolute bottom-36 right-4 z-20">
        <button
          onClick={handleGetCurrentLocation}
          className={`p-3 rounded-full bg-white shadow-lg border border-slate-200 text-slate-700 hover:text-[#1e60ff] transition-all ${
            isLocating ? "animate-spin text-[#1e60ff]" : ""
          }`}
          title="Use current GPS location"
        >
          <Crosshair className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Confirmation Card matching Screen 3 */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] p-5 border-t border-slate-100">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-[#1e60ff] flex items-center justify-center shrink-0 mt-0.5">
            <div className="w-3.5 h-3.5 rounded-full bg-[#1e60ff]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Selected Pickup Location</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">{selectedAddress}</p>
          </div>
        </div>

        <button
          onClick={() => onConfirm(selectedAddress, coords)}
          className="w-full bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
        >
          <span>Confirm Pickup</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
