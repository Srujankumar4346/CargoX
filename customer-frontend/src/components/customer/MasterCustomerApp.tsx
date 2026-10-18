import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/react";
import WelcomeScreen from "./WelcomeScreen";
import CustomerHomeScreen from "./CustomerHomeScreen";
import SelectPickupLocationScreen from "./SelectPickupLocationScreen";
import SelectDropLocationScreen from "./SelectDropLocationScreen";
import CargoDetailsScreen from "./CargoDetailsScreen";
import ChooseVehicleScreen, { type VehicleOption } from "./ChooseVehicleScreen";
import PriceQuoteScreen from "./PriceQuoteScreen";
import BookingSummaryScreen from "./BookingSummaryScreen";
import BookingConfirmationScreen from "./BookingConfirmationScreen";
import LiveTrackingScreen from "./LiveTrackingScreen";
import MyBookingsScreen, { type BookingItem } from "./MyBookingsScreen";
import ProfileSettingsScreen from "./ProfileSettingsScreen";
import MobileBottomNav, { type TabType } from "./MobileBottomNav";
import QuickPriceCalculatorModal from "./QuickPriceCalculatorModal";
import { api } from "../../services/api";
import { generateInvoicePDF } from "../../utils/invoicePDF";

export type CustomerFlowScreen =
  | "welcome"           // Screen 1
  | "home"              // Screen 2
  | "pickup"            // Screen 3
  | "drop"              // Screen 4
  | "cargo"             // Screen 5
  | "vehicle"           // Screen 6
  | "quote"             // Screen 7
  | "summary"           // Screen 8
  | "confirmation"      // Screen 9
  | "tracking"          // Screen 10
  | "bookings"          // Screen 11
  | "profile";          // Screen 12

export default function MasterCustomerApp() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  // Screen & Navigation state
  const [currentScreen, setCurrentScreen] = useState<CustomerFlowScreen>("welcome");
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // Booking Flow Data — distance/duration are null until a real OSRM route is calculated
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCoords, setPickupCoords] = useState({ lat: 17.5375, lng: 78.4735 });
  const [dropAddress, setDropAddress] = useState("");
  const [dropCoords, setDropCoords] = useState({ lat: 16.5062, lng: 80.6480 });
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationStr, setDurationStr] = useState<string | null>(null);

  const [cargoData, setCargoData] = useState({
    cargoType: "General Freight / Household Goods",
    weightTons: 0.5,
    length: "2",
    width: "1.5",
    height: "1.5",
    specialHandling: "None"
  });

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption>({
    id: "tata-ace",
    name: "Tata Ace Gold",
    category: "Mini Trucks",
    capacity: "1.0 Ton (1,000 kg)",
    maxPayloadTons: 1.0,
    maxPayloadKg: 1000,
    dimensions: "8 x 4.5 ft",
    description: "Best for city deliveries & house shifting",
    price: 300,
    image: "/images/vehicles/tata-ace-gold.png"
  });

  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [activeBookingsList, setActiveBookingsList] = useState<BookingItem[]>([]);
  const [isBookingsLoading, setIsBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const [totalCalculatedPrice, setTotalCalculatedPrice] = useState<number | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isPriceCalculatorOpen, setIsPriceCalculatorOpen] = useState(false);

  // Check if welcome preview is requested via URL (?welcome or ?preview)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const forceWelcome = urlParams.has("welcome") || urlParams.has("preview");
    if (forceWelcome) {
      setCurrentScreen("welcome");
      return;
    }

    const onboardingDone = localStorage.getItem("cargox_onboarding_completed") === "true";
    if (onboardingDone && currentScreen === "welcome") {
      setCurrentScreen("home");
      setActiveTab("home");
    }
  }, [currentScreen]);

  // Handle GPS detection directly from home screen or automatically on load
  const handleUseCurrentLocation = (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) alert("Geolocation is not supported by your browser");
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPickupCoords({ lat: latitude, lng: longitude });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          if (data && data.display_name) {
            setPickupAddress(data.display_name);
          } else {
            setPickupAddress(`Current GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          }
        } catch {
          setPickupAddress(`Current GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        console.warn("GPS error:", err);
        setIsDetectingLocation(false);
        if (!silent) {
          alert("Unable to retrieve your location. Please check location permissions or enter address manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Automatically detect user GPS location on component mount
  useEffect(() => {
    handleUseCurrentLocation(true);
  }, []);

  // Load real bookings from backend when signed in
  const loadCustomerBookings = () => {
    if (!isSignedIn) return;
    setIsBookingsLoading(true);
    setBookingsError(null);
    api.getBookings()
      .then((res) => {
        if (Array.isArray(res)) {
          const mapped: BookingItem[] = res.map((b: any) => {
            const rawStatus = (b.status || "").toUpperCase();
            let displayStatus: "In Transit" | "Delivered" | "Cancelled" | "Pending" = "In Transit";
            if (rawStatus === "DELIVERED" || rawStatus === "COMPLETED") {
              displayStatus = "Delivered";
            } else if (rawStatus === "CANCELLED" || rawStatus === "CUSTOMER_CANCELLED" || rawStatus === "REJECTED") {
              displayStatus = "Cancelled";
            } else if (rawStatus === "REQUESTED" || rawStatus === "SUBMITTED" || rawStatus === "UNDER_REVIEW") {
              displayStatus = "Pending";
            }

            return {
              id: b.id || b._id || "",
              ref: b.request_number || b.id || "",
              routeFrom: b.pickup_address?.split(",")[0] || b.pickup_address || "Pickup",
              routeTo: b.destination_address?.split(",")[0] || b.destination_address || "Destination",
              date: b.created_at
                ? new Date(b.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                : "Recent",
              price: b.final_price ?? b.estimated_price ?? null,
              status: displayStatus,
              vehicleName: b.assigned_vehicle_type || b.assigned_vehicle_model || "Commercial Truck",
              vehicleImage: "/images/vehicles/mahindra-bolero-pikup.png",
              hasInvoice: !!b.final_price
            };
          });
          setActiveBookingsList(mapped);
        }
      })
      .catch((err) => {
        console.warn("Could not load bookings:", err);
        setBookingsError(err?.message || "Failed to load bookings");
      })
      .finally(() => {
        setIsBookingsLoading(false);
      });
  };

  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      loadCustomerBookings();
    }
  }, [isSignedIn, currentScreen]);

  // Automatically invalidate and clear vehicle selection if cargo weight exceeds payload capacity
  useEffect(() => {
    if (selectedVehicle?.maxPayloadTons && cargoData.weightTons > selectedVehicle.maxPayloadTons) {
      // Find the first eligible vehicle or reset to an eligible vehicle
      const allVehiclesFleet = [
        { id: "tata-ace", name: "Tata Ace Gold", maxPayloadTons: 1.0, maxPayloadKg: 1000, capacity: "1.0 Ton (1,000 kg)" },
        { id: "dost", name: "Ashok Leyland Dost", maxPayloadTons: 1.5, maxPayloadKg: 1500, capacity: "1.5 Ton (1,500 kg)" },
        { id: "bolero", name: "Mahindra Bolero Pik-Up", maxPayloadTons: 2.0, maxPayloadKg: 2000, capacity: "2.0 Ton (2,000 kg)" },
        { id: "tata-intra", name: "Tata Intra V30", maxPayloadTons: 2.5, maxPayloadKg: 2500, capacity: "2.5 Ton (2,500 kg)" },
        { id: "eicher-pro", name: "Eicher Pro 2049", maxPayloadTons: 5.0, maxPayloadKg: 5000, capacity: "5.0 Ton (5,000 kg)" },
        { id: "bharatbenz-1015r", name: "BharatBenz 1015R", maxPayloadTons: 6.0, maxPayloadKg: 6000, capacity: "6.0 Ton (6,000 kg)" }
      ];
      const eligible = allVehiclesFleet.find(v => v.maxPayloadTons >= cargoData.weightTons);
      if (eligible) {
        setSelectedVehicle(prev => ({
          ...prev,
          id: eligible.id,
          name: eligible.name,
          capacity: eligible.capacity,
          maxPayloadTons: eligible.maxPayloadTons,
          maxPayloadKg: eligible.maxPayloadKg
        }));
      }
      setTotalCalculatedPrice(null);
    }
  }, [cargoData.weightTons, selectedVehicle?.maxPayloadTons]);

  // If activeTrackingBookingId is not set yet, set it to the latest active or most recent booking
  useEffect(() => {
    if (!activeTrackingBookingId && activeBookingsList.length > 0) {
      const active = activeBookingsList.find(b => b.status === "In Transit" || b.status === "Pending") || activeBookingsList[0];
      if (active?.id) {
        setActiveTrackingBookingId(active.id);
      }
    }
  }, [activeBookingsList, activeTrackingBookingId]);

  // Bottom tab switcher handler
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "home") setCurrentScreen("home");
    else if (tab === "bookings") setCurrentScreen("bookings");
    else if (tab === "track") setCurrentScreen("tracking");
    else if (tab === "profile") setCurrentScreen("profile");
  };

  // Submit actual booking to backend
  const handleConfirmAndPay = async (paymentMethod: string) => {
    // Client-side payload verification guard
    if (selectedVehicle.maxPayloadTons && cargoData.weightTons > selectedVehicle.maxPayloadTons) {
      alert(`Cargo weight (${cargoData.weightTons} Tons) exceeds ${selectedVehicle.name} capacity (${selectedVehicle.maxPayloadTons} Tons). Please choose an eligible vehicle.`);
      setCurrentScreen("vehicle");
      return;
    }

    setIsSubmittingBooking(true);
    try {
      if (distanceKm === null) {
        throw new Error("No valid route distance. Please re-select your pickup and destination.");
      }
      const payload = {
        goods_type: cargoData.cargoType,
        goods_description: `${cargoData.specialHandling !== "None" ? cargoData.specialHandling + " - " : ""}${selectedVehicle.name}`,
        special_instructions: `Dimensions: ${cargoData.length}x${cargoData.width}m. Preferred payment: ${paymentMethod}`,
        weight_tons: cargoData.weightTons,
        distance_km: distanceKm,
        selected_vehicle_id: selectedVehicle.id,
        vehicle_capacity_tons: selectedVehicle.maxPayloadTons || 2.0,
        pickup_company_name: "Customer Site",
        pickup_address: pickupAddress,
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        destination_company_name: "Receiver Site",
        destination_address: dropAddress,
        destination_lat: dropCoords.lat,
        destination_lng: dropCoords.lng
      };

      const result = await api.createBooking(payload);
      setCreatedBooking(result);
      setCurrentScreen("confirmation");
    } catch (err: any) {
      console.warn("Backend request submission error:", err);
      alert(`Booking Submission Error: ${err.message || "Failed to create delivery request. Please check vehicle eligibility."}`);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleDownloadInvoice = (booking: BookingItem) => {
    // Use actual data from the backend booking record, not the current flow state
    const invData = {
      invoice_number: `INV-${booking.ref || booking.id}`,
      issue_date: booking.date || new Date().toLocaleDateString("en-IN"),
      payment_due_date: booking.date || new Date().toLocaleDateString("en-IN"),
      status: booking.status === "Delivered" ? "PAID" : "PENDING",
      total_amount: booking.price ?? 0,
      customer_company_name: user?.fullName || "Valued Customer",
      pickup_address: booking.routeFrom || "",
      destination_address: booking.routeTo || "",
      goods_type: "",
      weight_tons: 0,
      distance_km: 0,
      payment_method: ""
    };
    generateInvoicePDF(invData);
  };

  // Show mobile bottom navigation on top-level tabs
  const showBottomNav = ["home", "bookings", "track", "profile"].includes(currentScreen);

  return (
    <div className="min-h-screen bg-[#070d1e] md:bg-slate-900 flex justify-center items-center overflow-x-hidden">
      {/* Mobile Shell Container: Responsive max-w-md on desktop with elegant bezel, full-bleed & full screen on mobile */}
      <div className="relative w-full max-w-[430px] h-[100dvh] md:h-[844px] md:max-h-[92vh] bg-white flex flex-col md:my-6 md:rounded-3xl md:overflow-hidden md:shadow-2xl md:border md:border-slate-800">
        
        {/* Screen 1: Welcome / Onboarding */}
        {currentScreen === "welcome" && (
          <WelcomeScreen
            onGetStarted={() => {
              setCurrentScreen("home");
              setActiveTab("home");
            }}
            onLogin={() => {
              setCurrentScreen("home");
              setActiveTab("home");
            }}
          />
        )}

        {/* Screen 2: Customer Home */}
        {currentScreen === "home" && (
          <CustomerHomeScreen
            pickupAddress={pickupAddress}
            dropAddress={dropAddress}
            isDetectingLocation={isDetectingLocation}
            onOpenPickup={() => setCurrentScreen("pickup")}
            onOpenDrop={() => setCurrentScreen("drop")}
            onUseCurrentLocation={() => handleUseCurrentLocation(false)}
            onGetQuote={() => setCurrentScreen("cargo")}
            onQuickTrack={() => {
              if (!activeTrackingBookingId && activeBookingsList.length > 0) {
                const active = activeBookingsList.find(b => b.status === "In Transit" || b.status === "Pending") || activeBookingsList[0];
                if (active?.id) setActiveTrackingBookingId(active.id);
              }
              setActiveTab("track");
              setCurrentScreen("tracking");
            }}
            onQuickBookings={() => {
              setActiveTab("bookings");
              setCurrentScreen("bookings");
            }}
            onQuickCalculator={() => setIsPriceCalculatorOpen(true)}
            onQuickSupport={() => alert("CargoX 24/7 Operations Support:\n• Email: support@cargox.com\n• Helpline: 1800-CARGO-X (1800-227469)\n• Direct WhatsApp & Chat available in Live Tracking")}
            onSelectVehicleCategory={(vName) => {
              const match = [
                { id: "bolero", name: "Mahindra Bolero Pik-Up", category: "Pickup Trucks" as const, capacity: "2.0 Ton (2,000 kg)", maxPayloadTons: 2.0, maxPayloadKg: 2000, dimensions: "10 x 5.5 ft", description: "Best for general cargo", price: 7850, image: "/images/vehicles/mahindra-bolero-pikup.png" },
                { id: "tata-ace", name: "Tata Ace Gold", category: "Mini Trucks" as const, capacity: "1.0 Ton (1,000 kg)", maxPayloadTons: 1.0, maxPayloadKg: 1000, dimensions: "8 x 4.5 ft", description: "Best for small city cargo", price: 5200, image: "/images/vehicles/tata-ace-gold.png" },
                { id: "dost", name: "Ashok Leyland Dost", category: "Pickup Trucks" as const, capacity: "1.5 Ton (1,500 kg)", maxPayloadTons: 1.5, maxPayloadKg: 1500, dimensions: "10 x 5.5 ft", description: "Suitable for city and short trips", price: 6900, image: "/images/vehicles/ashok-leyland-dost.png" },
                { id: "tata-intra", name: "Tata Intra V30", category: "Medium Trucks" as const, capacity: "2.5 Ton (2,500 kg)", maxPayloadTons: 2.5, maxPayloadKg: 2500, dimensions: "10 x 6 ft", description: "Best for medium cargo", price: 9800, image: "/images/vehicles/tata-intra-v30.png" },
                { id: "eicher-pro", name: "Eicher Pro 2049", category: "Heavy Trucks" as const, capacity: "5.0 Ton (5,000 kg)", maxPayloadTons: 5.0, maxPayloadKg: 5000, dimensions: "14 x 7 ft", description: "Heavy haul carrier for bulk & machinery cargo", price: 14500, image: "/images/vehicles/col5_full.png" },
                { id: "bharatbenz-1015r", name: "BharatBenz 1015R", category: "Heavy Trucks" as const, capacity: "6.0 Ton (6,000 kg)", maxPayloadTons: 6.0, maxPayloadKg: 6000, dimensions: "17 x 7.5 ft", description: "High capacity intercity freight transporter", price: 18200, image: "/images/vehicles/screen6_full.png" }
              ].find((v) => v.name.toLowerCase().includes(vName.toLowerCase())) as VehicleOption;
              if (match) setSelectedVehicle(match);
              setCurrentScreen("cargo");
            }}
          />
        )}

        {/* Screen 3: Select Pickup Location */}
        {currentScreen === "pickup" && (
          <SelectPickupLocationScreen
            initialAddress={pickupAddress}
            initialCoords={pickupCoords}
            onBack={() => setCurrentScreen("home")}
            onConfirm={(addr, coords) => {
              setPickupAddress(addr);
              setPickupCoords(coords);
              // Pickup changed — invalidate any previously calculated route
              setDistanceKm(null);
              setDurationStr(null);
              setTotalCalculatedPrice(null);
              setCurrentScreen("drop");
            }}
          />
        )}

        {/* Screen 4: Select Drop Location */}
        {currentScreen === "drop" && (
          <SelectDropLocationScreen
            pickupAddress={pickupAddress}
            pickupCoords={pickupCoords}
            initialDropAddress={dropAddress}
            onBack={() => setCurrentScreen("pickup")}
            onConfirm={(addr, coords, dist, dur) => {
              setDropAddress(addr);
              setDropCoords(coords);
              setDistanceKm(dist);
              setDurationStr(dur ?? null);
              setTotalCalculatedPrice(null); // Invalidate old quote on new route
              setCurrentScreen("cargo");
            }}
          />
        )}

        {/* Screen 5: Cargo Details */}
        {currentScreen === "cargo" && (
          <CargoDetailsScreen
            initialCargoData={cargoData}
            onBack={() => setCurrentScreen("drop")}
            onNext={(details) => {
              setCargoData(details);
              setCurrentScreen("vehicle");
            }}
          />
        )}

        {/* Screen 6: Choose Vehicle */}
        {currentScreen === "vehicle" && (
          <ChooseVehicleScreen
            selectedVehicleId={selectedVehicle.id}
            calculatedDistanceKm={distanceKm ?? undefined}
            cargoWeightTons={cargoData.weightTons}
            specialHandling={cargoData.specialHandling}
            onBack={() => setCurrentScreen("cargo")}
            onSelectVehicle={(veh) => {
              setSelectedVehicle(veh);
              setCurrentScreen("quote");
            }}
          />
        )}

        {/* Screen 7: Price Quote — only reachable if a valid OSRM route exists */}
        {currentScreen === "quote" && distanceKm !== null && (
          <PriceQuoteScreen
            pickupAddress={pickupAddress}
            dropAddress={dropAddress}
            distanceKm={distanceKm}
            durationStr={durationStr ?? ""}
            vehicle={selectedVehicle}
            cargoData={cargoData}
            onBack={() => setCurrentScreen("vehicle")}
            onEditRoute={() => setCurrentScreen("pickup")}
            onChangeVehicle={() => setCurrentScreen("vehicle")}
            onProceedToBooking={(finalPrice) => {
              setTotalCalculatedPrice(finalPrice);
              setCurrentScreen("summary");
            }}
          />
        )}

        {/* Screen 8: Booking Summary — requires valid price from quote screen */}
        {currentScreen === "summary" && distanceKm !== null && totalCalculatedPrice !== null && (
          <BookingSummaryScreen
            pickupAddress={pickupAddress}
            dropAddress={dropAddress}
            vehicle={selectedVehicle}
            cargoType={cargoData.cargoType}
            weightTons={cargoData.weightTons}
            distanceKm={distanceKm}
            durationStr={durationStr ?? ""}
            totalPrice={totalCalculatedPrice}
            isLoading={isSubmittingBooking}
            onBack={() => setCurrentScreen("quote")}
            onEditPickup={() => setCurrentScreen("pickup")}
            onEditDrop={() => setCurrentScreen("drop")}
            onConfirmAndPay={handleConfirmAndPay}
          />
        )}

        {/* Screen 9: Booking Confirmation — only show with a real backend booking ID */}
        {currentScreen === "confirmation" && createdBooking && (
          <BookingConfirmationScreen
            bookingId={createdBooking.request_number || createdBooking.id || createdBooking._id || "—"}
            bookingData={createdBooking}
            onTrackShipment={() => {
              setActiveTrackingBookingId(createdBooking.id || createdBooking._id);
              setActiveTab("track");
              setCurrentScreen("tracking");
            }}
            onGoHome={() => {
              setActiveTab("home");
              setCurrentScreen("home");
            }}
          />
        )}

        {/* Screen 10: Live Tracking */}
        {currentScreen === "tracking" && (
          <LiveTrackingScreen
            onBack={() => {
              setActiveTab("home");
              setCurrentScreen("home");
            }}
            onViewDetails={() => {
              setActiveTab("bookings");
              setCurrentScreen("bookings");
            }}
            requestId={activeTrackingBookingId || createdBooking?.id || createdBooking?._id || activeBookingsList[0]?.id}
            bookingRef={
              activeBookingsList.find(b => b.id === (activeTrackingBookingId || createdBooking?.id))?.ref ||
              createdBooking?.request_number ||
              createdBooking?.id ||
              activeBookingsList[0]?.ref ||
              ""
            }
            vehicleModel={selectedVehicle.name}
            vehicleCapacity={selectedVehicle.capacity}
          />
        )}

        {/* Screen 11: My Bookings */}
        {currentScreen === "bookings" && (
          <MyBookingsScreen
            bookingsList={activeBookingsList}
            isLoading={isBookingsLoading}
            error={bookingsError}
            onRetry={loadCustomerBookings}
            onBack={() => {
              setActiveTab("home");
              setCurrentScreen("home");
            }}
            onLiveTracking={(b) => {
              setActiveTrackingBookingId(b.id);
              setActiveTab("track");
              setCurrentScreen("tracking");
            }}
            onViewDetails={(b) => {
              setActiveTrackingBookingId(b.id);
              setActiveTab("track");
              setCurrentScreen("tracking");
            }}
            onDownloadInvoice={handleDownloadInvoice}
          />
        )}

        {/* Screen 12: Profile & Settings */}
        {currentScreen === "profile" && (
          <ProfileSettingsScreen
            onNavigateTab={handleTabChange}
            onOpenSavedLocations={() => setCurrentScreen("pickup")}
            onOpenPaymentMethods={() => setCurrentScreen("summary")}
            onOpenNotifications={() => alert("No unread notifications.")}
            onOpenHelpSupport={() => alert("Contact CargoX Support: support@cargox.com")}
            onOpenReferEarn={() => alert("Refer CargoX to get ₹500 discount on your next booking!")}
            onOpenSettings={() => alert("CargoX Customer Profile Settings")}
            onReplayWelcome={() => {
              try { localStorage.removeItem("cargox_onboarding_completed"); } catch {}
              setCurrentScreen("welcome");
            }}
          />
        )}

        {/* Bottom Navigation Bar visible on primary tabs matching Screen 2, 11, 12 */}
        {showBottomNav && (
          <MobileBottomNav activeTab={activeTab} onChangeTab={handleTabChange} />
        )}

        {/* Global Quick Price Calculator Modal */}
        <QuickPriceCalculatorModal
          isOpen={isPriceCalculatorOpen}
          onClose={() => setIsPriceCalculatorOpen(false)}
          defaultDistanceKm={distanceKm}
          onProceedToBook={(dist, veh, weight) => {
            setDistanceKm(dist);
            setSelectedVehicle(veh);
            setCargoData(prev => ({ ...prev, weightTons: weight }));
            setCurrentScreen("cargo");
          }}
        />
      </div>
    </div>
  );
}
