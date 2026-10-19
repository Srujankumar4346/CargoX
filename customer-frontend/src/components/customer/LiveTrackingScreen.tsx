import { useState, useEffect } from "react";
import { ArrowLeft, Share2, MoreVertical, Phone, MessageSquare, KeyRound, ShieldCheck, Clock, RefreshCw, CheckCircle2, X, Copy, ExternalLink, HelpCircle, FileText, Check, Edit3, Send } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";

const truckIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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
  const [roadPolyline, setRoadPolyline] = useState<[number, number][]>([]);
  const [trackingStatusText, setTrackingStatusText] = useState<string>("Locating...");
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [driverContactModalOpen, setDriverContactModalOpen] = useState<"call" | "message" | null>(null);

  // OTP State
  const [otpData, setOtpData] = useState<any>(null);
  const [isOtpLoading, setIsOtpLoading] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpTimeLeft, setOtpTimeLeft] = useState<number>(0);

  // Edit Receiver Details State
  const [editReceiverModalOpen, setEditReceiverModalOpen] = useState(false);
  const [receiverNameInput, setReceiverNameInput] = useState("");
  const [receiverPhoneInput, setReceiverPhoneInput] = useState("");
  const [savingReceiver, setSavingReceiver] = useState(false);
  const [receiverSaveMsg, setReceiverSaveMsg] = useState<string | null>(null);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `CargoX Live Tracking - ${liveData?.tracking_number || requestId || "Shipment"}`,
        text: `Track my CargoX delivery live in real-time. Status: ${liveData?.status || "In Transit"}`,
        url: window.location.href,
      }).catch(() => {
        setShareModalOpen(true);
      });
    } else {
      setShareModalOpen(true);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCallDriver = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (activeDriverPhone) {
      // Trigger native phone dialer protocol
      window.location.href = `tel:${activeDriverPhone}`;
      // Also open fallback modal with copy/number display in case browser/desktop does not handle tel:
      setTimeout(() => {
        setDriverContactModalOpen("call");
      }, 300);
    } else {
      setDriverContactModalOpen("call");
    }
  };

  const handleMessageDriver = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (activeDriverPhone) {
      // Trigger native SMS protocol
      window.location.href = `sms:${activeDriverPhone}`;
      // Also open fallback modal with direct WhatsApp and SMS options
      setTimeout(() => {
        setDriverContactModalOpen("message");
      }, 300);
    } else {
      setDriverContactModalOpen("message");
    }
  };

  const fetchOtp = async () => {
    if (!requestId) return;
    try {
      setIsOtpLoading(true);
      setOtpError(null);
      const data = await api.getActiveOTP(requestId);
      setOtpData(data);
      if (data?.expires_in_seconds) {
        setOtpTimeLeft(data.expires_in_seconds);
      }
    } catch (err: any) {
      console.warn("Could not load OTP:", err);
      const msg = err?.message || "";
      if (msg.includes("403") || msg.includes("401")) {
        setOtpError("Authorization error fetching verification code.");
      } else if (!msg.includes("404")) {
        setOtpError("Unable to load verification code. Please retry.");
      }
      setOtpData(null);
    } finally {
      setIsOtpLoading(false);
    }
  };

  // Continuous Tracking Refresh Loop (every 6 seconds while active)
  useEffect(() => {
    if (!requestId) {
      setIsLoading(false);
      setOtpData(null);
      return;
    }

    let isMounted = true;

    const fetchTracking = async (isInitial = false) => {
      if (isInitial) setIsLoading(true);
      try {
        const res = await api.getTracking(requestId);
        if (!isMounted || !res) return;

        setLiveData(res);

        // Update live truck position
        if (res.current_lat && res.current_lng) {
          setTruckPos([res.current_lat, res.current_lng]);
          setLastUpdatedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }

        // Breadcrumbs history (traveled path)
        if (Array.isArray(res.breadcrumbs) && res.breadcrumbs.length > 0) {
          const pts: [number, number][] = res.breadcrumbs.map((b: any) => [b.lat, b.lng]);
          setRouteCoords(pts);
        }

        // Determine status display text
        const normStatus = (res.status || "").toUpperCase();
        if (normStatus === "COMPLETED") {
          setTrackingStatusText("Delivery Completed");
        } else if (res.is_live && res.current_lat) {
          setTrackingStatusText("Live GPS Signal");
        } else if (res.current_lat) {
          setTrackingStatusText("Last Known Location");
        } else if (["DRIVER_ASSIGNED", "ASSIGNED"].includes(normStatus)) {
          setTrackingStatusText("Driver Assigned (Awaiting GPS)");
        } else {
          setTrackingStatusText("Connecting to Vehicle...");
        }

        // Fetch planned road geometry from OSRM if pickup and destination coordinates exist
        if (res.pickup_lat && res.pickup_lng && res.destination_lat && res.destination_lng && roadPolyline.length === 0) {
          fetch(`https://router.project-osrm.org/route/v1/driving/${res.pickup_lng},${res.pickup_lat};${res.destination_lng},${res.destination_lat}?overview=full&geometries=geojson`)
            .then((r) => r.json())
            .then((routeData) => {
              if (isMounted && routeData?.routes?.[0]?.geometry?.coordinates) {
                const geoPts: [number, number][] = routeData.routes[0].geometry.coordinates.map(
                  (c: [number, number]) => [c[1], c[0]]
                );
                setRoadPolyline(geoPts);
              }
            })
            .catch((osrmErr) => {
              console.warn("Road routing API fallback:", osrmErr);
            });
        }
      } catch (err: any) {
        console.warn("Could not poll tracking:", err);
        if (isMounted) {
          setTrackingStatusText("Connection interrupted");
        }
      } finally {
        if (isMounted && isInitial) setIsLoading(false);
      }
    };

    // Initial fetch
    fetchTracking(true);
    fetchOtp();

    // 6-second polling interval for real-time location streaming
    const trackingInterval = setInterval(() => {
      fetchTracking(false);
    }, 6000);

    const otpInterval = setInterval(() => {
      fetchOtp();
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(trackingInterval);
      clearInterval(otpInterval);
    };
  }, [requestId]);

  // Countdown timer for active OTP
  useEffect(() => {
    if (otpTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setOtpTimeLeft((prev) => {
        if (prev <= 1) {
          fetchOtp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [otpTimeLeft]);

  // Handler to update receiver details (recipient name & destination phone)
  const handleSaveReceiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId) return;
    const cleanedPhone = receiverPhoneInput.trim().replace(/\D/g, "");
    if (cleanedPhone && cleanedPhone.length !== 10) {
      setReceiverSaveMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setSavingReceiver(true);
      setReceiverSaveMsg(null);
      await api.updateBooking(requestId, {
        destination_contact_person: receiverNameInput.trim() || undefined,
        destination_phone: cleanedPhone || undefined,
      });

      // Refresh tracking data and OTP
      const updated = await api.getTracking(requestId);
      if (updated) setLiveData(updated);
      await fetchOtp();

      setReceiverSaveMsg("Receiver details updated successfully! OTP resent.");
      setTimeout(() => {
        setEditReceiverModalOpen(false);
        setReceiverSaveMsg(null);
      }, 1200);
    } catch (err: any) {
      console.error("Failed to update receiver details:", err);
      setReceiverSaveMsg(err?.message || "Failed to update receiver details. Please try again.");
    } finally {
      setSavingReceiver(false);
    }
  };

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
    <div className="relative h-full w-full bg-slate-50 flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header matching Screen 10 */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-100 shadow-xs">
        <button
          onClick={onBack}
          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900">Live Tracking</h1>
        <div className="relative flex items-center gap-1">
          {isLoading && (
            <div className="w-4 h-4 border-2 border-[#1e60ff] border-t-transparent rounded-full animate-spin mr-1" />
          )}
          <button 
            onClick={handleShare}
            title="Share Tracking Link"
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            title="Tracking Options"
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* 3-Dots Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 text-xs">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setDetailsModalOpen(true);
                }}
                className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Trip Details</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleShare();
                }}
                className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Share Shipment</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleCallDriver();
                }}
                className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Phone className="w-3.5 h-3.5 text-amber-600" />
                <span>Call Driver</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  alert("CargoX Operations Support Helpline: 1800-CARGO-X (24/7 Toll-Free)\nEmail: support@cargox.com");
                }}
                className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
              >
                <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                <span>Emergency Support</span>
              </button>
            </div>
          )}
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
          zoom={truckPos ? 13 : 8}
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

          {/* Planned Road Route (Dark Blue Dashed) */}
          {roadPolyline.length > 1 && (
            <Polyline positions={roadPolyline} color="#0f172a" weight={4} dashArray="6, 8" opacity={0.65} />
          )}

          {/* Actual GPS Breadcrumbs (Traveled Path - Bright Blue) */}
          {routeCoords.length > 1 && (
            <Polyline positions={routeCoords} color="#1e60ff" weight={5} opacity={0.9} />
          )}

          {/* Authoritative Live Driver Marker */}
          {truckPos && <Marker position={truckPos} icon={truckIcon} />}
        </MapContainer>
      </div>

      {/* GPS Status Notice Pill */}
      <div className="absolute top-[28%] right-4 z-10">
        {hasLiveGps ? (
          <div className="bg-[#0b1329]/95 backdrop-blur-md text-white px-3 py-2 rounded-xl shadow-xl border border-white/10 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">{trackingStatusText}</p>
            </div>
            <p className="text-xs font-black tracking-tight mt-0.5">{speedKmH ? `${speedKmH} km/h` : "Live Active"}</p>
            {lastUpdatedTime && (
              <p className="text-[9px] text-slate-400 mt-0.5">Updated: {lastUpdatedTime}</p>
            )}
          </div>
        ) : (
          <div className="bg-[#0b1329]/90 backdrop-blur-md text-white px-3 py-2 rounded-xl shadow-xl border border-white/10 text-center max-w-[160px]">
            <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">{trackingStatusText}</p>
            <p className="text-[10px] text-slate-300 font-medium mt-0.5 leading-tight">Live location will appear when driver starts journey.</p>
          </div>
        )}
      </div>

      {/* Bottom Live Tracking Details Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] p-5 pb-24 border-t border-slate-100 max-w-md mx-auto max-h-[62vh] overflow-y-auto">
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCallDriver}
                  className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 text-slate-700 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50/50 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  title={activeDriverPhone ? `Call Driver (${activeDriverPhone})` : "Driver Contact"}
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleMessageDriver}
                  className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 text-slate-700 hover:text-[#1e60ff] hover:border-blue-200 hover:bg-blue-50/50 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  title={activeDriverPhone ? `Message Driver (${activeDriverPhone})` : "Send Message"}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
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

        {/* Customer Verification OTP Section: Positioned below Driver & Vehicle info, above Trip Schedule */}
        {/* Hide active OTP during IN_TRANSIT and only show relevant stage */}
        {isOtpLoading && !otpData && (
          <div className="py-3 border-b border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1e60ff]" />
            <span>Loading verification code...</span>
          </div>
        )}

        {otpError && !otpData && (
          <div className="py-2.5 border-b border-slate-100">
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-800">
              <span>{otpError}</span>
              <button
                onClick={fetchOtp}
                className="px-2 py-1 text-[11px] font-bold text-[#1e60ff] bg-white rounded-md border border-slate-200 shadow-2xs"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {otpData && (
          <div className="py-2.5 border-b border-slate-100">
            {otpData.is_verified ? (
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-900">{otpData.stage_label || "Handover Verified"}</p>
                    <p className="text-[10px] text-emerald-700 font-medium">{otpData.instruction}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  Verified
                </span>
              </div>
            ) : otpData.has_active_otp && operationalStatus !== "IN_TRANSIT" ? (
              <div className={`border rounded-2xl p-3.5 shadow-xs ${
                otpData.purpose === "DELIVERY" 
                  ? "bg-gradient-to-r from-emerald-50/90 to-teal-50/90 border-emerald-200/90"
                  : "bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border-blue-200/90"
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                      otpData.purpose === "DELIVERY"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-[#1e60ff]/10 text-[#1e60ff]"
                    }`}>
                      <KeyRound className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
                      otpData.purpose === "DELIVERY" ? "text-emerald-700" : "text-[#1e60ff]"
                    }`}>
                      {otpData.purpose === "PICKUP" ? "PICKUP VERIFICATION OTP" : "RECEIVER DELIVERY OTP"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/60">
                      <Clock className={`w-3 h-3 ${otpTimeLeft < 60 ? "text-rose-500 animate-pulse" : "text-slate-400"}`} />
                      <span className={otpTimeLeft < 60 ? "text-rose-600 font-mono font-bold" : "text-slate-700 font-mono font-bold"}>
                        {Math.floor(otpTimeLeft / 60)}:{(otpTimeLeft % 60) < 10 ? "0" : ""}{otpTimeLeft % 60}
                      </span>
                    </div>
                    <button
                      onClick={fetchOtp}
                      disabled={isOtpLoading}
                      title="Refresh code"
                      className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isOtpLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                {otpData.purpose === "DELIVERY" ? (
                  <div className="mt-2 space-y-2">
                    <div className="bg-white/80 border border-emerald-200/70 rounded-xl p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-emerald-950 font-bold flex items-center gap-1.5">
                          <span>📲</span>
                          <span>Sent via SMS to Receiver</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setReceiverNameInput(otpData.recipient_name || liveData?.destination_contact_person || "");
                            setReceiverPhoneInput(liveData?.destination_phone || "");
                            setReceiverSaveMsg(null);
                            setEditReceiverModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                          title="Edit recipient name and mobile number"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Receiver Details</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                        {otpData.instruction || `Delivery OTP was sent to receiver (${otpData.recipient_name || 'Receiver'} at ${otpData.recipient_phone_masked || 'destination mobile'}).`}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-0.5">
                      <span className="text-[10px] text-slate-500 font-medium">Backup receiver handover code:</span>
                      <div className="bg-white border-2 border-emerald-500/50 rounded-xl px-3 py-1 shadow-sm shrink-0">
                        <span className="font-mono text-lg font-black tracking-[0.25em] text-emerald-700 pl-1">
                          {otpData.code}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 mt-2">
                    <p className="text-xs text-slate-600 font-medium leading-snug">
                      Share this code with your driver at pickup to begin the journey.
                    </p>
                    <div className="bg-white border-2 border-[#1e60ff]/50 rounded-xl px-3.5 py-1.5 shadow-sm shrink-0">
                      <span className="font-mono text-xl font-black tracking-[0.25em] text-[#1e60ff] pl-1">
                        {otpData.code}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
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
            type="button"
            onClick={() => setDetailsModalOpen(true)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer active:scale-95"
          >
            View Details
          </button>
        </div>
      </div>

      {/* Share Modal Dialog */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-[#1e60ff] flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Share Tracking</h3>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              Anyone with this link can track this shipment live on the interactive map:
            </p>

            <div className="mt-3 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
              <input
                type="text"
                readOnly
                value={window.location.href}
                className="bg-transparent text-xs text-slate-700 font-mono w-full outline-hidden truncate"
              />
              <button
                onClick={handleCopyLink}
                className="px-2.5 py-1.5 bg-[#1e60ff] text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition flex items-center gap-1 shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Track my CargoX shipment in real-time: ${window.location.href}`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition"
              >
                <span>WhatsApp</span>
              </a>
              <a
                href={`sms:?body=${encodeURIComponent(`Track my CargoX delivery: ${window.location.href}`)}`}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
              >
                <span>SMS</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Driver Contact & Emergency Support Modal */}
      {driverContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  driverContactModalOpen === "call" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-[#1e60ff]"
                }`}>
                  {driverContactModalOpen === "call" ? <Phone className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {driverContactModalOpen === "call" ? "Call Carrier" : "Message Carrier"}
                </h3>
              </div>
              <button
                onClick={() => setDriverContactModalOpen(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3">
              <p className="text-xs text-slate-500 font-medium">Assigned Driver:</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{activeDriverName || "Verified CargoX Driver"}</p>
              
              {activeDriverPhone ? (
                <>
                  <p className="text-xs text-slate-500 mt-3 font-medium">Direct Mobile Number:</p>
                  <div className="mt-1 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                    <span className="font-mono text-sm font-bold text-slate-800">{activeDriverPhone}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeDriverPhone);
                        setCopiedPhone(true);
                        setTimeout(() => setCopiedPhone(false), 2000);
                      }}
                      className="text-xs text-[#1e60ff] font-bold hover:underline flex items-center gap-1"
                    >
                      {copiedPhone ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPhone ? "Copied" : "Copy"}</span>
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <a
                      href={`tel:${activeDriverPhone}`}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Dial Now ({activeDriverPhone})</span>
                    </a>
                    <a
                      href={`https://api.whatsapp.com/send?phone=${encodeURIComponent(activeDriverPhone.replace(/[^0-9+]/g, ""))}&text=${encodeURIComponent(`Hi, regarding CargoX delivery ${liveData?.tracking_number || requestId || ""}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition flex items-center justify-center gap-2"
                    >
                      <span>Chat on WhatsApp</span>
                    </a>
                  </div>
                </>
              ) : (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  <p className="font-bold">Driver Phone Pending</p>
                  <p className="mt-1 text-slate-600">The driver's direct contact will become available once operations dispatch confirms the cellular SIM linking.</p>
                </div>
              )}

              {/* 24/7 Operations Support Helpline Fallback */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">24/7 CargoX Helpline:</span>
                  <a href="tel:1800227469" className="font-bold text-[#1e60ff] hover:underline">1800-CARGO-X</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Trip Details Modal */}
      {detailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-[#1e60ff] flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Trip & Cargo Details</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Ref: {liveData?.tracking_number || requestId?.slice(0, 8) || "N/A"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
              {/* Route section */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pickup Location</p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">
                    {liveData?.origin_address || "Customer Specified Origin"}
                  </p>
                </div>
                <div className="border-t border-slate-200/60 pt-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Drop Location</p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">
                    {liveData?.destination_address || "Customer Specified Destination"}
                  </p>
                </div>
              </div>

              {/* Vehicle & Carrier */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Vehicle Type</p>
                  <p className="font-bold text-slate-800 mt-0.5">{activeVehicleType || "Freight Truck"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Registration</p>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">{activePlate || "Assigned by Fleet"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Capacity</p>
                  <p className="font-bold text-slate-800 mt-0.5">{activeCapacity || "Standard"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Assigned Driver</p>
                  <p className="font-bold text-slate-800 mt-0.5">{activeDriverName || "Pending"}</p>
                </div>
              </div>

              {/* Status and Milestones */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Shipment Status:</span>
                  <span className="font-bold text-[#1e60ff]">{operationalStatus.replace(/_/g, " ")}</span>
                </div>
                {liveData?.submitted_at && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Booked At:</span>
                    <span className="text-slate-700 font-medium">
                      {new Date(liveData.submitted_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                )}
                {liveData?.picked_up_at && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Picked Up At:</span>
                    <span className="text-slate-700 font-medium">
                      {new Date(liveData.picked_up_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                )}
                {liveData?.delivered_at && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Delivered At:</span>
                    <span className="text-slate-700 font-medium">
                      {new Date(liveData.delivered_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-white flex items-center justify-end gap-2">
              {onViewDetails && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    onViewDetails();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#1e60ff] text-white font-bold text-xs hover:bg-blue-600 transition flex items-center gap-1.5"
                >
                  <span>Go to My Bookings</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                className="px-3 py-2 rounded-xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT RECEIVER DETAILS MODAL (Temporary feature) */}
      {editReceiverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-[#1e60ff] flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Receiver Details</h3>
                  <p className="text-[11px] text-slate-500">Update destination recipient & SMS OTP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditReceiverModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReceiver} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Recipient Name
                </label>
                <input
                  type="text"
                  value={receiverNameInput}
                  onChange={(e) => setReceiverNameInput(e.target.value)}
                  placeholder="e.g. Suresh Kumar"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#1e60ff]/30 focus:border-[#1e60ff] font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Receiver Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-2 rounded-xl border border-slate-200">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={receiverPhoneInput}
                    onChange={(e) => setReceiverPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    required
                    className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#1e60ff]/30 focus:border-[#1e60ff] font-medium tracking-wider"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Delivery verification OTP will be sent directly via SMS to this number.
                </p>
              </div>

              {receiverSaveMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold ${
                  receiverSaveMsg.includes("successfully") 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {receiverSaveMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={savingReceiver}
                  onClick={() => setEditReceiverModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReceiver || !receiverPhoneInput.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1e60ff] hover:bg-blue-600 rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingReceiver ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Update & Resend OTP</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
