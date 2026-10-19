import { useState, useEffect } from "react";
import { ArrowLeft, Plus, MapPin, X, Map, Crosshair, Loader2, AlertCircle } from "lucide-react";

interface PickupDropSearchScreenProps {
  onBack: () => void;
  pickupAddress: string;
  dropAddress: string;
  onChangePickupAddress: (addr: string) => void;
  onChangeDropAddress: (addr: string) => void;
  onContinue: () => void;
  onSelectSuggestion?: (address: string, coords?: { lat: number; lng: number }) => void;
  onSelectPickupSuggestion?: (address: string, coords?: { lat: number; lng: number }) => void;
  onChooseOnMap?: () => void;
  onUseCurrentLocation?: () => void;
  isDetectingLocation?: boolean;
}

export default function PickupDropSearchScreen({
  onBack,
  pickupAddress,
  dropAddress,
  onChangePickupAddress,
  onChangeDropAddress,
  onContinue,
  onSelectSuggestion,
  onSelectPickupSuggestion,
  onChooseOnMap,
  onUseCurrentLocation,
  isDetectingLocation = false,
}: PickupDropSearchScreenProps) {
  const [activeField, setActiveField] = useState<"pickup" | "drop">("drop");
  const [query, setQuery] = useState(dropAddress || "");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; subtitle: string; lat: number; lng: number }>>([]);
  const [recentLocations] = useState<Array<{ title: string; subtitle: string; lat: number; lng: number }>>(() => {
    try {
      const saved = localStorage.getItem("cargox_recent_locations");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Dynamic search with India geo-bias, smart deduplication, and Google Maps-style hierarchical suggestions
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const abortController = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const seenKeys = new Set<string>();
        const mappedList: Array<{ title: string; subtitle: string; lat: number; lng: number }> = [];

        // 1. Fetch Photon with India / Hyderabad coordinate bias (lat=17.3850, lon=78.4867)
        // Fetch up to 25 results from local coordinate bias + countrywide matches
        const searchUrls = [
          `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&lat=17.3850&lon=78.4867&limit=25`,
          `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed + " India")}&limit=25`
        ];

        for (const url of searchUrls) {
          if (mappedList.length >= 25 || abortController.signal.aborted) break;
          try {
            const resp = await fetch(url, { signal: abortController.signal });
            if (resp.ok) {
              const data = await resp.json();
              if (data && Array.isArray(data.features)) {
                for (const f of data.features) {
                  const p = f.properties || {};
                  const code = (p.countrycode || "").toUpperCase();
                  const countryName = (p.country || "").toLowerCase();
                  if (code && code !== "IN" && countryName && !countryName.includes("india")) continue;

                  // Skip railway platform duplicates and low-level stops like "platform 9"
                  if (p.osm_value === "stop" || (p.street && p.street.toLowerCase().startsWith("platform"))) {
                    continue;
                  }

                  const mainTitle = p.name || p.city || p.district || trimmed;
                  const localityOrStreet = p.street || p.locality || p.district || "";
                  const cityOrCounty = p.city || p.county || "";
                  const state = p.state || "";

                  const subtitleParts = [localityOrStreet, cityOrCounty, state, "India"]
                    .filter(Boolean)
                    .filter((x) => x.toLowerCase() !== mainTitle.toLowerCase());
                  const uniqueSubParts = Array.from(new Set(subtitleParts));

                  // Deduplication key
                  const normKey = `${mainTitle}|${localityOrStreet || cityOrCounty}`.toLowerCase().replace(/\s+/g, "");
                  if (!seenKeys.has(normKey)) {
                    seenKeys.add(normKey);
                    mappedList.push({
                      title: mainTitle,
                      subtitle: uniqueSubParts.join(", "),
                      lat: f.geometry?.coordinates?.[1] ?? 17.385,
                      lng: f.geometry?.coordinates?.[0] ?? 78.4867,
                    });
                  }
                  if (mappedList.length >= 25) break;
                }
              }
            }
          } catch (e: any) {
            if (e?.name !== "AbortError") {
              console.warn("Photon lookup error:", e);
            }
          }
        }

        // 2. Safe Nominatim fallback (only if photon produced fewer than 6 results)
        if (mappedList.length < 6 && !abortController.signal.aborted) {
          try {
            const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              trimmed
            )}&format=json&addressdetails=1&limit=10&countrycodes=in`;
            const nResp = await fetch(nomUrl, {
              headers: { "Accept-Language": "en" },
              signal: abortController.signal,
            });
            if (nResp.ok) {
              const nData = await nResp.json();
              if (Array.isArray(nData)) {
                for (const item of nData) {
                  const addr = item.address || {};
                  if (item.type === "stop") continue;

                  const mainTitle = item.name || addr.railway || addr.building || addr.road || addr.city || trimmed;
                  const area = addr.suburb || addr.neighbourhood || addr.road || "";
                  const city = addr.city || addr.town || addr.county || "";
                  const state = addr.state || "";

                  const subtitleParts = [area, city, state, "India"]
                    .filter(Boolean)
                    .filter((x) => x.toLowerCase() !== mainTitle.toLowerCase());
                  const uniqueSubParts = Array.from(new Set(subtitleParts));

                  const normKey = `${mainTitle}|${area || city}`.toLowerCase().replace(/\s+/g, "");
                  if (!seenKeys.has(normKey)) {
                    seenKeys.add(normKey);
                    mappedList.push({
                      title: mainTitle,
                      subtitle: uniqueSubParts.join(", "),
                      lat: parseFloat(item.lat),
                      lng: parseFloat(item.lon),
                    });
                  }
                  if (mappedList.length >= 25) break;
                }
              }
            }
          } catch {
            // Silently ignore if blocked/offline
          }
        }

        // 3. Strictly prioritize Telangana locations first, then all other locations
        const prioritized = [...mappedList].sort((a, b) => {
          const aIsTelangana = a.subtitle.toLowerCase().includes("telangana") || a.title.toLowerCase().includes("telangana");
          const bIsTelangana = b.subtitle.toLowerCase().includes("telangana") || b.title.toLowerCase().includes("telangana");
          if (aIsTelangana && !bIsTelangana) return -1;
          if (!aIsTelangana && bIsTelangana) return 1;
          return 0;
        });

        // Set full list for smooth scrollable suggestions (up to 20 locations)
        setSuggestions(prioritized.slice(0, 20));
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.warn("Location autocomplete error:", err);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [query]);

  // Synchronize query input when switching between pickup and drop
  const handleFieldChange = (field: "pickup" | "drop") => {
    setActiveField(field);
    setValidationMessage(null);
    if (field === "pickup") {
      setQuery(pickupAddress ? pickupAddress.split(",")[0] : "");
    } else {
      setQuery(dropAddress ? dropAddress.split(",")[0] : "");
    }
  };

  const handleSelectPlace = (place: { title: string; subtitle: string; lat: number; lng: number }) => {
    const fullText = `${place.title}, ${place.subtitle}`;
    setValidationMessage(null);
    if (activeField === "drop") {
      onChangeDropAddress(fullText);
      setQuery(place.title);
      onSelectSuggestion?.(fullText, { lat: place.lat, lng: place.lng });
    } else {
      onChangePickupAddress(fullText);
      setQuery(place.title);
      onSelectPickupSuggestion?.(fullText, { lat: place.lat, lng: place.lng });
      // After selecting pickup, seamlessly switch focus to drop
      setActiveField("drop");
      setQuery(dropAddress ? dropAddress.split(",")[0] : "");
    }
    // Save to user history
    try {
      const saved = localStorage.getItem("cargox_recent_locations");
      const list = saved ? JSON.parse(saved) : [];
      const updated = [place, ...list.filter((x: any) => x.title !== place.title)].slice(0, 5);
      localStorage.setItem("cargox_recent_locations", JSON.stringify(updated));
    } catch {}
  };

  return (
    <div className="min-h-full flex-1 bg-white text-slate-900 pb-24 select-none flex flex-col justify-between overflow-y-auto">
      <div>
        {/* Top Header */}
        <div className="px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3 flex items-center gap-3 border-b border-slate-100">
          <button
            onClick={onBack}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-extrabold text-slate-900">Pickup & Drop Location</h1>
        </div>

        {/* Clean In-App CSS Validation Message Banner (No native alert popup) */}
        {validationMessage && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-center gap-2.5 text-amber-900 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="flex-1">{validationMessage}</span>
            <button
              onClick={() => setValidationMessage(null)}
              className="p-1 text-amber-500 hover:text-amber-800 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Card with Green Pickup & Red Drop indicators */}
        <div className="p-4 space-y-3">
          <div className="bg-[#f8fafc] rounded-2xl p-3 border border-slate-200/80 space-y-2.5">
            {/* Pickup Field */}
            <div
              onClick={() => handleFieldChange("pickup")}
              className={`flex items-center gap-3 p-2 rounded-xl transition-all relative ${
                activeField === "pickup" ? "bg-white shadow-2xs border border-blue-200" : ""
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <span className="text-xs font-black">↑</span>
              </div>
              <div className="flex-1 min-w-0 pr-8">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pickup from</p>
                <input
                  type="text"
                  value={activeField === "pickup" ? query : pickupAddress}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    onChangePickupAddress(e.target.value);
                  }}
                  onFocus={() => handleFieldChange("pickup")}
                  placeholder="Enter pickup address"
                  className="w-full text-xs font-bold text-slate-800 bg-transparent outline-none truncate"
                />
              </div>

              {/* Current Location GPS detection button on Pickup field */}
              {onUseCurrentLocation && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUseCurrentLocation();
                  }}
                  disabled={isDetectingLocation}
                  title="Detect current location"
                  aria-label="Detect current location"
                  className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 active:scale-95 text-[#0866F5] flex items-center justify-center transition-all border border-blue-100 shadow-2xs shrink-0 cursor-pointer"
                >
                  {isDetectingLocation ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Crosshair className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Drop Field with Clear & Plus Button */}
            <div
              onClick={() => handleFieldChange("drop")}
              className={`flex items-center gap-3 p-2 rounded-xl transition-all ${
                activeField === "drop" ? "bg-white shadow-2xs border border-blue-200" : ""
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <span className="text-xs font-black">↓</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Drop to</p>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={activeField === "drop" ? query : dropAddress}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      onChangeDropAddress(e.target.value);
                    }}
                    onFocus={() => handleFieldChange("drop")}
                    placeholder="Search destination city or locality..."
                    className="w-full text-xs font-bold text-slate-800 bg-transparent outline-none"
                    autoFocus={activeField === "drop"}
                  />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery("");
                        onChangeDropAddress("");
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Add Stop Button matching Screen 3 */}
              <button
                type="button"
                onClick={() => setValidationMessage("Multi-stop linehaul routing enabled for enterprise accounts.")}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0"
                title="Add multiple stops"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Option: Choose on Map */}
          {onChooseOnMap && (
            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={onChooseOnMap}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 active:scale-95 text-[#0866F5] text-[11px] font-bold border border-blue-200/70 transition-all cursor-pointer shadow-2xs"
              >
                <Map className="w-3.5 h-3.5" />
                <span>Choose on map</span>
              </button>
            </div>
          )}
        </div>

        {/* Location List: Live Search Results OR Recent Locations */}
        <div className="px-4">
          <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
            {suggestions.length > 0 ? "Suggestions" : recentLocations.length > 0 ? "Recent Locations" : "Search Locations"}
          </p>

          <div className="divide-y divide-slate-100">
            {suggestions.length > 0 ? (
              suggestions.map((loc, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectPlace(loc)}
                  role="button"
                  tabIndex={0}
                  className="py-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50 px-2 rounded-xl transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-50 text-slate-500 group-hover:text-[#0866F5] flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 group-hover:text-[#0866F5] transition-colors">
                      {loc.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                      {loc.subtitle}
                    </p>
                  </div>
                </div>
              ))
            ) : recentLocations.length > 0 ? (
              recentLocations.map((loc, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectPlace(loc)}
                  role="button"
                  tabIndex={0}
                  className="py-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50 px-2 rounded-xl transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-50 text-slate-500 group-hover:text-[#0866F5] flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 group-hover:text-[#0866F5] transition-colors">
                      {loc.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                      {loc.subtitle}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400">
                <MapPin className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">Type above to search any city, locality or address</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Search across India with live GPS coordinates</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prominent Sticky Continue Button matching Screen 3 */}
      <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0 z-20">
        <button
          onClick={() => {
            const hasPickup = Boolean(pickupAddress?.trim());
            const hasDrop = Boolean(dropAddress?.trim() || query?.trim());
            if (!hasPickup) {
              handleFieldChange("pickup");
              setValidationMessage("Please enter a pickup location to continue.");
              return;
            }
            if (!hasDrop) {
              handleFieldChange("drop");
              setValidationMessage("Please enter or select a destination drop location to continue.");
              return;
            }
            onContinue();
          }}
          disabled={!dropAddress?.trim() && !query?.trim()}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm transition-all flex items-center justify-center ${
            dropAddress?.trim() || query?.trim()
              ? "bg-[#0866F5] hover:bg-[#0652c5] text-white shadow-md shadow-blue-500/25 active:scale-[0.98] cursor-pointer"
              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
          }`}
        >
          {dropAddress?.trim() || query?.trim() ? "Continue" : "Enter Drop Location"}
        </button>
      </div>
    </div>
  );
}
