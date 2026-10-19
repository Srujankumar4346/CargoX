import { useEffect, useState } from "react";
import { Activity, ClipboardList, Navigation, Package, Wallet, MapPin, Clock, Menu, X, CheckCircle2, Truck, IndianRupee, ArrowRight, User, QrCode, RotateCw, Copy, ExternalLink, AlertCircle, ShieldCheck, KeyRound, Smartphone, ShieldAlert, FileText, HelpCircle, Phone, Mail, FileCheck, Gift, Award, TrendingUp, Users } from "lucide-react";
import { useAuth, UserButton, useUser } from "@clerk/react";
import { api } from "../services/api";
import NotificationDropdown from "../components/NotificationDropdown";
import CargoExpressLogo from "../components/CargoExpressLogo";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";

const driverSidebar = [
  { label: "Dashboard", icon: Activity },
  { label: "Current Orders", icon: ClipboardList },
  { label: "Previous Orders", icon: Package },
  { label: "Tracking", icon: Navigation },
  { label: "Payments", icon: Wallet },
  { label: "Vehicle Documents", icon: FileText },
  { label: "Help & Support", icon: HelpCircle },
  { label: "Profile", icon: User },
];

const normalizeStatus = (status: string | undefined) => (status || "").toUpperCase().replace(/ /g, "_");

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  const tone = ["AVAILABLE", "COMPLETED", "DELIVERED"].includes(normalized)
    ? "text-emerald-300 bg-emerald-400/10 border-emerald-400/20"
    : ["SUBMITTED", "REQUESTED", "ACCEPTED", "UNDER_REVIEW", "IN_TRANSIT", "PICKED_UP", "POD_SUBMITTED"].includes(normalized)
      ? "text-amber-300 bg-amber-400/10 border-amber-400/20"
      : ["REJECTED", "CUSTOMER_CANCELLED", "INACTIVE"].includes(normalized)
        ? "text-red-300 bg-red-400/10 border-red-400/20"
        : "text-blue-300 bg-blue-400/10 border-blue-400/20";
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold tracking-[0.12em] ${tone}`}>{status?.replace(/_/g, " ") || "UNKNOWN"}</span>;
}

const openGoogleMapsLocation = (lat?: number | null, lng?: number | null, address?: string | null) => {
  let url = "";
  if (lat && lng) {
    url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  } else if (address) {
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    alert("Location coordinates or address not available.");
  }
};

const openGoogleMapsRoute = (pickupLat?: number | null, pickupLng?: number | null, pickupAddress?: string | null, destLat?: number | null, destLng?: number | null, destAddress?: string | null) => {
  const origin = (pickupLat && pickupLng) ? `${pickupLat},${pickupLng}` : pickupAddress;
  const destination = (destLat && destLng) ? `${destLat},${destLng}` : destAddress;

  if (origin && destination) {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  } else if (destination) {
    openGoogleMapsLocation(destLat, destLng, destAddress);
  } else if (origin) {
    openGoogleMapsLocation(pickupLat, pickupLng, pickupAddress);
  } else {
    alert("Route details not available.");
  }
};

import DriverWelcomeScreen from "../components/DriverWelcomeScreen";
import DriverBottomNavigation, { DriverNavTab } from "../components/DriverBottomNavigation";
import DriverProfileDrawer, { DriverMenuItemKey } from "../components/DriverProfileDrawer";
import DriverHomeDashboard from "../components/DriverHomeDashboard";
import DriverAllOrdersScreen from "../components/DriverAllOrdersScreen";
import DriverOrderDetailsScreen from "../components/DriverOrderDetailsScreen";
import DriverEarningsScreen from "../components/DriverEarningsScreen";
import DriverActiveOrderScreen from "../components/DriverActiveOrderScreen";
import DriverVehicleDocumentsScreen from "../components/DriverVehicleDocumentsScreen";
import DriverHelpSupportScreen from "../components/DriverHelpSupportScreen";
import DriverProfileScreen from "../components/DriverProfileScreen";
import InAppModal, { InAppModalData } from "../components/InAppModal";

export default function DriverWorkspace() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reference Navigation and Screen State
  const [currentTab, setCurrentTab] = useState<DriverNavTab>('home');
  const [activeScreen, setActiveScreen] = useState<
    'welcome' | 'dashboard' | 'all-orders' | 'order-details' | 'earnings' | 'active-order' | 'documents' | 'help' | 'profile'
  >('dashboard');
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<any>(null);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [inAppModalData, setInAppModalData] = useState<InAppModalData | null>(null);
  const [isOnDuty, setIsOnDuty] = useState<boolean>(() => {
    return localStorage.getItem('cargoexpress_driver_on_duty') === 'true';
  });

  const [selectedTab, setSelectedTab] = useState("Dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [paymentState, setPaymentState] = useState<string>("Payment Due");
  const [paymentType, setPaymentType] = useState<"UPI" | "CASH">("UPI");
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cashRef, setCashRef] = useState<string>("");
  const [recordingCash, setRecordingCash] = useState(false);
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [gpsTrackingActive, setGpsTrackingActive] = useState(false);
  const [gpsStatusText, setGpsStatusText] = useState<string>("Initializing GPS...");
  const [gpsLastCoords, setGpsLastCoords] = useState<{ lat: number; lng: number; time: string } | null>(null);

  // Automated Real-Time GPS Tracking Loop with Bounded Offline Queue
  useEffect(() => {
    if (!activeTrip) {
      setGpsTrackingActive(false);
      setGpsStatusText("No active trip");
      return;
    }

    const targetTripId = activeTrip.trip_id || activeTrip.id;
    const status = normalizeStatus(activeTrip.status);
    const activeTrackingStatuses = [
      "DRIVER_ASSIGNED",
      "ASSIGNED",
      "PICKUP_IN_PROGRESS",
      "IN_TRANSIT",
      "ARRIVED",
      "POD_SUBMITTED",
      "DELIVERED",
    ];

    if (!activeTrackingStatuses.includes(status)) {
      setGpsTrackingActive(false);
      setGpsStatusText("Trip completed/inactive");
      return;
    }

    if (!navigator.geolocation) {
      setGpsTrackingActive(false);
      setGpsStatusText("Geolocation unsupported");
      return;
    }

    let isSubscribed = true;
    let watchId: number | null = null;
    let intervalId: any = null;
    let lastUploadedTimestamp = 0;
    const offlineQueue: { lat: number; lng: number; timestamp: number }[] = [];

    const sendGpsUpdate = async (latitude: number, longitude: number, timestamp: number) => {
      if (!isSubscribed) return;

      // Rate limit to at most once per 4 seconds while moving
      if (timestamp - lastUploadedTimestamp < 4000) return;

      // Offline queue bounded replay (max 20 stored)
      if (offlineQueue.length > 0 && navigator.onLine) {
        const queuedBatch = offlineQueue.splice(0, 10);
        for (const item of queuedBatch) {
          try {
            await api.updateDriverLocation(targetTripId, item.lat, item.lng);
          } catch (e) {
            console.warn("Error uploading buffered GPS update:", e);
          }
        }
      }

      try {
        if (!navigator.onLine) {
          if (offlineQueue.length < 20) {
            offlineQueue.push({ lat: latitude, lng: longitude, timestamp });
          }
          setGpsStatusText("Offline: Location queued");
          return;
        }

        await api.updateDriverLocation(targetTripId, latitude, longitude);
        lastUploadedTimestamp = timestamp;
        if (isSubscribed) {
          setGpsTrackingActive(true);
          setGpsStatusText("Live GPS Active");
          setGpsLastCoords({
            lat: latitude,
            lng: longitude,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          });
        }
      } catch (err: any) {
        console.warn("Failed to transmit GPS coordinates:", err);
        if (isSubscribed) {
          setGpsStatusText("Connection interrupted");
          if (offlineQueue.length < 20) {
            offlineQueue.push({ lat: latitude, lng: longitude, timestamp });
          }
        }
      }
    };

    // Watch position for instantaneous movement
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        sendGpsUpdate(pos.coords.latitude, pos.coords.longitude, pos.timestamp || Date.now());
      },
      (err) => {
        console.warn("GPS watch error:", err.message);
        if (isSubscribed) {
          if (err.code === err.PERMISSION_DENIED) {
            setGpsStatusText("Location permission denied");
            setGpsTrackingActive(false);
          } else {
            setGpsStatusText("Signal interrupted");
          }
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    // Periodic 8s fallback interval ensuring updates continue even during stationary dwell at destination
    intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendGpsUpdate(pos.coords.latitude, pos.coords.longitude, pos.timestamp || Date.now());
        },
        (err) => {
          console.warn("Periodic GPS check error:", err.message);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }, 8000);

    return () => {
      isSubscribed = false;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [activeTrip?.trip_id, activeTrip?.id, activeTrip?.status]);

  const handleUpdateLocation = async () => {
    if (!activeTrip) return;
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser/device.");
      return;
    }
    setUpdatingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.updateDriverLocation(targetTripId, pos.coords.latitude, pos.coords.longitude);
          setGpsTrackingActive(true);
          setGpsStatusText("Live GPS Active");
          setGpsLastCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          });
          alert(`Location updated: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        } catch (err: any) {
          alert(`Failed to upload location: ${err.message}`);
        } finally {
          setUpdatingLocation(false);
        }
      },
      (err) => {
        alert(`Location permission error: ${err.message}`);
        setUpdatingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Dedicated Proof of Delivery Modal state
  const [podModalOpen, setPodModalOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(true);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [submittingPod, setSubmittingPod] = useState(false);

  // Dual-Stage OTP Verification State (Pickup & Delivery)
  const [pickupOtpInput, setPickupOtpInput] = useState("");
  const [verifyingPickupOtp, setVerifyingPickupOtp] = useState(false);
  const [pickupOtpStatus, setPickupOtpStatus] = useState<any>(null);
  const [pickupOtpError, setPickupOtpError] = useState<string | null>(null);
  const [pickupOtpSuccess, setPickupOtpSuccess] = useState<string | null>(null);

  const [deliveryOtpInput, setDeliveryOtpInput] = useState("");
  const [verifyingDeliveryOtp, setVerifyingDeliveryOtp] = useState(false);
  const [deliveryOtpStatus, setDeliveryOtpStatus] = useState<any>(null);
  const [deliveryOtpError, setDeliveryOtpError] = useState<string | null>(null);
  const [deliveryOtpSuccess, setDeliveryOtpSuccess] = useState<string | null>(null);

  // Poll / refresh OTP status when activeTrip changes
  useEffect(() => {
    if (!activeTrip) return;
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    const status = normalizeStatus(activeTrip.status);

    if (["DRIVER_ASSIGNED", "ASSIGNED", "PICKUP_IN_PROGRESS"].includes(status)) {
      api.getDeliveryOTPStatus(targetTripId, "PICKUP")
        .then((res: any) => setPickupOtpStatus(res))
        .catch((err: any) => console.warn("Failed to load pickup OTP status:", err));
    }

    if (["ARRIVED", "POD_SUBMITTED", "DELIVERED"].includes(status)) {
      api.getDeliveryOTPStatus(targetTripId, "DELIVERY")
        .then((res: any) => setDeliveryOtpStatus(res))
        .catch((err: any) => console.warn("Failed to load delivery OTP status:", err));
    }
  }, [activeTrip?.status, activeTrip?.trip_id, activeTrip?.id]);

  const handleVerifyPickupOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeTrip || verifyingPickupOtp || pickupOtpInput.trim().length !== 6) return;
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    setVerifyingPickupOtp(true);
    setPickupOtpError(null);
    setPickupOtpSuccess(null);
    try {
      const res = await api.verifyDeliveryOTP(targetTripId, pickupOtpInput.trim(), "PICKUP");
      setPickupOtpSuccess(res.message);
      setPickupOtpInput("");
      const updatedTrip = await api.getDriverActiveTrip();
      if (updatedTrip) setActiveTrip(updatedTrip);
      const updatedStatus = await api.getDeliveryOTPStatus(targetTripId, "PICKUP");
      setPickupOtpStatus(updatedStatus);
    } catch (err: any) {
      setPickupOtpError(err.message || "Invalid Pickup OTP. Please ask customer to read the OTP from their screen.");
    } finally {
      setVerifyingPickupOtp(false);
    }
  };

  const handleVerifyDeliveryOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeTrip || verifyingDeliveryOtp || deliveryOtpInput.trim().length !== 6) return;
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    setVerifyingDeliveryOtp(true);
    setDeliveryOtpError(null);
    setDeliveryOtpSuccess(null);
    try {
      const res = await api.verifyDeliveryOTP(targetTripId, deliveryOtpInput.trim(), "DELIVERY");
      setDeliveryOtpSuccess(res.message);
      setDeliveryOtpInput("");
      const updatedTrip = await api.getDriverActiveTrip();
      if (updatedTrip) setActiveTrip(updatedTrip);
      const updatedStatus = await api.getDeliveryOTPStatus(targetTripId, "DELIVERY");
      setDeliveryOtpStatus(updatedStatus);
    } catch (err: any) {
      setDeliveryOtpError(err.message || "Invalid Delivery OTP. Please ask recipient to read the OTP from their screen.");
    } finally {
      setVerifyingDeliveryOtp(false);
    }
  };

  const handlePayCargoXNow = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!activeTrip || initiatingPayment) return;
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    setInitiatingPayment(true);
    setError(null);
    try {
      const order = await api.driverPayCargoXNow(targetTripId);
      setPaymentOrder(order);
      setPaymentState(order.payment_status_display || "Waiting for Payment");
      // Background-refresh trip without setting loading=true to prevent full page re-render
      try {
        const refreshedTrip = await api.getDriverActiveTrip();
        if (refreshedTrip) {
          setActiveTrip(refreshedTrip);
        }
      } catch (refreshErr) {
        console.warn("Background trip refresh failed:", refreshErr);
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("503") || msg.toLowerCase().includes("not configured")) {
        alert("Online payment is not configured yet. Please collect Cash or contact CargoExpress Admin.");
      } else {
        alert(`Payment initiation failed: ${msg}`);
      }
      setPaymentState("Payment Failed");
    } finally {
      setInitiatingPayment(false);
    }
  };

  const handleOpenPodModal = () => {
    setRecipientName(activeTrip?.destination_contact_person || "");
    setRecipientPhone(activeTrip?.destination_phone || "");
    setDeliveryConfirmed(true);
    setDeliveryNotes("");
    setPodModalOpen(true);
  };

  const handleSubmitPodForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;
    if (!recipientName.trim()) {
      alert("Please enter the recipient's name who received the cargo.");
      return;
    }
    if (!deliveryConfirmed) {
      alert("Please check the delivery confirmation box to confirm handover.");
      return;
    }
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    setSubmittingPod(true);
    try {
      await api.driverSubmitPOD(targetTripId, {
        receiver_name: recipientName.trim(),
        receiver_phone: recipientPhone.trim() || undefined,
        delivery_confirmed: true,
        notes: deliveryNotes.trim() || undefined,
        pod_signature_url: "https://storage.cargox.com/pod-signed.png"
      });
      setPodModalOpen(false);
      alert("Proof of Delivery submitted successfully! Awaiting Admin verification.");
      await loadDriverData();
    } catch (err: any) {
      alert(`POD submission failed: ${err.message}`);
    } finally {
      setSubmittingPod(false);
    }
  };

  const handleCheckPaymentStatus = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!activeTrip || checkingStatus) return;
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    setCheckingStatus(true);
    try {
      const res = await api.getDriverPaymentStatus(targetTripId);
      setPaymentState(res.status);
      if (res.is_fully_paid) {
        alert("Payment Confirmed! Outstanding balance settled. Trip completed successfully.");
      }
      // Background-refresh trip without setting loading=true
      try {
        const refreshedTrip = await api.getDriverActiveTrip();
        if (refreshedTrip) {
          setActiveTrip(refreshedTrip);
        }
      } catch (refreshErr) {
        console.warn("Background trip refresh failed:", refreshErr);
      }
    } catch (err: any) {
      alert(`Could not verify payment status: ${err.message}`);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleRecordCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    const due = parseFloat(activeTrip.amount_due_for_collection || "0");
    const amountVal = cashAmount ? parseFloat(cashAmount) : due;
    if (isNaN(amountVal) || amountVal <= 0) {
      alert("Please enter a valid cash amount greater than ₹0");
      return;
    }
    if (amountVal > due) {
      alert(`Entered cash amount (₹${amountVal}) cannot exceed the balance due (₹${due}).`);
      return;
    }

    setRecordingCash(true);
    try {
      await api.driverRecordCollection(targetTripId, {
        amount: amountVal,
        collection_method: "CASH",
        reference_number: cashRef.trim() || `CASH-${Date.now().toString().slice(-6)}`,
        notes: "Cash collected at delivery site"
      });
      alert(`Cash payment of ₹${amountVal.toFixed(2)} recorded successfully! Trip completed.`);
      setPaymentState("Payment Successful");
      setCashAmount("");
      setCashRef("");
      await loadDriverData();
    } catch (err: any) {
      alert(`Failed to record cash payment: ${err.message}`);
    } finally {
      setRecordingCash(false);
    }
  };

  const handleCopyPaymentLink = () => {
    const link = paymentOrder?.payment_link || activeTrip?.upi_uri;
    if (link) {
      navigator.clipboard.writeText(link);
      alert("Payment link copied to clipboard!");
    } else {
      alert("No active payment link available.");
    }
  };

  const loadDriverData = async () => {
    setLoading(true);
    setError(null);

    // Timeout guard so the screen NEVER gets stuck on "Connecting to CargoExpress Dispatch..."
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 6000);

    try {
      // 1. Profile
      try {
        const p = await api.getCurrentUserProfile();
        if (p) setProfile(p);
      } catch (profileErr) {
        console.warn("Could not fetch driver profile:", profileErr);
      }

      // 2. Active Trip
      let activeRes = null;
      try {
        activeRes = await api.getDriverActiveTrip();
        setActiveTrip(activeRes);
      } catch (tripErr) {
        console.warn("No active trip or failed to load active trip:", tripErr);
        setActiveTrip(null);
      }

      // 3. Trip History
      try {
        const historyRes = await api.getDriverTripsHistory();
        setHistory(Array.isArray(historyRes) ? historyRes : []);
      } catch (histErr) {
        console.warn("Failed to load trip history:", histErr);
        setHistory([]);
      }

      // 4. Settlements
      try {
        const settlementsRes = await api.getDriverSettlements();
        setSettlements(Array.isArray(settlementsRes) ? settlementsRes : []);
      } catch (_) {
        setSettlements([]);
      }

      if (activeRes) {
        const due = parseFloat(activeRes.amount_due_for_collection || "0");
        const total = parseFloat(activeRes.invoice_total_amount || "0");
        if (activeRes.payment_status_display === "Paid" || (due <= 0 && total > 0)) {
          setPaymentState("Payment Successful");
        } else if (activeRes.payment_status_display) {
          setPaymentState(activeRes.payment_status_display);
        } else {
          setPaymentState("Payment Due");
        }
      }
    } catch (e: any) {
      console.error("loadDriverData error:", e);
      setError(e?.message || "Failed to load driver workspace");
    } finally {
      clearTimeout(safetyTimeout);
      setLoading(false);
    }
  };

  const handleToggleDuty = () => {
    const nextState = !isOnDuty;
    setIsOnDuty(nextState);
    localStorage.setItem('cargoexpress_driver_on_duty', String(nextState));
  };

  // Handle body scroll locking, escape key, and desktop resize cleanup for mobile drawer
  useEffect(() => {
    if (isMobileSidebarOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsMobileSidebarOpen(false);
        }
      };
      const handleResize = () => {
        if (window.innerWidth >= 768) {
          setIsMobileSidebarOpen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("resize", handleResize);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("resize", handleResize);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    if ((isLoaded && isSignedIn) || localStorage.getItem("access_token")) {
      loadDriverData();
    }
  }, [isLoaded, isSignedIn]);

  const handleAction = async (action: string) => {
    if (!activeTrip) return;
    const targetTripId = activeTrip.trip_id || activeTrip.id;
    try {
      switch (action) {
        case 'start-pickup':
          await api.driverStartPickup(targetTripId);
          break;
        case 'start-transit':
          await api.driverStartTransit(targetTripId);
          break;
        case 'arrive':
          await api.driverArrive(targetTripId);
          break;
        case 'submit-pod':
          const podName = prompt("Enter receiver name for POD:");
          if (!podName) return;
          await api.driverSubmitPOD(targetTripId, { receiver_name: podName, signature: "signed" });
          break;
      }
      loadDriverData();
    } catch (e: any) {
      alert(`Action failed: ${e.message}`);
    }
  };

  const completedTrips = history.filter((t) => ["COMPLETED", "DELIVERED"].includes(normalizeStatus(t.status)));

  const renderDashboard = () => (
    <div className="space-y-6 fade-in max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Good Morning, {user?.firstName || user?.fullName || profile?.email?.split('@')[0] || "Driver"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">Here are your deliveries for today.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-blue-500/10 p-2 text-blue-400"><Truck size={20} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-white">{activeTrip ? 1 : 0}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Current Delivery</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400"><CheckCircle2 size={20} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-white">{completedTrips.length}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Completed Deliveries</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-amber-500/10 p-2 text-amber-400"><Clock size={20} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-white">0</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Pending Pickup</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-purple-500/10 p-2 text-purple-400"><IndianRupee size={20} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-white">{history.length}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Total Payments</p>
          <p className="text-[10px] text-slate-600">This Month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
        {/* Left Column: Current Delivery */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10 relative">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-lg font-bold text-white">Current Delivery</h2>
               {activeTrip && <StatusBadge status={activeTrip.status} />}
            </div>

            {activeTrip ? (
              <>
                <div className="mb-6">
                  <div className="text-xl font-bold text-white flex items-center gap-2">
                    Trip #{activeTrip.request_number || activeTrip.request?.request_number || String(activeTrip.trip_id || activeTrip.id).slice(-8).toUpperCase()}
                  </div>
                  <div className="text-sm text-slate-500">Order #{activeTrip.request_number || activeTrip.booking_id || "ORD"}</div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
                  <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950 p-4 relative w-full">
                    <div className="flex items-start gap-3">
                      <MapPin className="text-blue-500 shrink-0 mt-1" size={20} />
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Pickup Location</div>
                        <div className="font-semibold text-white text-sm mb-1">{activeTrip.pickup_company_name || activeTrip.request?.pickup_company_name || activeTrip.request?.customer_name || "Pickup"}</div>
                        <div className="text-xs text-slate-500 line-clamp-2">{activeTrip.pickup_address || activeTrip.request?.pickup_address}</div>
                        <button
                          onClick={() => openGoogleMapsLocation(activeTrip.pickup_lat || activeTrip.request?.pickup_lat, activeTrip.pickup_lng || activeTrip.request?.pickup_lng, activeTrip.pickup_address || activeTrip.request?.pickup_address)}
                          className="mt-3 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md flex items-center gap-2 font-medium transition cursor-pointer"
                        >
                          <Navigation size={12}/> Navigate to Pickup
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-600 shrink-0 hidden md:block">
                    <ArrowRight size={24} />
                  </div>
                  <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950 p-4 relative w-full">
                    <div className="flex items-start gap-3">
                      <MapPin className="text-red-500 shrink-0 mt-1" size={20} />
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Destination</div>
                        <div className="font-semibold text-white text-sm mb-1">{activeTrip.destination_company_name || activeTrip.request?.destination_company_name || "Destination"}</div>
                        <div className="text-xs text-slate-500 line-clamp-2">{activeTrip.destination_address || activeTrip.request?.destination_address}</div>
                        <button
                          onClick={() => openGoogleMapsLocation(activeTrip.destination_lat || activeTrip.request?.destination_lat, activeTrip.destination_lng || activeTrip.request?.destination_lng, activeTrip.destination_address || activeTrip.request?.destination_address)}
                          className="mt-3 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md flex items-center gap-2 font-medium transition cursor-pointer"
                        >
                          <Navigation size={12}/> Navigate to Destination
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multi-Stop Part Load Consolidation Addresses Accordion / View */}
                {activeTrip.stops && activeTrip.stops.length > 0 && (
                  <div className="mb-6 rounded-xl border border-purple-500/40 bg-purple-950/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse"></span>
                        <h4 className="text-sm font-bold text-white">
                          Part Load Consolidated Stops ({activeTrip.stops.length} Total Addresses)
                        </h4>
                      </div>
                      <span className="text-xs font-mono font-bold text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded-full border border-purple-500/30">
                        Shared Truck Manifest
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {activeTrip.stops.map((stop: any, idx: number) => {
                        const isPickup = stop.stop_type === "PICKUP";
                        const isDone = stop.status === "COMPLETED";

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isDone
                                ? "bg-slate-900/40 border-slate-800 opacity-60"
                                : isPickup
                                ? "bg-blue-950/30 border-blue-800/60"
                                : "bg-emerald-950/30 border-emerald-800/60"
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                                  isPickup
                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                }`}
                              >
                                {stop.stop_sequence || idx + 1}
                              </span>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-white text-xs">{stop.company_name}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                      isPickup ? "bg-blue-900/60 text-blue-300" : "bg-emerald-900/60 text-emerald-300"
                                    }`}
                                  >
                                    {stop.stop_type}
                                  </span>
                                  {isDone && (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                                      COMPLETED
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono text-purple-300 font-semibold">
                                    {stop.cargo_weight_kg} kg
                                  </span>
                                </div>
                                <p className="text-slate-300 text-xs mt-1 leading-snug">{stop.address}</p>
                                {stop.contact_phone && (
                                  <p className="text-slate-400 text-[11px] mt-0.5">
                                    Contact: {stop.contact_person || 'Consignee'} ({stop.contact_phone})
                                  </p>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => openGoogleMapsLocation(stop.lat, stop.lng, stop.address)}
                              className="shrink-0 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-medium transition cursor-pointer"
                            >
                              <Navigation size={12} className="text-blue-400" />
                              <span>Map Nav</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 border-y border-slate-800 py-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                      <Package size={14}/> Cargo Type
                    </div>
                    <div className="text-white font-medium text-sm">{activeTrip.goods_type || activeTrip.request?.goods_type || "Cargo"}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                      <Package size={14}/> Weight
                    </div>
                    <div className="text-white font-medium text-sm">{activeTrip.weight_tons ?? activeTrip.request?.weight_tons ?? "0"} Tons</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                      <Truck size={14}/> Vehicle
                    </div>
                    <div className="text-white font-medium text-sm">{activeTrip.vehicle_registration || activeTrip.vehicle?.registration_number || "Assigned"}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                      <Wallet size={14}/> Payment Type
                    </div>
                    <div className="text-white font-medium text-sm flex items-center gap-2">
                       {activeTrip.payment_type || "UPI"} <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">{activeTrip.payment_status || "Pending"}</span>
                    </div>
                  </div>
                </div>

                {/* Progress Timeline */}
                <div className="relative pt-2 pb-6">
                  <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-800"></div>
                  
                  {/* Need to determine progress based on status */}
                  <div className="relative z-10 flex justify-between">
                     <div className="flex flex-col items-center">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center"></div>
                        <div className="text-[10px] text-emerald-400 mt-2 font-semibold">Assigned</div>
                     </div>
                     <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full border-4 border-slate-900 flex items-center justify-center ${["IN_TRANSIT", "ARRIVED", "DELIVERED", "COMPLETED", "POD_SUBMITTED"].includes(normalizeStatus(activeTrip.status)) ? "bg-emerald-500" : "bg-slate-700"}`}></div>
                        <div className={`text-[10px] mt-2 font-semibold ${["IN_TRANSIT", "ARRIVED", "DELIVERED", "COMPLETED", "POD_SUBMITTED"].includes(normalizeStatus(activeTrip.status)) ? "text-emerald-400" : "text-slate-500"}`}>In Transit</div>
                     </div>
                     <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full border-4 border-slate-900 flex items-center justify-center ${["ARRIVED", "DELIVERED", "COMPLETED", "POD_SUBMITTED"].includes(normalizeStatus(activeTrip.status)) ? "bg-emerald-500" : "bg-slate-700"}`}></div>
                        <div className={`text-[10px] mt-2 font-semibold ${["ARRIVED", "DELIVERED", "COMPLETED", "POD_SUBMITTED"].includes(normalizeStatus(activeTrip.status)) ? "text-emerald-400" : "text-slate-500"}`}>Arrived</div>
                     </div>
                     <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full border-4 border-slate-900 flex items-center justify-center ${["DELIVERED", "COMPLETED"].includes(normalizeStatus(activeTrip.status)) ? "bg-emerald-500" : "bg-slate-700"}`}></div>
                        <div className={`text-[10px] mt-2 font-semibold ${["DELIVERED", "COMPLETED"].includes(normalizeStatus(activeTrip.status)) ? "text-emerald-400" : "text-slate-500"}`}>Delivered</div>
                     </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 ${
                    gpsTrackingActive 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                      : gpsStatusText.includes("denied") || gpsStatusText.includes("unsupported")
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${gpsTrackingActive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                    <span>{gpsStatusText}</span>
                    {gpsLastCoords && (
                      <span className="text-[10px] text-slate-400 font-mono ml-1">
                        ({gpsLastCoords.lat.toFixed(4)}, {gpsLastCoords.lng.toFixed(4)}) · {gpsLastCoords.time}
                      </span>
                    )}
                  </div>

                  <button 
                    type="button"
                    disabled={updatingLocation}
                    onClick={handleUpdateLocation} 
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  >
                     <Navigation size={13} className={updatingLocation ? "animate-spin text-blue-400" : ""} />
                     {updatingLocation ? "Sending..." : "Sync GPS Now"}
                  </button>
                  {["DRIVER_ASSIGNED", "ASSIGNED"].includes(normalizeStatus(activeTrip.status)) && (
                    <button onClick={() => handleAction("start-pickup")} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition flex items-center gap-2 cursor-pointer">
                       Start Pickup
                    </button>
                  )}
                  {normalizeStatus(activeTrip.status) === "PICKUP_IN_PROGRESS" && (
                    <button 
                      onClick={() => {
                        if (!activeTrip.pickup_otp_verified && !pickupOtpStatus?.is_verified) {
                          alert("Customer Pickup OTP verification is required before starting transit. Please ask the customer for the 6-digit OTP displayed on their screen.");
                          return;
                        }
                        handleAction("start-transit");
                      }} 
                      className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition flex items-center gap-2 cursor-pointer ${
                        (activeTrip.pickup_otp_verified || pickupOtpStatus?.is_verified)
                          ? "bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-950/40"
                          : "bg-slate-700 hover:bg-slate-600 border border-slate-600 opacity-90"
                      }`}
                    >
                       {(activeTrip.pickup_otp_verified || pickupOtpStatus?.is_verified) ? "Start Transit" : "Verify Pickup OTP to Start Transit"}
                    </button>
                  )}
                  {normalizeStatus(activeTrip.status) === "IN_TRANSIT" && (
                    <button onClick={() => handleAction("arrive")} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition flex items-center gap-2 cursor-pointer">
                       <MapPin size={14}/> Arrive at Destination
                    </button>
                  )}
                  {normalizeStatus(activeTrip.status) === "ARRIVED" && (
                    <button 
                      onClick={() => {
                        if (!activeTrip.delivery_otp_verified && !activeTrip.otp_verified && !deliveryOtpStatus?.is_verified) {
                          alert("Recipient Delivery OTP verification is required before submitting Proof of Delivery (POD). Please verify the 6-digit OTP displayed on customer/recipient screen.");
                          return;
                        }
                        handleOpenPodModal();
                      }} 
                      className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition flex items-center gap-2 cursor-pointer shadow-lg ${
                        (activeTrip.delivery_otp_verified || activeTrip.otp_verified || deliveryOtpStatus?.is_verified)
                          ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40"
                          : "bg-slate-700 hover:bg-slate-600 border border-slate-600 opacity-90"
                      }`}
                    >
                       <ClipboardList size={14}/> 
                       {(activeTrip.delivery_otp_verified || activeTrip.otp_verified || deliveryOtpStatus?.is_verified) ? "Submit Proof of Delivery (POD)" : "Verify Delivery OTP to Submit POD"}
                    </button>
                  )}
                  {normalizeStatus(activeTrip.status) === "POD_SUBMITTED" && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                      <Clock size={14} className="animate-spin text-amber-400" />
                      POD Submitted — Awaiting Admin Verification
                    </div>
                  )}
                  {normalizeStatus(activeTrip.status) === "DELIVERED" && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      POD Verified & Delivered
                    </div>
                  )}
                </div>

                {/* Show Rejection Banner if POD was rejected */}
                {activeTrip.pod_rejection_reason && normalizeStatus(activeTrip.status) === "ARRIVED" && (
                  <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-200 text-xs">
                    <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">POD Rejected by Admin: </span>
                      {activeTrip.pod_rejection_reason}
                      <p className="mt-1 text-slate-300">Please verify details with receiver and resubmit POD above.</p>
                    </div>
                  </div>
                )}

                {/* SECURE PICKUP OTP HANDOVER VERIFICATION */}
                {["DRIVER_ASSIGNED", "ASSIGNED", "PICKUP_IN_PROGRESS"].includes(normalizeStatus(activeTrip.status)) && (
                  <div className={`mt-6 rounded-xl border-2 p-5 shadow-2xl relative overflow-hidden transition-all ${
                    (pickupOtpStatus?.is_verified || activeTrip.pickup_otp_verified)
                      ? "border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-950"
                      : "border-blue-500/40 bg-gradient-to-b from-slate-900 to-slate-950"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-lg ${
                            (pickupOtpStatus?.is_verified || activeTrip.pickup_otp_verified)
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}>
                            <ShieldCheck size={18} />
                          </span>
                          <h3 className="text-base font-bold text-white tracking-wide uppercase">
                            Pickup Verification (OTP)
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Ask the shipper/customer for the 6-digit Pickup OTP displayed on their screen before loading cargo.
                        </p>
                      </div>

                      {/* Pickup Status Badge */}
                      <div>
                        {(pickupOtpStatus?.is_verified || activeTrip.pickup_otp_verified) ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 size={13} className="text-emerald-400" />
                            {pickupOtpStatus?.is_admin_override
                              ? "Pickup Verified (Admin Override)"
                              : "Pickup OTP Confirmed"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            <KeyRound size={13} className="text-amber-400" />
                            Pickup OTP Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Pickup Contact
                        </span>
                        <p className="text-sm font-bold text-white mt-0.5">
                          {activeTrip.pickup_company_name || activeTrip.request?.customer_name || "Pickup Contact"}
                        </p>
                        <p className="text-xs text-blue-400 font-mono mt-1 flex items-center gap-1.5">
                          <Smartphone size={13} />
                          {pickupOtpStatus?.recipient_masked_phone || "Phone on file"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Pickup Location
                        </span>
                        <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
                          {activeTrip.pickup_address || "Pickup address"}
                        </p>
                      </div>
                    </div>

                    {/* Success or Input */}
                    {(pickupOtpStatus?.is_verified || activeTrip.pickup_otp_verified) ? (
                      <div className="mt-4 p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={22} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-200">
                            Pickup Verified Successfully
                          </p>
                          <p className="text-[11px] text-emerald-400/80 mt-0.5">
                            Cargo pickup verified. You can now start transit.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {pickupOtpError && (
                          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs">
                            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                            <span>{pickupOtpError}</span>
                          </div>
                        )}

                        {pickupOtpSuccess && (
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2 text-emerald-300 text-xs">
                            <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-400" />
                            <span>{pickupOtpSuccess}</span>
                          </div>
                        )}

                        <form onSubmit={handleVerifyPickupOTP} className="flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={pickupOtpInput}
                            onChange={(e) => setPickupOtpInput(e.target.value.replace(/\D/g, ""))}
                            placeholder="Enter 6-digit Pickup OTP from customer screen"
                            className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center tracking-[0.25em] text-base placeholder:tracking-normal placeholder:font-sans placeholder:text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          />
                          <button
                            type="submit"
                            disabled={verifyingPickupOtp || pickupOtpInput.trim().length !== 6}
                            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-blue-950/50 flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                          >
                            <ShieldCheck size={16} />
                            {verifyingPickupOtp ? "Verifying..." : "Verify Pickup OTP"}
                          </button>
                        </form>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>Ask customer to read the 6-digit code shown on their tracking page.</span>
                          {pickupOtpStatus?.attempts_remaining !== undefined && (
                            <span>{pickupOtpStatus.attempts_remaining} attempt(s) remaining</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SECURE DELIVERY OTP HANDOVER VERIFICATION */}
                {["ARRIVED", "POD_SUBMITTED", "DELIVERED"].includes(normalizeStatus(activeTrip.status)) && (
                  <div className={`mt-6 rounded-xl border-2 p-5 shadow-2xl relative overflow-hidden transition-all ${
                    (deliveryOtpStatus?.is_verified || activeTrip.delivery_otp_verified || activeTrip.otp_verified)
                      ? "border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-950"
                      : "border-blue-500/40 bg-gradient-to-b from-slate-900 to-slate-950"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-lg ${
                            (deliveryOtpStatus?.is_verified || activeTrip.delivery_otp_verified || activeTrip.otp_verified)
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}>
                            <ShieldCheck size={18} />
                          </span>
                          <h3 className="text-base font-bold text-white tracking-wide uppercase">
                            Recipient Delivery Verification (OTP)
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Ask recipient to read the 6-digit Delivery OTP displayed on their screen to confirm cargo handover.
                        </p>
                      </div>

                      {/* Handover Status Badge */}
                      <div>
                        {(deliveryOtpStatus?.is_verified || activeTrip.delivery_otp_verified || activeTrip.otp_verified) ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 size={13} className="text-emerald-400" />
                            {deliveryOtpStatus?.is_admin_override || activeTrip.otp_is_override
                              ? "Handover Verified (Admin Override)"
                              : "Handover OTP Confirmed"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            <KeyRound size={13} className="text-amber-400" />
                            Delivery OTP Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Masked Recipient Phone & Destination Reference */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Authorized Recipient
                        </span>
                        <p className="text-sm font-bold text-white mt-0.5">
                          {activeTrip.destination_contact_person || activeTrip.destination_company_name || "Authorized Receiver"}
                        </p>
                        <p className="text-xs text-blue-400 font-mono mt-1 flex items-center gap-1.5">
                          <Smartphone size={13} />
                          {deliveryOtpStatus?.recipient_masked_phone || "Phone on file"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Destination Address
                        </span>
                        <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
                          {activeTrip.destination_address || "Delivery destination"}
                        </p>
                      </div>
                    </div>

                    {/* Success banner if verified */}
                    {(deliveryOtpStatus?.is_verified || activeTrip.delivery_otp_verified || activeTrip.otp_verified) ? (
                      <div className="mt-4 p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={22} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-200">
                            Delivery Handover Verified Successfully
                          </p>
                          <p className="text-[11px] text-emerald-400/80 mt-0.5">
                            Handover verified on {deliveryOtpStatus?.verified_at ? new Date(deliveryOtpStatus.verified_at).toLocaleTimeString() : "arrival"}. You can now proceed to submit Proof of Delivery (POD).
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Verification Input */
                      <div className="mt-4 space-y-3">
                        {deliveryOtpError && (
                          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs">
                            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                            <span>{deliveryOtpError}</span>
                          </div>
                        )}

                        {deliveryOtpSuccess && (
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2 text-emerald-300 text-xs">
                            <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-400" />
                            <span>{deliveryOtpSuccess}</span>
                          </div>
                        )}

                        <form onSubmit={handleVerifyDeliveryOTP} className="flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={deliveryOtpInput}
                            onChange={(e) => setDeliveryOtpInput(e.target.value.replace(/\D/g, ""))}
                            placeholder="Enter 6-digit Delivery OTP from recipient"
                            className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center tracking-[0.25em] text-base placeholder:tracking-normal placeholder:font-sans placeholder:text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          />
                          <button
                            type="submit"
                            disabled={verifyingDeliveryOtp || deliveryOtpInput.trim().length !== 6}
                            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-blue-950/50 flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                          >
                            <ShieldCheck size={16} />
                            {verifyingDeliveryOtp ? "Verifying..." : "Verify Delivery OTP"}
                          </button>
                        </form>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>Ask recipient to read the 6-digit code shown on their tracking page.</span>
                          {deliveryOtpStatus?.attempts_remaining !== undefined && (
                            <span>{deliveryOtpStatus.attempts_remaining} attempt(s) remaining</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* RAPIDO / UBER-STYLE ARRIVAL COLLECT CUSTOMER PAYMENT SECTION */}
                {["ARRIVED", "POD_SUBMITTED", "DELIVERED"].includes(normalizeStatus(activeTrip.status)) && (
                  <div className="mt-8 rounded-xl border-2 border-emerald-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                            <IndianRupee size={18} />
                          </span>
                          <h3 className="text-base font-bold text-white tracking-wide uppercase">
                            Collect Customer Payment
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Direct merchant settlement to CargoExpress Logistics corporate current account.
                        </p>
                      </div>

                      {/* State Badge */}
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ${
                          paymentState === "Payment Successful"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : paymentState === "Waiting for Payment"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse"
                            : paymentState === "Payment Failed"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            : paymentState === "Payment Partially Completed"
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        }`}>
                          ● {paymentState}
                        </span>
                      </div>
                    </div>

                    {/* Financial Summary Ledger Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-5 p-4 rounded-lg bg-slate-900/90 border border-slate-800/80">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Customer</span>
                        <span className="text-xs font-bold text-slate-200 truncate block mt-0.5">
                          {activeTrip.customer_name || activeTrip.pickup_company_name || activeTrip.request?.pickup_company_name || "Valued Client"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Invoice Total</span>
                        <span className="text-xs font-bold text-slate-200 block mt-0.5">
                          ₹{activeTrip.invoice_total_amount ? parseFloat(activeTrip.invoice_total_amount).toFixed(2) : (activeTrip.amount_due_for_collection ? parseFloat(activeTrip.amount_due_for_collection).toFixed(2) : "0.00")}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Amount Paid</span>
                        <span className="text-xs font-bold text-emerald-400 block mt-0.5">
                          ₹{activeTrip.invoice_paid_amount ? parseFloat(activeTrip.invoice_paid_amount).toFixed(2) : "0.00"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Balance Due</span>
                        <span className="text-base font-extrabold text-white block mt-0.5">
                          ₹{activeTrip.amount_due_for_collection ? parseFloat(activeTrip.amount_due_for_collection).toFixed(2) : "0.00"}
                        </span>
                      </div>
                    </div>

                    {/* Payment Type Selection & Action */}
                    {parseFloat(activeTrip.amount_due_for_collection || "0") > 0 ? (
                      <div className="space-y-4">
                        {/* Payment Type Tabs */}
                        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setPaymentType("UPI")}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                              paymentType === "UPI"
                                ? "bg-emerald-600 text-white shadow"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <QrCode size={16} /> Pay Online / UPI (CargoExpress)
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentType("CASH")}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                              paymentType === "CASH"
                                ? "bg-blue-600 text-white shadow"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <IndianRupee size={16} /> Pay Cash on Delivery
                          </button>
                        </div>

                        {/* UPI Payment Flow */}
                        {paymentType === "UPI" && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                disabled={initiatingPayment}
                                onClick={handlePayCargoXNow}
                                className="flex-1 min-w-[200px] py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                              >
                                <QrCode size={18} />
                                {initiatingPayment ? "Generating CargoExpress Payment..." : "Generate Payment QR / Pay CargoExpress Now"}
                              </button>

                              <button
                                type="button"
                                disabled={checkingStatus}
                                onClick={handleCheckPaymentStatus}
                                className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition cursor-pointer"
                              >
                                <RotateCw size={14} className={checkingStatus ? "animate-spin text-emerald-400" : ""} />
                                Check Status
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Cash on Delivery Flow */}
                        {paymentType === "CASH" && (
                          <form onSubmit={handleRecordCash} className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
                            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
                              <IndianRupee size={16} /> Record Customer Cash Payment
                            </div>
                            <p className="text-xs text-slate-400">
                              Collect cash directly from the customer. Once recorded, the invoice will be marked paid and the trip will complete.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Cash Amount Received (₹)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={cashAmount}
                                  placeholder={parseFloat(activeTrip.amount_due_for_collection || "0").toFixed(2)}
                                  onChange={(e) => setCashAmount(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                                />
                                <span className="text-[10px] text-slate-500 mt-1 block">
                                  Full amount: ₹{parseFloat(activeTrip.amount_due_for_collection || "0").toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Receipt / Reference # (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={cashRef}
                                  placeholder={`CASH-${Date.now().toString().slice(-6)}`}
                                  onChange={(e) => setCashRef(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                            <button
                              type="submit"
                              disabled={recordingCash}
                              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <CheckCircle2 size={16} />
                              {recordingCash ? "Recording Cash & Completing Trip..." : `Confirm Cash Payment Received (₹${cashAmount ? parseFloat(cashAmount).toFixed(2) : parseFloat(activeTrip.amount_due_for_collection || "0").toFixed(2)})`}
                            </button>
                          </form>
                        )}

                        {/* Customer Dynamic Payment Display */}
                        {(paymentState === "QR Ready" || paymentState === "Waiting for Payment") && (paymentOrder || activeTrip.qr_image_url) && (
                          <div className="p-5 rounded-xl bg-white text-slate-900 shadow-2xl flex flex-col md:flex-row items-center gap-6 mt-4">
                            <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-200 shrink-0 text-center">
                              <img
                                src={paymentOrder?.qr_image_url || activeTrip.qr_image_url}
                                alt="CargoExpress Corporate UPI QR"
                                className="w-48 h-48 mx-auto object-contain"
                              />
                              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mt-2">
                                Scan with any UPI app
                              </span>
                            </div>

                            <div className="flex-1 space-y-2 text-center md:text-left">
                              <div className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded uppercase tracking-wider">
                                Official CargoExpress Beneficiary
                              </div>
                              <h4 className="text-lg font-black text-slate-950">
                                {paymentOrder?.business_name || activeTrip.business_name || "CargoExpress Logistics"}
                              </h4>
                              <p className="text-xs text-slate-600 font-mono">
                                UPI: <span className="font-bold text-slate-900">{paymentOrder?.cargox_upi_id || activeTrip.cargox_upi_id || "CargoExpress Current Account"}</span>
                              </p>
                              <p className="text-xs text-slate-600">
                                Invoice: <span className="font-bold text-slate-900">{activeTrip.invoice_number || "CX-INV"}</span>
                              </p>
                              <div className="text-2xl font-black text-emerald-700 py-1">
                                ₹{parseFloat(activeTrip.amount_due_for_collection || "0").toFixed(2)}
                              </div>

                              <div className="flex flex-wrap gap-2 pt-2">
                                {(paymentOrder?.upi_uri || activeTrip.upi_uri) && (
                                  <a
                                    href={paymentOrder?.upi_uri || activeTrip.upi_uri}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                                  >
                                    <ExternalLink size={12} /> Open UPI App
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={handleCopyPaymentLink}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-slate-300 transition cursor-pointer"
                                >
                                  <Copy size={12} /> Copy Payment Link
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCheckPaymentStatus}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <RotateCw size={12} /> Verify Payment
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                          <CheckCircle2 size={24} />
                        </div>
                        <h4 className="text-sm font-bold text-emerald-200">Payment Fully Completed</h4>
                        <p className="text-xs text-emerald-400/80">
                          Invoice #{activeTrip.invoice_number || "CX-INV"} is settled in full. Trip completes automatically once delivery is confirmed.
                        </p>
                      </div>
                    )}
                  </div>
                )}

              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-slate-400">You have no active deliveries.</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
               <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Activity</h2>
               <button className="text-xs text-blue-400 font-semibold">View All</button>
            </div>
            
            <div className="space-y-4">
               {activeTrip ? (
                 <>
                   <div className="flex gap-4 items-start">
                     <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20"></div>
                     <div className="flex-1">
                       <div className="flex justify-between">
                         <p className="text-sm font-semibold text-white">Trip Assigned</p>
                         <span className="text-xs text-slate-500">Today</span>
                       </div>
                       <p className="text-xs text-slate-400 mt-1">Trip assigned to you</p>
                     </div>
                   </div>
                 </>
               ) : (
                 <p className="text-xs text-slate-500">No recent activity.</p>
               )}
            </div>
          </div>
        </div>

        {/* Right Column: Tracking & Details */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-sm font-bold text-white tracking-wider uppercase">Route & Tracking</h2>
               <button
                 onClick={() => {
                   if (!activeTrip) return;
                   openGoogleMapsRoute(
                     activeTrip.pickup_lat || activeTrip.request?.pickup_lat,
                     activeTrip.pickup_lng || activeTrip.request?.pickup_lng,
                     activeTrip.pickup_address || activeTrip.request?.pickup_address,
                     activeTrip.destination_lat || activeTrip.request?.destination_lat,
                     activeTrip.destination_lng || activeTrip.request?.destination_lng,
                     activeTrip.destination_address || activeTrip.request?.destination_address
                   );
                 }}
                 className="text-xs text-blue-400 border border-blue-400/30 rounded px-2 py-1 hover:bg-blue-400/10 cursor-pointer"
               >
                 Open in Maps
               </button>
            </div>
            
            <div className="rounded-lg overflow-hidden border border-slate-700 h-64 bg-slate-800 relative flex items-center justify-center">
               <MapContainer center={[17.3850, 78.4867]} zoom={6} scrollWheelZoom={false} className="h-full w-full z-0">
                  <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {activeTrip && (activeTrip.pickup_lat || activeTrip.request?.pickup_lat) && (activeTrip.destination_lat || activeTrip.request?.destination_lat) && (
                     <>
                        <CircleMarker center={[activeTrip.pickup_lat || activeTrip.request.pickup_lat, activeTrip.pickup_lng || activeTrip.request.pickup_lng]} radius={6} color="#3b82f6" fillColor="#3b82f6" fillOpacity={1}></CircleMarker>
                        <CircleMarker center={[activeTrip.destination_lat || activeTrip.request.destination_lat, activeTrip.destination_lng || activeTrip.request.destination_lng]} radius={6} color="#ef4444" fillColor="#ef4444" fillOpacity={1}></CircleMarker>
                     </>
                  )}
               </MapContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Trip Details</h2>
            <div className="space-y-3 text-sm">
               <div className="grid grid-cols-[120px_1fr] gap-2">
                 <div className="text-slate-500 flex items-center gap-2"><ClipboardList size={14}/> Order Number</div>
                 <div className="text-white font-medium">{activeTrip?.request_number || activeTrip?.request?.request_number || "—"}</div>
               </div>
               <div className="grid grid-cols-[120px_1fr] gap-2">
                 <div className="text-slate-500 flex items-center gap-2"><Truck size={14}/> Trip Number</div>
                 <div className="text-white font-medium">{activeTrip?.trip_id ? `CX-${String(activeTrip.trip_id).slice(-8).toUpperCase()}` : (activeTrip?.id ? `CX-${String(activeTrip.id).padStart(4, '0')}` : "—")}</div>
               </div>
               <div className="grid grid-cols-[120px_1fr] gap-2">
                 <div className="text-slate-500 flex items-center gap-2"><MapPin className="text-blue-500" size={14}/> Pickup</div>
                 <div className="text-white">{activeTrip?.pickup_address || activeTrip?.request?.pickup_address || "—"}</div>
               </div>
               <div className="grid grid-cols-[120px_1fr] gap-2">
                 <div className="text-slate-500 flex items-center gap-2"><MapPin className="text-red-500" size={14}/> Destination</div>
                 <div className="text-white">{activeTrip?.destination_address || activeTrip?.request?.destination_address || "—"}</div>
               </div>
               <div className="grid grid-cols-[120px_1fr] gap-2 pt-2 border-t border-slate-800">
                 <div className="text-slate-500 flex items-center gap-2"><Activity size={14}/> Distance</div>
                 <div className="text-white">{(activeTrip?.distance_km ?? activeTrip?.request?.distance_km) ? `${activeTrip?.distance_km ?? activeTrip?.request?.distance_km} km` : "—"}</div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCurrentOrders = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Current Orders</h2>
      {activeTrip ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
           <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <div>
                 <p className="text-sm text-slate-400">Order #{activeTrip.request_number || activeTrip.booking_id || "ORD"}</p>
                 <p className="text-xl font-bold text-white">Trip #{activeTrip.request_number || activeTrip.request?.request_number || String(activeTrip.trip_id || activeTrip.id).slice(-8).toUpperCase()}</p>
              </div>
              <StatusBadge status={activeTrip.status} />
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                 <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pickup</p>
                 <p className="text-white text-sm">{activeTrip.pickup_address || activeTrip.request?.pickup_address}</p>
              </div>
              <div>
                 <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Destination</p>
                 <p className="text-white text-sm">{activeTrip.destination_address || activeTrip.request?.destination_address}</p>
              </div>
           </div>
        </div>
      ) : (
        <p className="text-slate-400">No active orders.</p>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Previous Orders</h2>
      <div className="space-y-4">
        {history.length > 0 ? history.map((trip: any) => (
          <div key={trip.trip_id || trip.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col md:flex-row justify-between gap-4">
             <div>
                <p className="font-bold text-white text-lg">Trip #{trip.request_number || trip.request?.request_number || trip.trip_id || trip.id}</p>
                <p className="text-sm text-slate-400 mt-1">{trip.pickup_address || trip.request?.pickup_address || "Pickup"} → {trip.destination_address || trip.request?.destination_address || "Destination"}</p>
                <p className="text-xs text-slate-500 mt-2">Cargo: {trip.goods_type || trip.request?.goods_type} | Weight: {trip.weight_tons ?? trip.request?.weight_tons}t</p>
             </div>
             <div className="text-left md:text-right flex flex-col justify-between">
                <div><StatusBadge status={trip.status} /></div>
                <div className="mt-3 text-sm text-slate-300">
                   Payment: <span className="text-white font-medium">{trip.payment_status || "Completed"}</span> ({trip.payment_type || "UPI"})
                </div>
             </div>
          </div>
        )) : (
          <p className="text-slate-400">No previous orders found.</p>
        )}
      </div>
    </div>
  );

  const renderTracking = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Route & Tracking</h2>
      {activeTrip ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 h-[600px]">
           <MapContainer center={[17.3850, 78.4867]} zoom={6} scrollWheelZoom={false} className="h-full w-full rounded-lg">
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {activeTrip.request?.pickup_lat && activeTrip.request?.destination_lat && (
                 <>
                    <CircleMarker center={[activeTrip.request.pickup_lat, activeTrip.request.pickup_lng]} radius={8} color="#3b82f6" fillColor="#3b82f6" fillOpacity={1}></CircleMarker>
                    <CircleMarker center={[activeTrip.request.destination_lat, activeTrip.request.destination_lng]} radius={8} color="#ef4444" fillColor="#ef4444" fillOpacity={1}></CircleMarker>
                 </>
              )}
           </MapContainer>
        </div>
      ) : (
        <p className="text-slate-400">No active tracking available.</p>
      )}
    </div>
  );

  const renderPayments = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Payments</h2>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 max-w-2xl">
         <p className="text-sm text-slate-400 mb-6">Payment information is restricted to operational status only. For settlement details, contact dispatch.</p>
         
         <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-800">
               <span className="text-slate-300">Payment Type</span>
               <span className="font-bold text-white bg-slate-800 px-3 py-1 rounded">{activeTrip?.payment_type || "Not Specified"}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-800">
               <span className="text-slate-300">Current Status</span>
               <StatusBadge status={activeTrip?.payment_status || "PENDING"} />
            </div>
         </div>
      </div>
    </div>
  );

  const renderVehicleDocuments = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="text-blue-400" size={24} /> Vehicle Documents & Compliance
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Official CargoExpress Fleet driver compliance registry and verified permits.
          </p>
        </div>
        <CargoExpressLogo variant="badge" size="sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold">
              <FileCheck className="text-emerald-400" size={18} /> Commercial Driving License
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              VERIFIED
            </span>
          </div>
          <p className="text-xs text-slate-400">Class: Heavy Goods Vehicle (HGV / Multi-Axle)</p>
          <div className="p-3 bg-slate-950/60 rounded-lg text-xs font-mono text-slate-300 flex justify-between">
            <span>Doc ID: DL-IND-884210</span>
            <span className="text-emerald-400">Valid: 2028-12-31</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold">
              <ShieldCheck className="text-blue-400" size={18} /> Fleet Vehicle RC Book
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              ACTIVE
            </span>
          </div>
          <p className="text-xs text-slate-400">Registered to: CargoExpress Logistics Fleet India</p>
          <div className="p-3 bg-slate-950/60 rounded-lg text-xs font-mono text-slate-300 flex justify-between">
            <span>Reg: {activeTrip?.vehicle_number || "MH 12 QX 4901"}</span>
            <span className="text-slate-400">Fitness: OK</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold">
              <ShieldAlert className="text-purple-400" size={18} /> Comprehensive Transit Insurance
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              COVERED
            </span>
          </div>
          <p className="text-xs text-slate-400">Coverage: Goods in transit & 3rd-party freight protection</p>
          <div className="p-3 bg-slate-950/60 rounded-lg text-xs font-mono text-slate-300 flex justify-between">
            <span>Policy: CXP-INS-90432</span>
            <span className="text-purple-300">₹25,00,000</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHelpSupport = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <HelpCircle className="text-emerald-400" size={24} /> CargoExpress Driver Help & Support
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            24/7 Priority dispatch assistance and operations command center.
          </p>
        </div>
        <CargoExpressLogo variant="full" size="sm" showTagline={true} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Phone className="text-emerald-400" size={18} /> Dispatch Operations Hotline
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Need emergency route clearance, toll allowance approval, or delivery consignee assistance?
          </p>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Toll-Free Dispatch:</span>
              <a href="tel:18002660000" className="text-emerald-400 font-bold hover:underline">1800-266-0000</a>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Emergency SOS:</span>
              <a href="tel:+919876543210" className="text-rose-400 font-bold hover:underline">+91 98765 43210</a>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Mail className="text-blue-400" size={18} /> Support Desk & Settlements
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Questions regarding daily trip allowances, UPI payments, or settlement statements.
          </p>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Support Desk:</span>
              <a href="mailto:support@cargoexpress.com" className="text-blue-400 font-bold hover:underline">support@cargoexpress.com</a>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Settlements:</span>
              <a href="mailto:settlements@cargoexpress.com" className="text-emerald-400 font-bold hover:underline">settlements@cargoexpress.com</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="fade-in max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between max-w-2xl">
        <h2 className="text-2xl font-bold text-white">Driver Profile</h2>
        <CargoExpressLogo variant="badge" size="sm" />
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 max-w-2xl">
         <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-500 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-900/30">
               {user?.firstName?.[0] || profile?.email?.[0]?.toUpperCase() || "D"}
            </div>
            <div>
               <h3 className="text-xl font-bold text-white">{user?.fullName || profile?.email || "Driver Name"}</h3>
               <p className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5 mt-0.5">
                 <ShieldCheck size={16} /> Verified CargoExpress Fleet Driver
               </p>
            </div>
         </div>
         
          <div className="space-y-4 pt-4 border-t border-slate-800 text-sm">
            <div className="grid grid-cols-[150px_1fr]">
               <span className="text-slate-500">Fleet Organization</span>
               <span className="text-slate-200 font-semibold">CargoExpress Logistics Fleet</span>
            </div>
            <div className="grid grid-cols-[150px_1fr]">
               <span className="text-slate-500">Email</span>
               <span className="text-slate-200">{user?.primaryEmailAddress?.emailAddress || profile?.email}</span>
            </div>
            <div className="grid grid-cols-[150px_1fr]">
               <span className="text-slate-500">Account Status</span>
               <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                 <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Active & On-Duty
               </span>
            </div>
            <div className="grid grid-cols-[150px_1fr]">
               <span className="text-slate-500">Driver Tagline</span>
               <span className="text-slate-400 italic">“Fast • Reliable • Everywhere”</span>
            </div>
         </div>
      </div>
    </div>
  );

  const contentMap: Record<string, any> = {
    Dashboard: renderDashboard(),
    "Current Orders": renderCurrentOrders(),
    "Previous Orders": renderHistory(),
    Tracking: renderTracking(),
    Payments: renderPayments(),
    "Vehicle Documents": renderVehicleDocuments(),
    "Help & Support": renderHelpSupport(),
    Profile: renderProfile(),
  };

  // Render appropriate view based on activeScreen or bottom navigation currentTab
  const renderReferenceContent = () => {
    if (activeScreen === 'order-details' && selectedOrderForDetails) {
      return (
        <DriverOrderDetailsScreen
          order={selectedOrderForDetails}
          onBack={() => setActiveScreen('all-orders')}
          onNavigateToActiveOrder={() => {
            setActiveTrip(selectedOrderForDetails);
            setActiveScreen('active-order');
          }}
        />
      );
    }

    if (activeScreen === 'active-order') {
      return (
        <DriverActiveOrderScreen
          activeTrip={activeTrip}
          onBack={() => {
            setActiveScreen('dashboard');
            setCurrentTab('home');
          }}
          onRefreshTrip={loadDriverData}
          onOpenPODModal={handleOpenPodModal}
          onOpenPaymentModal={() => handlePayCargoXNow()}
        />
      );
    }

    if (activeScreen === 'documents') {
      return (
        <DriverVehicleDocumentsScreen
          onBack={() => {
            setActiveScreen('dashboard');
            setCurrentTab('home');
          }}
        />
      );
    }

    if (activeScreen === 'profile') {
      return (
        <DriverProfileScreen
          onBack={() => {
            setActiveScreen('dashboard');
            setCurrentTab('home');
          }}
          driverName={profile?.name || user?.fullName || user?.firstName || 'Assigned Driver'}
          driverAvatar={profile?.avatar_url || user?.imageUrl}
          driverEmail={profile?.email || user?.primaryEmailAddress?.emailAddress || '—'}
          driverPhone={profile?.phone ? `+91 ${profile.phone}` : '—'}
          rating={4.9}
          completedTripsCount={history.length}
          isOnDuty={isOnDuty}
          vehicleModel={activeTrip?.vehicle_type || profile?.vehicle_type || 'Commercial Fleet Vehicle'}
          vehicleNumber={activeTrip?.vehicle_registration || profile?.vehicle_registration || 'Fleet Vehicle'}
          licenseNumber={profile?.license_number || '—'}
          onNavigateToDocuments={() => setActiveScreen('documents')}
          onNavigateToEarnings={() => {
            setCurrentTab('earnings');
            setActiveScreen('earnings');
          }}
          onNavigateToSupport={() => setActiveScreen('help')}
        />
      );
    }

    if (activeScreen === 'help') {
      return (
        <DriverHelpSupportScreen
          onBack={() => {
            setActiveScreen('dashboard');
            setCurrentTab('home');
          }}
        />
      );
    }

    if (currentTab === 'orders' || activeScreen === 'all-orders') {
      return (
        <DriverAllOrdersScreen
          onBack={() => {
            setCurrentTab('home');
            setActiveScreen('dashboard');
          }}
          onOpenHelp={() => setActiveScreen('help')}
          orders={activeTrip ? [activeTrip, ...history] : history}
          onSelectOrder={(order) => {
            setSelectedOrderForDetails(order);
            setActiveScreen('order-details');
          }}
        />
      );
    }

    if (currentTab === 'earnings' || activeScreen === 'earnings') {
      return (
        <DriverEarningsScreen
          onBack={() => {
            setCurrentTab('home');
            setActiveScreen('dashboard');
          }}
          settlements={settlements}
        />
      );
    }

    // Default: Screen 2 / 3 Driver Home Dashboard (Off Duty / On Duty)
    return (
      <DriverHomeDashboard
        driverName={profile?.name || user?.fullName || user?.firstName || 'Assigned Driver'}
        driverAvatar={profile?.avatar_url || user?.imageUrl}
        rating={4.9}
        completedTripsCount={history.length}
        isOnDuty={isOnDuty}
        onToggleDuty={handleToggleDuty}
        todayEarnings={activeTrip ? parseFloat(activeTrip.amount_due_for_collection || 0) : 0}
        todayOrdersCount={activeTrip ? 1 : 0}
        acceptanceRate="95%"
        activeTrip={activeTrip}
        onNavigateToTab={(tab) => {
          if (tab === 'orders') {
            setCurrentTab('orders');
            setActiveScreen('all-orders');
          } else if (tab === 'earnings') {
            setCurrentTab('earnings');
            setActiveScreen('earnings');
          } else if (tab === 'documents') {
            setActiveScreen('documents');
          } else if (tab === 'more') {
            setIsProfileDrawerOpen(true);
          } else if (tab === 'active-order') {
            setActiveScreen('active-order');
          }
        }}
        onOpenProfileDrawer={() => setIsProfileDrawerOpen(true)}
        gpsCoords={gpsLastCoords}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#0A1120] text-slate-900 py-0 sm:py-8 flex justify-center items-start">
      {/* Mobile Device Frame Container (Matches Customer Mobile Viewport) */}
      <div className="w-full max-w-[430px] min-h-screen sm:min-h-[880px] bg-white sm:rounded-[40px] shadow-[0_25px_70px_rgba(0,0,0,0.55)] border-0 sm:border-[8px] sm:border-slate-800/90 relative flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 min-h-[500px]">
            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Connecting to CargoExpress Dispatch...
            </span>
          </div>
        ) : (
          <div className="flex-1">
            {renderReferenceContent()}
          </div>
        )}

        {/* Persistent Bottom Navigation (Home, Orders, Earnings, More) */}
        {activeScreen !== 'order-details' && activeScreen !== 'active-order' && (
          <DriverBottomNavigation
            currentTab={currentTab}
            onSelectTab={(tab) => {
              if (tab === 'more') {
                setIsProfileDrawerOpen(true);
              } else {
                setCurrentTab(tab);
                if (tab === 'home') setActiveScreen('dashboard');
                if (tab === 'orders') setActiveScreen('all-orders');
                if (tab === 'earnings') setActiveScreen('earnings');
              }
            }}
            hasActiveOrder={!!activeTrip}
          />
        )}

        {/* Reference Profile Drawer (Screen 7) */}
        <DriverProfileDrawer
          isOpen={isProfileDrawerOpen}
          onClose={() => setIsProfileDrawerOpen(false)}
          driverName={profile?.name || user?.fullName || user?.firstName || 'Assigned Driver'}
          driverAvatar={profile?.avatar_url || user?.imageUrl}
          rating={4.9}
          completedTripsCount={history.length}
          onSelectMenuItem={(itemKey: DriverMenuItemKey) => {
            setIsProfileDrawerOpen(false);
            if (itemKey === 'profile') {
              setActiveScreen('profile');
            } else if (itemKey === 'earnings') {
              setCurrentTab('earnings');
              setActiveScreen('earnings');
            } else if (itemKey === 'documents') {
              setActiveScreen('documents');
            } else if (itemKey === 'help' || itemKey === 'support') {
              setActiveScreen('help');
            } else if (itemKey === 'incentives') {
              setInAppModalData({
                title: 'Driver Incentives',
                subtitle: 'Weekly Performance Bonus',
                badge: 'Active Reward',
                icon: <Gift size={24} className="text-emerald-600" />,
                content: (
                  <div className="space-y-2">
                    <p className="font-semibold text-slate-800">
                      Complete 15 weekly deliveries on time to unlock a <span className="text-emerald-600 font-extrabold">₹2,500</span> fleet bonus.
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-500 text-[11px]">
                      <li>Maintain ≥ 90% acceptance rate</li>
                      <li>Zero customer damage complaints</li>
                      <li>Payout automatically credited to your Earnings every Monday</li>
                    </ul>
                  </div>
                ),
                actionText: 'Got It'
              });
            } else if (itemKey === 'rewards') {
              setInAppModalData({
                title: 'Driver Rewards & Insurance',
                subtitle: 'Comprehensive Partner Coverage',
                badge: 'Verified Protection',
                icon: <Award size={24} className="text-amber-500" />,
                content: (
                  <div className="space-y-2">
                    <p className="font-semibold text-slate-800">
                      Active drivers are fully covered under CargoExpress Transit Insurance.
                    </p>
                    <div className="rounded-xl bg-white p-3 border border-slate-200/80 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Accident Insurance:</span>
                        <span className="font-bold text-slate-900">₹10 Lakhs</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Fuel Discount (HPCL/IOCL):</span>
                        <span className="font-bold text-emerald-600">3.5% Cashback</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Tire Replacement Assistance:</span>
                        <span className="font-bold text-slate-900">Partner Rates</span>
                      </div>
                    </div>
                  </div>
                ),
                actionText: 'Close'
              });
            } else if (itemKey === 'demand') {
              setInAppModalData({
                title: 'Demand Planner',
                subtitle: 'High Surge Freight Zones',
                badge: 'Surge Active',
                icon: <TrendingUp size={24} className="text-blue-600" />,
                content: (
                  <div className="space-y-2">
                    <p className="font-semibold text-slate-800">
                      High shipment surge active around major industrial corridors. Head to these hubs to receive higher booking frequency:
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                        <span className="font-medium text-slate-800">Secunderabad / Bowenpally</span>
                        <span className="text-emerald-600 font-bold text-[11px]">1.4x Surge</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                        <span className="font-medium text-slate-800">Miyapur & Patancheru</span>
                        <span className="text-emerald-600 font-bold text-[11px]">1.3x Surge</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                        <span className="font-medium text-slate-800">Quthbullapur Corridor</span>
                        <span className="text-blue-600 font-bold text-[11px]">1.2x Surge</span>
                      </div>
                    </div>
                  </div>
                ),
                actionText: 'Explore Map'
              });
            } else if (itemKey === 'referrals') {
              setInAppModalData({
                title: 'Refer & Earn',
                subtitle: 'Invite Commercial Truck Drivers',
                badge: 'Earn ₹5,500',
                icon: <Users size={24} className="text-purple-600" />,
                content: (
                  <div className="space-y-2.5">
                    <p className="font-semibold text-slate-800">
                      Invite verified commercial truck drivers to join the CargoExpress fleet!
                    </p>
                    <div className="rounded-xl bg-purple-50/70 p-3 border border-purple-100 text-center">
                      <span className="text-[10px] uppercase font-bold text-purple-600">Your Referral Code</span>
                      <div className="text-base font-black text-purple-950 tracking-widest mt-0.5">
                        {profile?.driver_id || 'CGRX-DRIVER'}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      You receive <span className="font-bold text-slate-800">₹5,500</span> directly in your wallet once your referred driver completes 10 verified trips.
                    </p>
                  </div>
                ),
                actionText: 'Copy Code & Share',
                onAction: () => {
                  navigator.clipboard.writeText(profile?.driver_id || 'CGRX-DRIVER');
                  setInAppModalData(null);
                }
              });
            } else {
              setActiveScreen('profile');
            }
          }}
        />

        {/* In-App Styled Notification Modal */}
        <InAppModal
          isOpen={!!inAppModalData}
          onClose={() => setInAppModalData(null)}
          data={inAppModalData}
        />
      </div>

      {/* Proof of Delivery (POD) Modal */}
      {podModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Step 5 · Delivery Verification</p>
                <h3 className="text-lg font-bold text-white mt-0.5">Submit Proof of Delivery (POD)</h3>
              </div>
              <button
                type="button"
                onClick={() => setPodModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPodForm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Recipient Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
                  placeholder="Person who physically received goods (e.g. Ramesh Sharma)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Full legal name of the receiver at destination (alphabets only).</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Recipient Phone (Optional)
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {recipientPhone.length}/10 digits entered
                </span>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
                <input
                  type="checkbox"
                  id="deliveryConfirm"
                  checked={deliveryConfirmed}
                  onChange={(e) => setDeliveryConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="deliveryConfirm" className="text-xs text-slate-300 leading-relaxed cursor-pointer">
                  <span className="font-bold text-white">Delivery Handover Confirmation:</span> I confirm that all listed freight items have been securely handed over to the authorized recipient.
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Delivery Notes / Exceptions (Optional)
                </label>
                <textarea
                  rows={2}
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="e.g. Received 50 pallets intact, seal #CX9931 verified"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPodModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPod || !recipientName.trim() || !deliveryConfirmed}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-emerald-950/50 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  {submittingPod ? "Submitting POD..." : "Confirm & Submit POD"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
