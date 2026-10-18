import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Crosshair, ArrowRight, X, Search } from "lucide-react";
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

interface SuggestionItem {
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  isCustomFallback?: boolean;
}

interface SelectDropLocationScreenProps {
  onBack: () => void;
  onConfirm: (address: string, coords: { lat: number; lng: number }, distanceKm: number, durationStr: string | null) => void;
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

function DropMapController({
  pickupCoords,
  dropCoords,
}: {
  pickupCoords: { lat: number; lng: number };
  dropCoords: { lat: number; lng: number } | null;
}) {
  const map = useMapEvents({});
  useEffect(() => {
    if (!dropCoords) {
      map.setView([pickupCoords.lat, pickupCoords.lng], 13);
      return;
    }
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
  pickupAddress = "sai deekshitha apartment, 7, 165/3, Vinayak Nagar, Hyderabad",
  initialDropAddress = ""
}: SelectDropLocationScreenProps) {
  const [searchQuery, setSearchQuery] = useState(initialDropAddress);
  const [selectedAddress, setSelectedAddress] = useState(initialDropAddress);
  const [dropCoords, setDropCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationStr, setDurationStr] = useState<string | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Real-time suggestions search matching Google Maps style (RESTRICTED TO INDIA ONLY)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed === selectedAddress) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    // Cancel previous in-flight autocomplete requests
    searchAbortRef.current?.abort();
    const searchController = new AbortController();
    searchAbortRef.current = searchController;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results: SuggestionItem[] = [];
        const seen = new Set<string>();

        // 1. Primary: Photon API with explicit India queries & strict country filter
        // First try `${trimmed} India`, then `${trimmed}`
        const photonQueries = [trimmed.toLowerCase().includes("india") ? trimmed : `${trimmed} India`, trimmed];
        for (const pQuery of photonQueries) {
          if (searchController.signal.aborted) return;
          try {
            const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(pQuery)}&limit=15`;
            const pResp = await fetch(photonUrl, { signal: searchController.signal });
            if (pResp.ok) {
              const pData = await pResp.json();
              if (Array.isArray(pData.features)) {
                for (const f of pData.features) {
                  const props = f.properties || {};
                  const countryCode = (props.countrycode || "").toUpperCase();
                  const countryName = (props.country || "").toLowerCase();

                  // STRICT INDIA RESTRICTION: Reject UK, Germany, Canada, US, etc.
                  if (countryCode !== "IN" && countryName !== "india") {
                    continue;
                  }

                  const name = props.name || props.street || props.city || "";
                  const state = props.state || "";
                  const city = props.city || props.district || "";
                  const localityParts = [props.street, city, state, "India"].filter(Boolean).filter((p) => p !== name);
                  const subtitle = localityParts.length > 0 ? localityParts.join(", ") : "India";
                  const coords = f.geometry?.coordinates;
                  const key = `${name}-${subtitle}`.toLowerCase();

                  if (name && Array.isArray(coords) && coords.length >= 2 && !seen.has(key)) {
                    seen.add(key);
                    results.push({
                      title: name,
                      subtitle: subtitle,
                      lat: coords[1],
                      lng: coords[0],
                    });
                  }
                }
              }
            }
          } catch (e: any) {
            if (e?.name !== "AbortError") console.warn("Photon autocomplete error:", e);
          }
          if (results.length >= 6) break;
        }

        // 2. Secondary fallback: Nominatim with strict countrycodes=in for colleges, schools, local villages
        if (results.length < 5 && !searchController.signal.aborted) {
          try {
            const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              trimmed
            )}&format=json&addressdetails=1&limit=8&countrycodes=in`;
            const nResp = await fetch(nomUrl, {
              headers: { "Accept-Language": "en" },
              signal: searchController.signal,
            });
            if (nResp.ok) {
              const nData = await nResp.json();
              if (Array.isArray(nData)) {
                for (const item of nData) {
                  const addr = item.address || {};
                  const countryCode = (addr.country_code || "").toUpperCase();
                  if (countryCode && countryCode !== "IN") {
                    continue; // Skip any non-Indian result
                  }

                  const parts = (item.display_name || "").split(",");
                  const title = item.name || parts[0]?.trim() || trimmed;
                  const locList = [
                    addr.suburb || addr.neighbourhood || addr.residential,
                    addr.city || addr.town || addr.village || addr.state_district,
                    addr.state,
                    "India"
                  ].filter(Boolean).filter((p) => p !== title);
                  const subtitle = locList.length > 0 ? locList.join(", ") : parts.slice(1, 4).map((s: string) => s.trim()).join(", ");
                  const key = `${title}-${subtitle}`.toLowerCase();

                  if (!seen.has(key) && item.lat && item.lon) {
                    seen.add(key);
                    results.push({
                      title,
                      subtitle,
                      lat: parseFloat(item.lat),
                      lng: parseFloat(item.lon),
                    });
                  }
                }
              }
            }
          } catch (e: any) {
            if (e?.name !== "AbortError") console.warn("Nominatim search error:", e);
          }
        }

        if (!searchController.signal.aborted) {
          setSuggestions(results);
          setShowDropdown(true);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") console.warn("Autocomplete error:", err);
      } finally {
        if (!searchController.signal.aborted) setIsSearching(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      searchController.abort();
    };
  }, [searchQuery, selectedAddress]);

  // Explicit immediate search when user clicks Search button or presses Enter
  const triggerSearchNow = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    searchAbortRef.current?.abort();
    const searchController = new AbortController();
    searchAbortRef.current = searchController;

    setIsSearching(true);
    setShowDropdown(true);
    try {
      const results: SuggestionItem[] = [];
      const seen = new Set<string>();

      const photonQueries = [trimmed.toLowerCase().includes("india") ? trimmed : `${trimmed} India`, trimmed];
      for (const pQuery of photonQueries) {
        if (searchController.signal.aborted) return;
        try {
          const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(pQuery)}&limit=15`;
          const pResp = await fetch(photonUrl, { signal: searchController.signal });
          if (pResp.ok) {
            const pData = await pResp.json();
            if (Array.isArray(pData.features)) {
              for (const f of pData.features) {
                const props = f.properties || {};
                const countryCode = (props.countrycode || "").toUpperCase();
                const countryName = (props.country || "").toLowerCase();
                if (countryCode !== "IN" && countryName !== "india") continue;

                const name = props.name || props.street || props.city || "";
                const state = props.state || "";
                const city = props.city || props.district || "";
                const localityParts = [props.street, city, state, "India"].filter(Boolean).filter((p) => p !== name);
                const subtitle = localityParts.length > 0 ? localityParts.join(", ") : "India";
                const coords = f.geometry?.coordinates;
                const key = `${name}-${subtitle}`.toLowerCase();

                if (name && Array.isArray(coords) && coords.length >= 2 && !seen.has(key)) {
                  seen.add(key);
                  results.push({
                    title: name,
                    subtitle: subtitle,
                    lat: coords[1],
                    lng: coords[0],
                  });
                }
              }
            }
          }
        } catch (e: any) {
          if (e?.name !== "AbortError") console.warn("Photon search error:", e);
        }
        if (results.length >= 6) break;
      }

      if (results.length < 5 && !searchController.signal.aborted) {
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            trimmed
          )}&format=json&addressdetails=1&limit=8&countrycodes=in`;
          const nResp = await fetch(nomUrl, {
            headers: { "Accept-Language": "en" },
            signal: searchController.signal,
          });
          if (nResp.ok) {
            const nData = await nResp.json();
            if (Array.isArray(nData)) {
              for (const item of nData) {
                const addr = item.address || {};
                const countryCode = (addr.country_code || "").toUpperCase();
                if (countryCode && countryCode !== "IN") continue;

                const parts = (item.display_name || "").split(",");
                const title = item.name || parts[0]?.trim() || trimmed;
                const locList = [
                  addr.suburb || addr.neighbourhood || addr.residential,
                  addr.city || addr.town || addr.village || addr.state_district,
                  addr.state,
                  "India"
                ].filter(Boolean).filter((p) => p !== title);
                const subtitle = locList.length > 0 ? locList.join(", ") : parts.slice(1, 4).map((s: string) => s.trim()).join(", ");
                const key = `${title}-${subtitle}`.toLowerCase();

                if (!seen.has(key) && item.lat && item.lon) {
                  seen.add(key);
                  results.push({
                    title,
                    subtitle,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                  });
                }
              }
            }
          }
        } catch (e: any) {
          if (e?.name !== "AbortError") console.warn("Nominatim search error:", e);
        }
      }

      if (!searchController.signal.aborted) {
        setSuggestions(results);
        setShowDropdown(true);
        // If there's an exact or top match, automatically pick it to make moving forward instantaneous
        if (results.length > 0 && results[0]) {
          handleSelectSuggestion(results[0]);
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") console.warn("Autocomplete error:", err);
    } finally {
      if (!searchController.signal.aborted) setIsSearching(false);
    }
  };

  const calculateActualRoute = async (destLat: number, destLng: number) => {
    // Check identical locations
    if (Math.abs(destLat - pickupCoords.lat) < 0.0001 && Math.abs(destLng - pickupCoords.lng) < 0.0001) {
      setRouteError("Pickup and Drop locations cannot be identical. Please choose a different destination.");
      return;
    }

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsCalculating(true);
    setRouteError(null);
    setRoutePolyline([]); // Clear stale route while fetching
    setDistanceKm(null);
    setDurationStr(null);
    try {
      const res = await api.calculateRoute({
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        destination_lat: destLat,
        destination_lng: destLng,
      });

      // Discard if this request was superseded by a newer one
      if (controller.signal.aborted) return;

      if (res && res.distance_km) {
        const rawDist = Number(res.distance_km);
        if (!isFinite(rawDist) || rawDist <= 0) {
          setRouteError("Routing returned an invalid distance. Please choose reachable road points.");
          return;
        }
        const dist = Math.round(rawDist);
        setDistanceKm(dist);
        const mins = Number(res.estimated_duration_minutes || 1);
        if (!isFinite(mins) || mins <= 0) {
          setDurationStr(null);
        } else {
          const hrs = Math.floor(mins / 60);
          const remMins = mins % 60;
          setDurationStr(hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`);
        }
        if (Array.isArray(res.waypoints) && res.waypoints.length >= 2) {
          setRoutePolyline(res.waypoints as [number, number][]);
        } else {
          setRoutePolyline([]);
        }
      } else {
        setRouteError("Routing returned no distance. Please choose reachable road points.");
      }
    } catch (err: any) {
      if (controller.signal.aborted) return;
      const msg = err?.message || "Unable to calculate a driving route for the selected destination.";
      setRouteError(
        msg.includes("502") || msg.includes("Bad Gateway")
          ? "No drivable road route found between these locations. Please pick a different destination."
          : "Route calculation failed. Please try again or select a different destination."
      );
      setRoutePolyline([]);
      setDistanceKm(null);
      setDurationStr(null);
    } finally {
      if (!controller.signal.aborted) setIsCalculating(false);
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

  const handleSelectSuggestion = (item: SuggestionItem) => {
    const fullText = item.subtitle && !item.isCustomFallback ? `${item.title}, ${item.subtitle}` : item.title;
    setSelectedAddress(fullText);
    setSearchQuery(fullText);
    setDropCoords({ lat: item.lat, lng: item.lng });
    setShowDropdown(false);
    calculateActualRoute(item.lat, item.lng);
  };

  return (
    <div className="relative h-full w-full bg-slate-50 flex flex-col justify-between overflow-hidden">
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

      {/* Floating Pickup & Drop Card (Reference Architecture) */}
      <div className="absolute top-14 left-3 right-3 z-30 pointer-events-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-3">
          {/* Pickup Readonly Row */}
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50/70 border border-slate-100 mb-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <span className="text-xs font-bold">↑</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pickup</p>
              <p className="text-xs font-bold text-slate-800 truncate">{pickupAddress || "Pickup location set"}</p>
            </div>
          </div>

          {/* Destination Search Input Row */}
          <div className="flex items-center gap-2 relative">
            <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
              <span className="text-xs font-bold">↓</span>
            </div>
            <div className="flex-1 flex items-center bg-slate-50 rounded-xl border border-blue-500/40 px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500/20">
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    triggerSearchNow();
                  }
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
                placeholder="Search drop location or area..."
                className="w-full bg-transparent text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none px-1"
              />
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0 mx-1" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    setSuggestions([]);
                    setShowDropdown(false);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full mr-1"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}

              {/* Explicit Search Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerSearchNow();
                }}
                className="bg-[#1e60ff] hover:bg-[#164ed9] text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm shrink-0 active:scale-95 transition-all"
                title="Search location"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
            </div>
          </div>
        </div>

        {/* Suggestion Dropdown matching Reference Screenshot (India places only) */}
        {showDropdown && (
          <div className="mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-xs max-h-80 overflow-y-auto">
            {suggestions.length > 0 ? (
              suggestions.map((item, i) => (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(item);
                  }}
                  onClick={() => handleSelectSuggestion(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectSuggestion(item);
                    }
                  }}
                  className="px-4 py-3 hover:bg-slate-50 active:bg-blue-50 cursor-pointer text-slate-700 border-b border-slate-100 last:border-0 transition-colors focus:bg-blue-50 focus:outline-none"
                >
                  <p className="font-extrabold text-slate-900 truncate text-[13px] leading-snug">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">{item.subtitle}</p>
                  )}
                </div>
              ))
            ) : !isSearching && searchQuery.trim().length >= 2 ? (
              <div className="px-4 py-4 text-center text-slate-500">
                <p className="font-bold text-slate-700">No matching locations found in India</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Please check spelling or type a city, district, village, or pincode</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Leaflet Map with Route Polyline & Pin Drop Interaction */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[pickupCoords.lat, pickupCoords.lng]}
          zoom={12}
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DropMapController pickupCoords={pickupCoords} dropCoords={dropCoords} />
          <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon} />
          {dropCoords && <Marker position={[dropCoords.lat, dropCoords.lng]} icon={dropIcon} />}
          <DropMapEvents
            onSelectCoords={async (lat, lng) => {
              setDropCoords({ lat, lng });
              await reverseGeocodeDrop(lat, lng);
              calculateActualRoute(lat, lng);
            }}
          />
          {routePolyline.length > 0 && (
            <Polyline
              positions={routePolyline}
              color="#1e60ff"
              weight={4}
              opacity={0.85}
            />
          )}
        </MapContainer>
      </div>

      {/* Route info badge */}
      {(isCalculating || distanceKm !== null) && (
        <div className="absolute top-[42%] right-4 z-10">
          <div className="bg-[#0b1329] text-white px-3 py-2 rounded-xl shadow-xl border border-white/10 text-center">
            {isCalculating ? (
              <>
                <p className="text-xs font-bold leading-tight animate-pulse">Calculating...</p>
                <p className="text-[10px] text-slate-300 font-medium mt-0.5">Road route</p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold leading-tight">{distanceKm} km</p>
                <p className="text-[10px] text-slate-300 font-medium mt-0.5">{durationStr}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Route error message */}
      {routeError && !isCalculating && (
        <div className="absolute top-[42%] left-4 right-4 z-10">
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl shadow text-[10px] font-semibold text-center">
            ⚠️ {routeError}
          </div>
        </div>
      )}

      {/* Center to pickup control */}
      <div className="absolute bottom-36 right-4 z-20">
        <button
          onClick={() => {
            if (dropCoords) {
              calculateActualRoute(dropCoords.lat, dropCoords.lng);
            }
          }}
          className="p-3 rounded-full bg-white shadow-lg border border-slate-200 text-slate-700 hover:text-[#1e60ff] transition-all"
        >
          <Crosshair className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Confirmation Card */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] p-5 pb-[max(env(safe-area-inset-bottom,20px),20px)] border-t border-slate-100">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Selected Drop Location</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
              {selectedAddress || "Search or tap on the map to set drop location"}
            </p>
          </div>
        </div>

        <button
          disabled={!dropCoords || distanceKm === null || isCalculating}
          onClick={() => {
            if (dropCoords) {
              onConfirm(selectedAddress, dropCoords, distanceKm ?? 0, durationStr ?? "N/A");
            }
          }}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
            dropCoords && distanceKm !== null && !isCalculating
              ? "bg-[#1e60ff] hover:bg-[#164ed9] active:scale-[0.98] text-white shadow-blue-500/25"
              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
          }`}
        >
          <span>
            {isCalculating
              ? "Calculating route..."
              : !dropCoords
              ? "Search or tap destination"
              : distanceKm === null
              ? "Route unavailable"
              : "Confirm Destination"}
          </span>
          {!isCalculating && dropCoords && distanceKm !== null && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
