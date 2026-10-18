import { useState, useEffect } from "react";
import { ArrowLeft, Plus, MapPin, X } from "lucide-react";

interface PickupDropSearchScreenProps {
  onBack: () => void;
  pickupAddress: string;
  dropAddress: string;
  onChangePickupAddress: (addr: string) => void;
  onChangeDropAddress: (addr: string) => void;
  onContinue: () => void;
  onSelectSuggestion?: (address: string, coords?: { lat: number; lng: number }) => void;
}

export default function PickupDropSearchScreen({
  onBack,
  pickupAddress,
  dropAddress,
  onChangePickupAddress,
  onChangeDropAddress,
  onContinue,
  onSelectSuggestion,
}: PickupDropSearchScreenProps) {
  const [activeField, setActiveField] = useState<"pickup" | "drop">("drop");
  const [query, setQuery] = useState(dropAddress || "");
  const [suggestions, setSuggestions] = useState<Array<{ title: string; subtitle: string; lat: number; lng: number }>>([]);

  // Curated Recent Indian Locations matching Screen 3 in reference image
  const recentLocations = [
    { title: "Vijayawada", subtitle: "Andhra Pradesh, India", lat: 16.5062, lng: 80.6480 },
    { title: "Vijayapura", subtitle: "Karnataka, India", lat: 16.8302, lng: 75.7100 },
    { title: "Vijayawada bus stand", subtitle: "PN Bus Stand Road, Arrival Block, Pandit Nehru...", lat: 16.5165, lng: 80.6288 },
    { title: "Vijaya Nagar Colony", subtitle: "Hyderabad, Telangana, India", lat: 17.3916, lng: 78.4552 },
    { title: "Vijayanagar", subtitle: "Bengaluru, Karnataka, India", lat: 12.9698, lng: 77.5360 },
  ];

  // Dynamic search with India bias & live Photon/OSM geocoding
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=6`
        );
        const data = await res.json();
        if (data && data.features) {
          const mapped = data.features
            .filter((f: any) => {
              const country = f.properties.country || "";
              return country.toLowerCase().includes("india") || !country;
            })
            .map((f: any) => {
              const p = f.properties;
              const title = p.name || p.city || p.district || trimmed;
              const subtitleParts = [p.district, p.state, p.country || "India"].filter(Boolean);
              return {
                title,
                subtitle: subtitleParts.join(", "),
                lat: f.geometry.coordinates[1],
                lng: f.geometry.coordinates[0],
              };
            });
          setSuggestions(mapped);
        }
      } catch (err) {
        console.warn("Location autocomplete error:", err);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectPlace = (place: { title: string; subtitle: string; lat: number; lng: number }) => {
    const fullText = `${place.title}, ${place.subtitle}`;
    if (activeField === "drop") {
      onChangeDropAddress(fullText);
      setQuery(place.title);
    } else {
      onChangePickupAddress(fullText);
    }
    onSelectSuggestion?.(fullText, { lat: place.lat, lng: place.lng });
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

        {/* Input Card with Green Pickup & Red Drop indicators */}
        <div className="p-4 space-y-3">
          <div className="bg-[#f8fafc] rounded-2xl p-3 border border-slate-200/80 space-y-2.5">
            {/* Pickup Field */}
            <div
              onClick={() => setActiveField("pickup")}
              className={`flex items-center gap-3 p-2 rounded-xl transition-all ${
                activeField === "pickup" ? "bg-white shadow-2xs border border-blue-200" : ""
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <span className="text-xs font-black">↑</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pickup from</p>
                <input
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => onChangePickupAddress(e.target.value)}
                  onFocus={() => setActiveField("pickup")}
                  placeholder="Enter pickup address"
                  className="w-full text-xs font-bold text-slate-800 bg-transparent outline-none truncate"
                />
              </div>
            </div>

            {/* Drop Field with Clear & Plus Button */}
            <div
              onClick={() => setActiveField("drop")}
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
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      onChangeDropAddress(e.target.value);
                    }}
                    onFocus={() => setActiveField("drop")}
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
                onClick={() => alert("Multi-stop linehaul routing enabled for enterprise accounts.")}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0"
                title="Add multiple stops"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Location List: Live Search Results OR Recent Locations matching Screen 3 */}
        <div className="px-4">
          <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
            {suggestions.length > 0 ? "Suggestions" : "Recent Locations"}
          </p>

          <div className="divide-y divide-slate-100">
            {(suggestions.length > 0 ? suggestions : recentLocations).map((loc, idx) => (
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
            ))}
          </div>
        </div>
      </div>

      {/* Prominent Sticky Continue Button matching Screen 3 */}
      <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0 z-20">
        <button
          onClick={onContinue}
          className="w-full bg-[#0866F5] hover:bg-[#0652c5] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/25 transition-all flex items-center justify-center"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
