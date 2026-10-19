import { useState } from "react";
import { ArrowLeft, Maximize2, User, Phone, CheckSquare } from "lucide-react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";

const dropMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapDropRecipientScreenProps {
  onBack: () => void;
  dropAddress: string;
  dropCoords: { lat: number; lng: number };
  onChangeLocation: () => void;
  onProceed: (recipientData: {
    receiverName: string;
    receiverPhone: string;
    saveAs: string;
  }) => void;
  userPhone?: string;
}

export default function MapDropRecipientScreen({
  onBack,
  dropAddress,
  dropCoords,
  onChangeLocation,
  onProceed,
  userPhone = "",
}: MapDropRecipientScreenProps) {
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [useMyMobile, setUseMyMobile] = useState(false);
  const [saveAs, setSaveAs] = useState<"Home" | "Shop" | "Other">("Home");

  const handleToggleMyMobile = () => {
    if (!useMyMobile) {
      setReceiverPhone(userPhone);
      setUseMyMobile(true);
    } else {
      setReceiverPhone("");
      setUseMyMobile(false);
    }
  };

  const handleContinue = () => {
    if (!dropAddress || !dropAddress.trim()) {
      alert("Please set a destination drop location before proceeding.");
      onChangeLocation();
      return;
    }
    if (!receiverName.trim()) {
      alert("Please enter the receiver's name");
      return;
    }
    if (!receiverPhone.trim() || receiverPhone.length < 10) {
      alert("Please enter a valid 10-digit mobile number for the receiver");
      return;
    }
    onProceed({
      receiverName,
      receiverPhone,
      saveAs,
    });
  };

  return (
    <div className="relative h-full flex flex-col justify-between bg-slate-100 text-slate-900 select-none overflow-hidden">
      {/* Top Floating Back Button */}
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Full-width interactive Map area */}
      <div className="relative w-full h-[45%] z-0">
        <MapContainer
          center={[dropCoords.lat, dropCoords.lng]}
          zoom={14}
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[dropCoords.lat, dropCoords.lng]} icon={dropMarkerIcon} />
        </MapContainer>

        {/* Callout Bubble: "Your goods will be dropped here" matching Screen 4 reference */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-[#0b1329] text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full shadow-xl border border-white/10 flex items-center gap-1.5">
            <span>Your goods will be dropped here</span>
          </div>
        </div>

        {/* Expand / Center control */}
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={onChangeLocation}
            className="w-9 h-9 rounded-xl bg-white shadow-md border border-slate-200 text-slate-600 flex items-center justify-center hover:text-[#0866F5]"
            title="Change Location"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Sheet Card: Recipient Details matching Screen 4 */}
      <div className="relative z-10 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.1)] p-5 pb-6 border-t border-slate-100 flex-1 overflow-y-auto">
        {/* Destination Address Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-black">↓</span>
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 leading-snug">
                {dropAddress ? dropAddress.split(",")[0] : "Set Destination"}
              </p>
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                {dropAddress || "Search or tap on the map to set delivery location"}
              </p>
            </div>
          </div>

          <button
            onClick={onChangeLocation}
            className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:border-blue-400 hover:text-[#0866F5] transition-colors shrink-0"
          >
            Change
          </button>
        </div>

        {/* Receiver Contact Form */}
        <div className="space-y-3">
          {/* Receiver's Name */}
          <div className="relative">
            <input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Receiver's Name"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0866F5] focus:bg-white transition-all pr-10"
            />
            <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>

          {/* Receiver's Mobile Number */}
          <div className="relative">
            <input
              type="tel"
              value={receiverPhone}
              onChange={(e) => setReceiverPhone(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Receiver's Mobile number"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0866F5] focus:bg-white transition-all pr-10"
              maxLength={10}
            />
            <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>

          {/* Checkbox: Use my mobile number */}
          <div
            onClick={handleToggleMyMobile}
            className="flex items-center gap-2 cursor-pointer pt-1"
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
              useMyMobile ? "bg-[#0866F5] border-[#0866F5] text-white" : "border-slate-300 bg-white"
            }`}>
              {useMyMobile && <CheckSquare className="w-3.5 h-3.5" />}
            </div>
            <span className="text-xs font-semibold text-slate-700">
              Use my mobile number : {userPhone}
            </span>
          </div>

          {/* Save As (optional) Pills */}
          <div className="pt-2">
            <p className="text-[11px] font-bold text-slate-400 mb-2">Save as (optional):</p>
            <div className="flex items-center gap-2">
              {(["Home", "Shop", "Other"] as const).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSaveAs(tag)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    saveAs === tag
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span>{tag === "Home" ? "🏠" : tag === "Shop" ? "🏬" : "❤️"}</span>
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Enter Contact Details Action Button matching Screen 4 */}
        <div className="mt-5">
          <button
            onClick={handleContinue}
            className="w-full bg-[#0866F5] hover:bg-[#0652c5] active:scale-[0.98] text-white py-3.5 px-6 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/25 transition-all"
          >
            Enter Contact Details
          </button>
        </div>
      </div>
    </div>
  );
}
