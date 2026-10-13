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

  // Booking Flow Data
  const [pickupAddress, setPickupAddress] = useState("St. Martin's Engineering College, Hyderabad, Telangana");
  const [pickupCoords, setPickupCoords] = useState({ lat: 17.5375, lng: 78.4735 });
  const [dropAddress, setDropAddress] = useState("Vijayawada, Andhra Pradesh");
  const [dropCoords, setDropCoords] = useState({ lat: 16.5062, lng: 80.6480 });
  const [distanceKm, setDistanceKm] = useState(275);
  const [durationStr, setDurationStr] = useState("5h 20m");

  const [cargoData, setCargoData] = useState({
    cargoType: "Industrial Machinery",
    weightTons: 5,
    length: "3",
    width: "2",
    height: "2",
    specialHandling: "None"
  });

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption>({
    id: "bolero",
    name: "Mahindra Bolero Pik-Up",
    category: "Pickup Trucks",
    capacity: "2.0 Ton (2,000 kg)",
    maxPayloadTons: 2.0,
    maxPayloadKg: 2000,
    dimensions: "10 x 5.5 ft",
    description: "Best for general cargo",
    price: 7850,
    image: "/images/vehicles/mahindra-bolero-pikup.png"
  });

  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [activeBookingsList, setActiveBookingsList] = useState<BookingItem[]>([]);

  const [totalCalculatedPrice, setTotalCalculatedPrice] = useState(7850);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Automatically start on Home screen if already signed in, else Welcome
  useEffect(() => {
    if (isSignedIn && currentScreen === "welcome") {
      setCurrentScreen("home");
      setActiveTab("home");
    }
  }, [isSignedIn]);

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
  useEffect(() => {
    if (isSignedIn) {
      api.getBookings()
        .then((res) => {
          if (Array.isArray(res)) {
            const mapped: BookingItem[] = res.map((b: any) => ({
              id: b.id || b._id || String(Math.random()),
              ref: b.request_number || `CRGX-${String(b.id || "").slice(-4)}`,
              routeFrom: b.pickup_address?.split(",")[0] || "Hyderabad",
              routeTo: b.destination_address?.split(",")[0] || "Vijayawada",
              date: b.created_at ? new Date(b.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "10 Oct 2026",
              price: b.final_price || b.estimated_price || 7850,
              status: b.status === "DELIVERED" ? "Delivered" : b.status === "CANCELLED" ? "Cancelled" : "In Transit",
              vehicleName: b.assigned_vehicle_model || "Mahindra Bolero Pik-Up",
              vehicleImage: "/images/vehicles/mahindra-bolero-pikup.png",
              hasInvoice: true
            }));
            if (mapped.length > 0) setActiveBookingsList(mapped);
          }
        })
        .catch(() => {});
    }
  }, [isSignedIn, currentScreen]);

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
    const mockInv = {
      invoice_number: `INV-${booking.ref}`,
      issue_date: booking.date,
      payment_due_date: "10 Oct 2026",
      status: "PAID",
      total_amount: booking.price,
      customer_company_name: user?.fullName || "Valued Customer",
      pickup_address: pickupAddress,
      destination_address: dropAddress,
      goods_type: cargoData.cargoType,
      weight_tons: cargoData.weightTons,
      distance_km: distanceKm,
      payment_method: "UPI"
    };
    generateInvoicePDF(mockInv);
  };

  // Show mobile bottom navigation on top-level tabs
  const showBottomNav = ["home", "bookings", "track", "profile"].includes(currentScreen);

  return (
    <div className="min-h-screen bg-[#070d1e] md:bg-slate-900 flex justify-center items-center">
      {/* Mobile Shell Container: Responsive max-w-md on desktop with elegant bezel, full-bleed on mobile */}
      <div className="relative w-full max-w-[430px] min-h-screen bg-white md:my-6 md:rounded-3xl md:overflow-hidden md:shadow-2xl md:border md:border-slate-800 flex flex-col justify-between">
        
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
              setActiveTab("track");
              setCurrentScreen("tracking");
            }}
            onQuickBookings={() => {
              setActiveTab("bookings");
              setCurrentScreen("bookings");
            }}
            onQuickCalculator={() => setCurrentScreen("quote")}
            onQuickSupport={() => alert("CargoX 24/7 Support: support@cargox.com | Toll-Free: 1800-CARGO-X")}
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
              setDurationStr(dur);
              setCurrentScreen("cargo");
            }}
          />
        )}

        {/* Screen 5: Cargo Details */}
        {currentScreen === "cargo" && (
          <CargoDetailsScreen
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
            calculatedDistanceKm={distanceKm}
            cargoWeightTons={cargoData.weightTons}
            specialHandling={cargoData.specialHandling}
            onBack={() => setCurrentScreen("cargo")}
            onSelectVehicle={(veh) => {
              setSelectedVehicle(veh);
              setCurrentScreen("quote");
            }}
          />
        )}

        {/* Screen 7: Price Quote */}
        {currentScreen === "quote" && (
          <PriceQuoteScreen
            pickupAddress={pickupAddress}
            dropAddress={dropAddress}
            distanceKm={distanceKm}
            durationStr={durationStr}
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

        {/* Screen 8: Booking Summary */}
        {currentScreen === "summary" && (
          <BookingSummaryScreen
            pickupAddress={pickupAddress}
            dropAddress={dropAddress}
            vehicle={selectedVehicle}
            cargoType={cargoData.cargoType}
            weightTons={cargoData.weightTons}
            distanceKm={distanceKm}
            durationStr={durationStr}
            totalPrice={totalCalculatedPrice}
            isLoading={isSubmittingBooking}
            onBack={() => setCurrentScreen("quote")}
            onEditPickup={() => setCurrentScreen("pickup")}
            onEditDrop={() => setCurrentScreen("drop")}
            onConfirmAndPay={handleConfirmAndPay}
          />
        )}

        {/* Screen 9: Booking Confirmation */}
        {currentScreen === "confirmation" && (
          <BookingConfirmationScreen
            bookingId={createdBooking?.request_number || "CRGX20261010-7990"}
            bookingData={createdBooking}
            onTrackShipment={() => {
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
            requestId={createdBooking?.id || createdBooking?._id}
            bookingRef={createdBooking?.request_number || "CRGX20261010-7990"}
            vehicleModel={selectedVehicle.name}
            vehicleCapacity={selectedVehicle.capacity}
          />
        )}

        {/* Screen 11: My Bookings */}
        {currentScreen === "bookings" && (
          <MyBookingsScreen
            bookingsList={activeBookingsList}
            onBack={() => {
              setActiveTab("home");
              setCurrentScreen("home");
            }}
            onLiveTracking={(_b) => {
              setActiveTab("track");
              setCurrentScreen("tracking");
            }}
            onViewDetails={(_b) => {
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
          />
        )}

        {/* Bottom Navigation Bar visible on primary tabs matching Screen 2, 11, 12 */}
        {showBottomNav && (
          <MobileBottomNav activeTab={activeTab} onChangeTab={handleTabChange} />
        )}
      </div>
    </div>
  );
}
