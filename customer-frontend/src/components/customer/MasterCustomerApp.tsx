import { useState, useEffect } from "react";
import { useAuth, useUser, useClerk } from "@clerk/react";
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
import SelectDropLocationScreen from "./SelectDropLocationScreen";
import MobileBottomNav, { type TabType } from "./MobileBottomNav";
import QuickPriceCalculatorModal from "./QuickPriceCalculatorModal";
import { api } from "../../services/api";

export type CustomerFlowScreen =
  | "welcome"           // Screen 1: Splash / Welcome
  | "home"              // Screen 2: Dashboard
  | "search"            // Screen 3: Pickup & Drop Search
  | "select-drop-map"   // Interactive Leaflet Map picker for Drop Location
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
  const { openSignIn } = useClerk();

  // Screen & Navigation state
  const [currentScreen, setCurrentScreen] = useState<CustomerFlowScreen>("welcome");
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // Selected operational city
  const [selectedCity, setSelectedCity] = useState("Hyderabad, Telangana");

  // Booking Flow Data — clean initial states without hardcoded demo strings
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropAddress, setDropAddress] = useState("");
  const [dropCoords, setDropCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const [cargoWeightKg, setCargoWeightKg] = useState<number>(0);

  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicleItem>({
    id: "part-load",
    name: "Part Load (Shared Truck)",
    capacityText: "1-3000 kgs",
    maxPayloadKg: 3000,
    maxPayloadTons: 3.0,
    etaText: "Today, 9:00 AM",
    price: 350,
    image: "/images/vehicles/ashok-leyland-dost.png",
    isPartLoad: true,
  });

  const [recipientDetails, setRecipientDetails] = useState({
    receiverName: "",
    receiverPhone: "",
    saveAs: "Home",
  });

  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [ordersList, setOrdersList] = useState<CustomerOrderRecord[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isPriceCalculatorOpen, setIsPriceCalculatorOpen] = useState(false);
  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);
  const [bookingErrorMessage, setBookingErrorMessage] = useState<string | null>(null);

  const handleDetectCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsDetectingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPickupCoords({ lat, lng });
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
              { headers: { "Accept-Language": "en" } }
            );
            if (resp.ok) {
              const data = await resp.json();
              const formatted = data.display_name || `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
              setPickupAddress(formatted);
            } else {
              setPickupAddress(`Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            }
          } catch {
            setPickupAddress(`Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          } finally {
            setIsDetectingLocation(false);
          }
        },
        (_err) => {
          setIsDetectingLocation(false);
          alert("Could not detect location. Please grant location permissions or enter address manually.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  // Check if welcome preview is requested via URL or skip if signed in and onboarding was completed
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const forceWelcome = urlParams.has("welcome") || urlParams.has("preview");
    if (forceWelcome) {
      setCurrentScreen("welcome");
      return;
    }

    const onboardingDone = localStorage.getItem("cargox_onboarding_completed") === "true";
    if (isSignedIn && onboardingDone && currentScreen === "welcome") {
      setCurrentScreen("home");
      setActiveTab("home");
    }
  }, [currentScreen, isSignedIn]);

  // When user successfully signs in via Clerk while on welcome screen, transition into portal
  useEffect(() => {
    if (isSignedIn && currentScreen === "welcome") {
      try {
        localStorage.setItem("cargox_onboarding_completed", "true");
      } catch {}
      setCurrentScreen("home");
      setActiveTab("home");
    }
  }, [isSignedIn, currentScreen]);

  // Load real bookings from backend (works with Clerk auth OR guest customer session)
  const loadCustomerBookings = () => {
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
              fare: Number(
                b.final_price ??
                b.estimated_price ??
                b.quotation?.customer_total_charge ??
                b.amount_due ??
                b.total_amount ??
                0
              ),
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
    loadCustomerBookings();
  }, [isSignedIn, currentScreen, activeTab]);

  // Handle Bottom Tab Navigation (5 Tabs matching reference)
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "home") setCurrentScreen("home");
    else if (tab === "orders") setCurrentScreen("orders");
    else if (tab === "coins") setCurrentScreen("coins");
    else if (tab === "payments") setCurrentScreen("payments");
    else if (tab === "account") setCurrentScreen("account");
  };

  // Haversine formula for fallback distance calculation
  const calculateHaversineKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightKm = R * c;
    // Apply standard urban road detour factor (~1.32x straight line)
    return Math.max(1, Math.round(straightKm * 1.32));
  };

  // Compute actual road trip distance via backend OSRM routing engine with fallback
  const computeTripDistance = async (
    pCoords: { lat: number; lng: number } | null,
    dCoords: { lat: number; lng: number } | null,
    dText?: string
  ) => {
    // If coordinates are missing, try to resolve via text geocoding
    let effectiveDrop = dCoords;
    if (!effectiveDrop && dText && dText.trim()) {
      try {
        const query = dText.trim();
        const nomUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
        const resp = await fetch(nomUrl);
        if (resp.ok) {
          const data = await resp.json();
          if (data.features && data.features.length > 0) {
            const coords = data.features[0].geometry.coordinates;
            effectiveDrop = { lat: coords[1], lng: coords[0] };
            setDropCoords(effectiveDrop);
          }
        }
      } catch (e) {
        console.warn("Fast geocoding failed:", e);
      }
    }

    // Default fallback coordinates: if drop is still unknown, default to a close 3 km local trip
    const effectivePickup = pCoords || { lat: 17.5375, lng: 78.4735 };
    // If no drop coords, default to nearby location (~3 km away instead of intercity 23 km)
    const finalDrop = effectiveDrop || { lat: effectivePickup.lat + 0.022, lng: effectivePickup.lng + 0.015 };

    try {
      const res = await api.calculateRoute({
        pickup_lat: effectivePickup.lat,
        pickup_lng: effectivePickup.lng,
        destination_lat: finalDrop.lat,
        destination_lng: finalDrop.lng,
      });
      if (res && res.distance_km) {
        const d = Math.max(1, Math.round(Number(res.distance_km)));
        if (d > 0) {
          setDistanceKm(d);
          return d;
        }
      }
    } catch (e) {
      console.warn("Backend route calculation failed, calculating geo distance:", e);
    }

    // High accuracy fallback via Haversine
    const fallbackDist = Math.max(1, calculateHaversineKm(
      effectivePickup.lat,
      effectivePickup.lng,
      finalDrop.lat,
      finalDrop.lng
    ));
    setDistanceKm(fallbackDist);
    return fallbackDist;
  };

  // Swap pickup & drop locations
  const handleSwapLocations = () => {
    const prevPickup = pickupAddress;
    const prevPickupCoords = pickupCoords;
    setPickupAddress(dropAddress);
    setPickupCoords(dropCoords);
    setDropAddress(prevPickup);
    setDropCoords(prevPickupCoords);
    if (dropCoords && prevPickupCoords) {
      computeTripDistance(dropCoords, prevPickupCoords);
    }
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
        distance_km: distanceKm ?? 15,
        selected_vehicle_id: selectedVehicle.id,
        vehicle_capacity_tons: selectedVehicle.maxPayloadTons,
        pickup_company_name: user?.fullName || "Valued Customer",
        pickup_address: pickupAddress || "Pickup Point",
        pickup_lat: pickupCoords?.lat ?? 17.3850,
        pickup_lng: pickupCoords?.lng ?? 78.4867,
        destination_company_name: recipientDetails.receiverName || "Receiver Site",
        destination_contact_person: recipientDetails.receiverName || "Receiver",
        destination_phone: recipientDetails.receiverPhone || "",
        destination_address: dropAddress || "Destination Point",
        destination_lat: dropCoords?.lat ?? 17.3850,
        destination_lng: dropCoords?.lng ?? 78.4867,
      };

      const result = await api.createBooking(payload);
      setCreatedBooking(result);
      setCurrentScreen("confirmation");
      loadCustomerBookings();
    } catch (err: any) {
      console.warn("Backend request submission error:", err);
      let errMsg = err.message || "Failed to create delivery request. Please check vehicle availability.";
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed.detail) {
          if (typeof parsed.detail === "string") {
            errMsg = parsed.detail;
          } else if (Array.isArray(parsed.detail) && parsed.detail.length > 0) {
            errMsg = parsed.detail.map((d: any) => d.msg || JSON.stringify(d)).join("\n");
          } else {
            errMsg = JSON.stringify(parsed.detail);
          }
        }
      } catch {}
      // Clean up Pydantic "Value error, " prefix if present
      errMsg = errMsg.replace(/^Value error,\s*/i, "");
      setBookingErrorMessage(errMsg);
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
              if (isSignedIn) {
                try {
                  localStorage.setItem("cargox_onboarding_completed", "true");
                } catch {}
                setCurrentScreen("home");
                setActiveTab("home");
              } else {
                openSignIn();
              }
            }}
            onLogin={() => {
              if (isSignedIn) {
                try {
                  localStorage.setItem("cargox_onboarding_completed", "true");
                } catch {}
                setCurrentScreen("home");
                setActiveTab("home");
              } else {
                openSignIn();
              }
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
            onUseCurrentLocation={handleDetectCurrentLocation}
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
            onSelectPickupSuggestion={(fullAddr, coords) => {
              setPickupAddress(fullAddr);
              if (coords) {
                setPickupCoords(coords);
                computeTripDistance(coords, dropCoords);
              }
            }}
            onSelectSuggestion={(fullAddr, coords) => {
              setDropAddress(fullAddr);
              if (coords) {
                setDropCoords(coords);
                computeTripDistance(pickupCoords, coords);
              }
            }}
            onUseCurrentLocation={handleDetectCurrentLocation}
            isDetectingLocation={isDetectingLocation}
            onChooseOnMap={() => setCurrentScreen("select-drop-map")}
            onContinue={async () => {
              await computeTripDistance(pickupCoords, dropCoords, dropAddress);
              setCurrentScreen("map-recipient");
            }}
          />
        )}

        {/* Screen 3B: In-App Interactive Map Location Picker */}
        {currentScreen === "select-drop-map" && (
          <SelectDropLocationScreen
            onBack={() => setCurrentScreen("search")}
            pickupAddress={pickupAddress}
            pickupCoords={pickupCoords || { lat: 17.5375, lng: 78.4735 }}
            initialDropAddress={dropAddress}
            onConfirm={(address, coords, distKm) => {
              setDropAddress(address);
              setDropCoords(coords);
              if (distKm > 0) {
                setDistanceKm(distKm);
              } else {
                computeTripDistance(pickupCoords, coords, address);
              }
              setCurrentScreen("map-recipient");
            }}
          />
        )}

        {/* Screen 4: Map-Based Drop Location & Recipient Details */}
        {currentScreen === "map-recipient" && (
          <MapDropRecipientScreen
            onBack={() => setCurrentScreen("search")}
            dropAddress={dropAddress}
            dropCoords={dropCoords || { lat: 17.3850, lng: 78.4867 }}
            userPhone={user?.primaryPhoneNumber?.phoneNumber || ""}
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
            calculatedDistanceKm={distanceKm ?? 3}
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

        {/* In-App Error Notification Modal */}
        {bookingErrorMessage && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#0f172a] border border-slate-700/90 text-white rounded-3xl p-5 w-full max-w-[340px] shadow-2xl flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h3 className="text-base font-bold text-white mb-2">Booking Notice</h3>

              {/* Message Box with explicit scroll and word-break to stay strictly inside the container */}
              <div className="w-full max-h-48 overflow-y-auto bg-slate-950/70 border border-slate-800 rounded-xl p-3 mb-5 text-left">
                <p className="text-xs text-slate-300 leading-relaxed break-words whitespace-pre-wrap select-text font-normal">
                  {bookingErrorMessage}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setBookingErrorMessage(null)}
                className="w-full py-3 bg-[#e29367] hover:bg-[#d88457] active:scale-95 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer"
              >
                Okay, Understood
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
