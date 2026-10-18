import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/react";
import WelcomeScreen from "./WelcomeScreen";
import CustomerHomeScreen from "./CustomerHomeScreen";
import PickupDropSearchScreen from "./PickupDropSearchScreen";
import MapDropRecipientScreen from "./MapDropRecipientScreen";
import VehicleSelectionWithPartLoadScreen, { type FleetVehicleItem } from "./VehicleSelectionWithPartLoadScreen";
import BookingDetailsScreen from "./BookingDetailsScreen";
import CustomerOrdersScreen, { type CustomerOrderRecord } from "./CustomerOrdersScreen";
import CustomerPaymentsScreen from "./CustomerPaymentsScreen";
import CustomerAccountScreen from "./CustomerAccountScreen";
import CustomerRewardsScreen from "./CustomerRewardsScreen";
import AddMoneyScreen from "./AddMoneyScreen";
import BookingConfirmationScreen from "./BookingConfirmationScreen";
import LiveTrackingScreen from "./LiveTrackingScreen";
import MobileBottomNav, { type TabType } from "./MobileBottomNav";
import QuickPriceCalculatorModal from "./QuickPriceCalculatorModal";
import { api } from "../../services/api";

export type CustomerFlowScreen =
  | "welcome"           // Screen 1: Splash / Welcome
  | "home"              // Screen 2: Dashboard
  | "search"            // Screen 3: Pickup & Drop Search
  | "map-recipient"     // Screen 4: Map Drop & Recipient Details
  | "vehicle"           // Screen 5: Vehicle Selection with Part Load
  | "booking-details"   // Screen 6: Booking Details
  | "confirmation"      // Booking Confirmed
  | "orders"            // Screen 7: My Orders
  | "payments"          // Screen 8: Payments
  | "account"           // Screen 9: Account / Profile
  | "coins"             // Coins / Rewards
  | "add-money"         // Screen 10: Add Money
  | "tracking";         // Live GPS Tracking

export default function MasterCustomerApp() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  // Screen & Navigation state
  const [currentScreen, setCurrentScreen] = useState<CustomerFlowScreen>("welcome");
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // Selected operational city
  const [selectedCity, setSelectedCity] = useState("Hyderabad, Telangana");

  // Booking Flow Data
  const [pickupAddress, setPickupAddress] = useState("sai deekshitha apartment, 7,165/3, Vinayak Nagar, Hyderabad");
  const [pickupCoords, setPickupCoords] = useState({ lat: 17.5375, lng: 78.4735 });
  const [dropAddress, setDropAddress] = useState("Vijayawada, Andhra Pradesh, India");
  const [dropCoords, setDropCoords] = useState({ lat: 16.5062, lng: 80.6480 });
  const [distanceKm, setDistanceKm] = useState<number | null>(275);

  const [cargoWeightKg, setCargoWeightKg] = useState<number>(200);

  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicleItem>({
    id: "part-load",
    name: "Part Load (Shared Truck)",
    capacityText: "1-3000 kgs",
    maxPayloadKg: 3000,
    maxPayloadTons: 3.0,
    etaText: "Today, 9:00 AM",
    price: 2811,
    image: "/images/vehicles/ashok-leyland-dost.png",
    isPartLoad: true,
  });

  const [recipientDetails, setRecipientDetails] = useState({
    receiverName: "Srujan Kumar Sangepu",
    receiverPhone: "8919271456",
    saveAs: "Home",
  });

  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [ordersList, setOrdersList] = useState<CustomerOrderRecord[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isDetectingLocation] = useState(false);
  const [isPriceCalculatorOpen, setIsPriceCalculatorOpen] = useState(false);
  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);

  // Check if welcome preview is requested via URL or skip if completed
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

  // Load real bookings from backend when signed in
  const loadCustomerBookings = () => {
    if (!isSignedIn) return;
    setIsOrdersLoading(true);
    api.getBookings()
      .then((res) => {
        if (Array.isArray(res)) {
          const mapped: CustomerOrderRecord[] = res.map((b: any) => {
            const rawStatus = (b.status || "").toUpperCase();
            let displayStatus: "Ongoing" | "Completed" | "Cancelled" = "Ongoing";
            if (rawStatus === "DELIVERED" || rawStatus === "COMPLETED") {
              displayStatus = "Completed";
            } else if (rawStatus === "CANCELLED" || rawStatus === "CUSTOMER_CANCELLED" || rawStatus === "REJECTED") {
              displayStatus = "Cancelled";
            }

            return {
              id: b.id || b._id || "",
              ref: b.request_number || b.id || "",
              serviceType: b.assigned_vehicle_type || "Part Load",
              routeFrom: b.pickup_address?.split(",")[0] || b.pickup_address || "Hyderabad",
              routeTo: b.destination_address?.split(",")[0] || b.destination_address || "Vijayawada",
              dateTimeStr: b.created_at
                ? new Date(b.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                : "18 Oct, 09:00 AM",
              weightKg: Math.round((b.weight_tons || 0.2) * 1000),
              paymentType: "Cash",
              status: displayStatus,
              fare: b.final_price ?? b.estimated_price ?? 2811,
              image: "/images/vehicles/ashok-leyland-dost.png",
            };
          });
          setOrdersList(mapped);
        }
      })
      .catch((err) => {
        console.warn("Could not load customer bookings:", err);
      })
      .finally(() => {
        setIsOrdersLoading(false);
      });
  };

  useEffect(() => {
    if (isSignedIn) {
      loadCustomerBookings();
    }
  }, [isSignedIn, currentScreen]);

  // Handle Bottom Tab Navigation (5 Tabs matching reference)
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "home") setCurrentScreen("home");
    else if (tab === "orders") setCurrentScreen("orders");
    else if (tab === "coins") setCurrentScreen("coins");
    else if (tab === "payments") setCurrentScreen("payments");
    else if (tab === "account") setCurrentScreen("account");
  };

  // Swap pickup & drop locations
  const handleSwapLocations = () => {
    const prevPickup = pickupAddress;
    const prevPickupCoords = pickupCoords;
    setPickupAddress(dropAddress);
    setPickupCoords(dropCoords);
    setDropAddress(prevPickup);
    setDropCoords(prevPickupCoords);
  };

  // Submit actual booking to backend
  const handleCreateBooking = async (bookingMeta: {
    weightKg: number;
    pickupDate: string;
    pickupSlot: string;
    goodsType: string;
    needGST: boolean;
    paymentMethod: string;
  }) => {
    setIsSubmittingBooking(true);
    try {
      const payload = {
        goods_type: bookingMeta.goodsType,
        goods_description: `${selectedVehicle.name} - Slot: ${bookingMeta.pickupDate} (${bookingMeta.pickupSlot})`,
        special_instructions: `Receiver: ${recipientDetails.receiverName} (${recipientDetails.receiverPhone}). Payment: ${bookingMeta.paymentMethod}. GST Requested: ${bookingMeta.needGST ? "Yes" : "No"}`,
        weight_tons: bookingMeta.weightKg / 1000,
        distance_km: distanceKm ?? 275,
        selected_vehicle_id: selectedVehicle.id,
        vehicle_capacity_tons: selectedVehicle.maxPayloadTons,
        pickup_company_name: user?.fullName || "Valued Customer",
        pickup_address: pickupAddress,
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        destination_company_name: recipientDetails.receiverName || "Receiver Site",
        destination_address: dropAddress,
        destination_lat: dropCoords.lat,
        destination_lng: dropCoords.lng,
      };

      const result = await api.createBooking(payload);
      setCreatedBooking(result);
      setCurrentScreen("confirmation");
      loadCustomerBookings();
    } catch (err: any) {
      console.warn("Backend request submission error:", err);
      alert(`Booking Submission: ${err.message || "Failed to create delivery request. Please check vehicle availability."}`);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Show bottom navigation on primary 5 tabs
  const showBottomNav = ["home", "orders", "coins", "payments", "account"].includes(currentScreen);

  return (
    <div className="min-h-screen bg-[#070d1e] md:bg-slate-900 flex justify-center items-center overflow-x-hidden">
      {/* Mobile Shell Container: Responsive 430px width on desktop with elegant bezel, full-bleed & full screen on mobile */}
      <div className="relative w-full max-w-[430px] h-[100dvh] md:h-[844px] md:max-h-[92vh] bg-white flex flex-col md:my-6 md:rounded-3xl md:overflow-hidden md:shadow-2xl md:border md:border-slate-800">
        
        {/* Screen 1: Welcome / Splash Screen */}
        {currentScreen === "welcome" && (
          <WelcomeScreen
            onGetStarted={() => {
              try {
                localStorage.setItem("cargox_onboarding_completed", "true");
              } catch {}
              setCurrentScreen("home");
              setActiveTab("home");
            }}
            onLogin={() => {
              setCurrentScreen("home");
              setActiveTab("home");
            }}
          />
        )}

        {/* Screen 2: Customer Home Dashboard */}
        {currentScreen === "home" && (
          <CustomerHomeScreen
            pickupAddress={pickupAddress}
            dropAddress={dropAddress}
            isDetectingLocation={isDetectingLocation}
            selectedCity={selectedCity}
            onChangeCity={(city) => setSelectedCity(city)}
            onOpenPickup={() => setCurrentScreen("search")}
            onOpenDrop={() => setCurrentScreen("search")}
            onSwapLocations={handleSwapLocations}
            onGetQuote={() => setCurrentScreen("search")}
            onQuickTrack={() => {
              setActiveTab("orders");
              setCurrentScreen("orders");
            }}
            onQuickBookings={() => {
              setActiveTab("orders");
              setCurrentScreen("orders");
            }}
            onQuickCalculator={() => setIsPriceCalculatorOpen(true)}
            onQuickSupport={() => alert("CargoExpress 24/7 Operations Support:\n• Helpline: 1800-CARGO-EXP\n• Email: support@cargox.com")}
            onSelectService={(service) => {
              if (service === "Part Load") {
                setSelectedVehicle({
                  id: "part-load",
                  name: "Part Load (Shared Truck)",
                  capacityText: "1-3000 kgs",
                  maxPayloadKg: 3000,
                  maxPayloadTons: 3.0,
                  etaText: "Today, 9:00 AM",
                  price: 2811,
                  image: "/images/vehicles/ashok-leyland-dost.png",
                  isPartLoad: true,
                });
              }
              setCurrentScreen("search");
            }}
          />
        )}

        {/* Screen 3: Pickup & Drop Location Search */}
        {currentScreen === "search" && (
          <PickupDropSearchScreen
            onBack={() => {
              setActiveTab("home");
              setCurrentScreen("home");
            }}
            pickupAddress={pickupAddress}
            dropAddress={dropAddress}
            onChangePickupAddress={(addr) => setPickupAddress(addr)}
            onChangeDropAddress={(addr) => setDropAddress(addr)}
            onSelectSuggestion={(fullAddr, coords) => {
              setDropAddress(fullAddr);
              if (coords) setDropCoords(coords);
            }}
            onContinue={() => setCurrentScreen("map-recipient")}
          />
        )}

        {/* Screen 4: Map-Based Drop Location & Recipient Details */}
        {currentScreen === "map-recipient" && (
          <MapDropRecipientScreen
            onBack={() => setCurrentScreen("search")}
            dropAddress={dropAddress}
            dropCoords={dropCoords}
            onChangeLocation={() => setCurrentScreen("search")}
            onProceed={(details) => {
              setRecipientDetails(details);
              setCurrentScreen("vehicle");
            }}
          />
        )}

        {/* Screen 5: Vehicle Selection With Part Load */}
        {currentScreen === "vehicle" && (
          <VehicleSelectionWithPartLoadScreen
            onBack={() => setCurrentScreen("map-recipient")}
            calculatedDistanceKm={distanceKm ?? 275}
            cargoWeightKg={cargoWeightKg}
            onSelectVehicle={(veh) => {
              setSelectedVehicle(veh);
              setCurrentScreen("booking-details");
            }}
          />
        )}

        {/* Screen 6: Booking Details */}
        {currentScreen === "booking-details" && (
          <BookingDetailsScreen
            onBack={() => setCurrentScreen("vehicle")}
            selectedVehicle={selectedVehicle}
            goodsWeightKg={cargoWeightKg}
            totalPrice={selectedVehicle.price || 2811}
            isSubmitting={isSubmittingBooking}
            onChangeWeightKg={(kg) => setCargoWeightKg(kg)}
            onProceedBooking={handleCreateBooking}
          />
        )}

        {/* Confirmation Screen */}
        {currentScreen === "confirmation" && createdBooking && (
          <BookingConfirmationScreen
            bookingId={createdBooking.request_number || createdBooking.id || createdBooking._id || "REQ-PL-9821"}
            bookingData={createdBooking}
            onTrackShipment={() => {
              setActiveTrackingId(createdBooking.id || createdBooking._id);
              setCurrentScreen("tracking");
            }}
            onGoHome={() => {
              setActiveTab("home");
              setCurrentScreen("home");
            }}
          />
        )}

        {/* Live Tracking */}
        {currentScreen === "tracking" && (
          <LiveTrackingScreen
            onBack={() => {
              setActiveTab("orders");
              setCurrentScreen("orders");
            }}
            onViewDetails={() => {
              setActiveTab("orders");
              setCurrentScreen("orders");
            }}
            requestId={activeTrackingId || createdBooking?.id || ordersList[0]?.id}
            bookingRef={createdBooking?.request_number || ordersList[0]?.ref || "REQ-PL-9821"}
            vehicleModel={selectedVehicle.name}
            vehicleCapacity={selectedVehicle.capacityText}
          />
        )}

        {/* Screen 7: My Orders */}
        {currentScreen === "orders" && (
          <CustomerOrdersScreen
            onBack={() => {
              setActiveTab("home");
              setCurrentScreen("home");
            }}
            ordersList={ordersList}
            isLoading={isOrdersLoading}
            onTrackOrder={(order) => {
              setActiveTrackingId(order.id);
              setCurrentScreen("tracking");
            }}
          />
        )}

        {/* Screen 8: Payments */}
        {currentScreen === "payments" && (
          <CustomerPaymentsScreen
            walletBalance={walletBalance}
            onBack={() => {
              setActiveTab("home");
              setCurrentScreen("home");
            }}
            onOpenAddMoney={() => setCurrentScreen("add-money")}
          />
        )}

        {/* Coins / Rewards */}
        {currentScreen === "coins" && (
          <CustomerRewardsScreen
            onBack={() => {
              setActiveTab("home");
              setCurrentScreen("home");
            }}
            onExploreServices={() => {
              setActiveTab("home");
              setCurrentScreen("home");
            }}
          />
        )}

        {/* Screen 9: Account / Profile */}
        {currentScreen === "account" && (
          <CustomerAccountScreen
            onOpenSavedLocations={() => setCurrentScreen("search")}
            onOpenPayments={() => {
              setActiveTab("payments");
              setCurrentScreen("payments");
            }}
          />
        )}

        {/* Screen 10: Add Money */}
        {currentScreen === "add-money" && (
          <AddMoneyScreen
            onBack={() => {
              setActiveTab("payments");
              setCurrentScreen("payments");
            }}
            onSuccess={(amt) => {
              setWalletBalance((prev) => prev + amt);
              alert(`₹${amt.toLocaleString("en-IN")} added to CargoExpress Credits successfully!`);
              setActiveTab("payments");
              setCurrentScreen("payments");
            }}
          />
        )}

        {/* Bottom Navigation Bar visible on 5 primary tabs */}
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
            setCargoWeightKg(Math.round(weight * 1000));
            setSelectedVehicle({
              id: veh.id,
              name: veh.name,
              capacityText: veh.capacity,
              maxPayloadKg: veh.maxPayloadKg,
              maxPayloadTons: veh.maxPayloadTons,
              etaText: "Instant",
              price: veh.price,
              image: veh.image,
            });
            setCurrentScreen("booking-details");
          }}
        />
      </div>
    </div>
  );
}
