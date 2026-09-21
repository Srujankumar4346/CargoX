import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LogOut, Truck, FileText, Map as MapIcon, Download, Eye, Printer } from "lucide-react";
import { useAuth, UserButton, SignInButton } from "@clerk/react";
import { api, setTokenGetter } from "../../services/api";
import TrackingMap from "../../components/TrackingMap";
import NotificationDropdown from "../../components/NotificationDropdown";
import StructuredAddressForm, { type AddressData } from "../../components/StructuredAddressForm";
import { generateInvoicePDF } from "../../utils/invoicePDF";

export default function CustomerDashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [formData, setFormData] = useState({ 
    pickup_company: "", pickup_address: "", pickup_lat: "", pickup_lng: "", 
    drop_company: "", drop_address: "", drop_lat: "", drop_lng: "", 
    cargo: "", weight: "", distance: "" 
  });
  const [trackingTrip, setTrackingTrip] = useState<any>(null);
  const [trackingLocations, setTrackingLocations] = useState<any[]>([]);
  const [pricePerKm, setPricePerKm] = useState<number>(22);
  
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [editBookingData, setEditBookingData] = useState<any>(null);


  // Wire Clerk token retrieval into API service
  useEffect(() => {
    if (getToken) {
      setTokenGetter(getToken);
    }
  }, [getToken]);

  const loadData = async () => {
    try {
      const b = await api.getBookings();
      setBookings(Array.isArray(b) ? b : []);
      
      try {
        const allInvoices = await api.getInvoices();
        setInvoices(Array.isArray(allInvoices) ? allInvoices : []);
      } catch (invErr) {
        console.warn("Could not fetch invoices:", invErr);
      }
      
      try {
        const pricing = await api.getActivePricing();
        if (pricing && pricing.base_rate_per_km) {
          setPricePerKm(parseFloat(pricing.base_rate_per_km));
        }
      } catch (e) {
        console.error("Failed to load active pricing config", e);
      }
    } catch (e) {
      console.error("Failed to load data", e);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      loadData();
    }
  }, [isLoaded, isSignedIn]);
  
  // Track location history if a tracking trip is active
  useEffect(() => {
     let interval: any;
      if (trackingTrip && trackingTrip.status === "IN TRANSIT") {
         const fetchLocs = async () => {
             try {
                 const trackData = await api.getTracking(trackingTrip.request_id || trackingTrip.id);
                 if (trackData && trackData.location_history) {
                    setTrackingLocations(trackData.location_history);
                 }
             } catch (e) {}
         };
         fetchLocs();
         interval = setInterval(fetchLocs, 10000);
     }
     return () => {
         if(interval) clearInterval(interval);
     };
  }, [trackingTrip]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        goods_type: formData.cargo,
        weight_tons: parseFloat(formData.weight) || 0,
        pickup_company_name: formData.pickup_company || "Unknown Company",
        pickup_address: formData.pickup_address || "Unknown Address",
        pickup_lat: formData.pickup_lat !== "" ? parseFloat(formData.pickup_lat) : null,
        pickup_lng: formData.pickup_lng !== "" ? parseFloat(formData.pickup_lng) : null,
        destination_company_name: formData.drop_company || "Unknown Company",
        destination_address: formData.drop_address || "Unknown Address",
        destination_lat: formData.drop_lat !== "" ? parseFloat(formData.drop_lat) : null,
        destination_lng: formData.drop_lng !== "" ? parseFloat(formData.drop_lng) : null,
      };
      
      if (editBookingData) {
        await api.updateBooking(editBookingData.id, payload);
        setEditBookingData(null);
      } else {
        await api.createBooking(payload);
      }
      
      setShowBookingForm(false);
      loadData();
    } catch (e) {
      alert("Failed to create/update booking: " + e);
    }
  };

  const handleEditClick = (booking: any) => {
      setEditBookingData(booking);
      setFormData({
         pickup_company: booking.pickup_company_name || "",
         pickup_address: booking.pickup_address || "",
         pickup_lat: booking.pickup_lat?.toString() || "",
         pickup_lng: booking.pickup_lng?.toString() || "",
         drop_company: booking.destination_company_name || "",
         drop_address: booking.destination_address || "",
         drop_lat: booking.destination_lat?.toString() || "",
         drop_lng: booking.destination_lng?.toString() || "",
         cargo: booking.goods_type || "",
         weight: booking.weight_tons?.toString() || "",
         distance: booking.distance_km?.toString() || "0",
      });
      setShowBookingForm(true);
  };

  const handleCancelClick = async (booking: any) => {
      if (booking.status === "SUBMITTED" || booking.status === "UNDER_REVIEW") {
          if (confirm("Are you sure you want to cancel this booking?")) {
             try {
                await api.cancelBooking(booking.id);
                loadData();
             } catch(e) {
                alert("Failed to cancel: " + e);
             }
          }
      } else {
          setCancelBookingId(booking.id);
          setCancelReason("");
      }
  };

  const handleCancelConfirm = async () => {
      if (!cancelReason.trim()) {
          alert("Please provide a reason for cancellation.");
          return;
      }
      try {
          await api.cancelBooking(cancelBookingId!, cancelReason);
          setCancelBookingId(null);
          loadData();
      } catch(e) {
          alert("Failed to cancel: " + e);
      }
  };

  const handlePayInvoice = async (invoiceId: number, amountDue: number) => {
    try {
      await api.createPayment({
        invoice_id: invoiceId,
        amount: amountDue,
        payment_method: "CREDIT_CARD",
        payment_type: "FULL",
        recorded_by: "Customer"
      });
      alert("Payment successful!");
      loadData();
    } catch (e) {
      alert("Payment failed: " + e);
    }
  };

  const handlePrintInvoice = (inv: any, autoPrint: boolean = true) => {
    // Find the matching booking to enrich the invoice with delivery details
    const booking = bookings.find((b: any) =>
      b.id === inv.request_id || b.request_number === inv.tracking_number
    );
    generateInvoicePDF(inv, booking, autoPrint);
  };
  
  const handleTrackBooking = async (bookingId: string) => {
      try {
          const trackData = await api.getTracking(bookingId);
          if (trackData) {
             setTrackingTrip(trackData);
             setTrackingLocations(trackData.location_history || []);
          } else {
             alert("Tracking not active yet. Waiting for dispatch.");
          }
      } catch (e) {
          alert("Error loading tracking.");
      }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-center max-w-md w-full shadow-2xl">
          <Truck className="mx-auto h-12 w-12 text-blue-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-gray-400 text-sm mb-6">You must be signed in to submit bookings and view invoices.</p>
          <div className="flex justify-center gap-4">
            <SignInButton mode="modal">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg">
                Sign In / Sign Up
              </button>
            </SignInButton>
            <Link to="/" className="bg-slate-700 hover:bg-slate-600 text-gray-200 font-medium px-4 py-2.5 rounded-xl transition-all">
              Home Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-elevated relative">
      {cancelBookingId && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6">
                  <h3 className="text-xl font-bold mb-4">Cancel Booking</h3>
                  <p className="text-muted text-sm mb-4">This booking has already been processed. Please provide a reason for cancellation.</p>
                  <textarea 
                     value={cancelReason}
                     onChange={(e) => setCancelReason(e.target.value)}
                     className="w-full border rounded-md p-2 mb-4"
                     placeholder="Cancellation Reason..."
                     rows={3}
                  />
                  <div className="flex justify-end gap-2">
                     <button onClick={() => setCancelBookingId(null)} className="px-4 py-2 text-muted hover:text-black">Close</button>
                     <button onClick={handleCancelConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md font-bold">Confirm Cancel</button>
                  </div>
              </div>
          </div>
      )}

      {trackingTrip && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-surface rounded-lg shadow-xl w-full max-w-4xl p-6">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xl font-bold flex items-center gap-2"><MapIcon/> Live Tracking - {trackingTrip.request_number}</h3>
                     <button onClick={() => setTrackingTrip(null)} className="text-muted font-bold hover:text-black text-xl">×</button>
                  </div>
                  <TrackingMap trip={{...trackingTrip, request: trackingTrip}} locations={trackingLocations} />
              </div>
          </div>
      )}

      <header className="bg-blue-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Truck />
            <h1 className="text-2xl font-bold">CargoX Customer</h1>
          </div>
          <div className="flex items-center gap-6">
            <NotificationDropdown userType="CUSTOMER" userId={1} />
            <UserButton />
            <Link to="/" className="flex items-center gap-2 hover:text-gray-200">
              <LogOut size={20} /> Logout
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">My Bookings</h2>
            <button 
              onClick={() => {
                if (showBookingForm) {
                   setShowBookingForm(false);
                   setEditBookingData(null);
                } else {
                   setFormData({
                     pickup_company: "", pickup_address: "", pickup_lat: "", pickup_lng: "", 
                     drop_company: "", drop_address: "", drop_lat: "", drop_lng: "", 
                     cargo: "", weight: "", distance: "" 
                   });
                   setShowBookingForm(true);
                }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium shadow hover:bg-blue-700"
            >
              {showBookingForm ? "Cancel" : "+ Book Transport"}
            </button>
          </div>

          {showBookingForm && (
            <div className="bg-surface rounded-lg shadow-sm border border-border-theme p-6 mb-8">
              <h3 className="text-xl font-bold mb-4">{editBookingData ? "Edit Booking" : "Request a Vehicle"}</h3>
              <form onSubmit={handleBookingSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <StructuredAddressForm 
                    title="Pickup Address" 
                    onChange={(data: AddressData) => setFormData({
                      ...formData, 
                      pickup_company: data.company,
                      pickup_address: data.address,
                      pickup_lat: "",
                      pickup_lng: ""
                    })} 
                  />
                  <StructuredAddressForm 
                    title="Drop Address" 
                    onChange={(data: AddressData) => setFormData({
                      ...formData, 
                      drop_company: data.company,
                      drop_address: data.address,
                      drop_lat: "",
                      drop_lng: ""
                    })} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">Cargo Type</label>
                  <input type="text" required value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})} className="mt-1 block w-full rounded-md border-border-theme shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" placeholder="e.g. Furniture" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">Cargo Weight (Tons)</label>
                  <input type="number" required step="0.1" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="mt-1 block w-full rounded-md border-border-theme shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" placeholder="e.g. 3.5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">Distance (Kilometers)</label>
                  <input type="number" required step="1" value={formData.distance} onChange={e => setFormData({...formData, distance: e.target.value})} className="mt-1 block w-full rounded-md border-border-theme shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" placeholder="e.g. 150" />
                </div>
                {formData.distance && (
                  <div className="md:col-span-2 bg-blue-50 border border-blue-200 p-4 rounded-md flex justify-between items-center text-blue-900 shadow-sm mt-2">
                    <div>
                      <span className="font-bold block">Estimated Delivery Charge</span>
                      <span className="text-xs text-blue-700">Calculated at ₹{pricePerKm} per kilometer</span>
                    </div>
                    <span className="text-2xl font-black">₹{(parseFloat(formData.distance) * pricePerKm).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                )}
                <div className="md:col-span-2">
                  <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded-md font-bold hover:bg-blue-700">Confirm Booking Request</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden divide-y divide-gray-200">
            {bookings.length === 0 ? (
              <p className="p-4 text-muted text-center">No bookings found.</p>
            ) : (
              bookings.map((booking: any) => (
                <div key={booking.id} className="p-4 flex justify-between items-center">
                   <div>
                      <p className="font-bold text-foreground">{booking.pickup_company_name} - {booking.pickup_address} → {booking.destination_company_name} - {booking.destination_address}</p>
                      <p className="text-sm text-muted">{booking.weight_tons} Ton {booking.goods_type} • {booking.request_number || `REQ-${booking.id}`}</p>
                   </div>
                     <div className="flex items-center gap-2 mt-3 sm:mt-0">
                       <span className="bg-surface-elevated text-foreground px-3 py-1 rounded-full text-xs font-bold">{booking.status}</span>
                       
                       {(booking.status === "SUBMITTED" || booking.status === "UNDER_REVIEW") && (
                           <button onClick={() => handleEditClick(booking)} className="bg-gray-100 text-gray-700 font-bold px-3 py-1 rounded hover:bg-gray-200 text-xs">
                              Edit
                           </button>
                       )}
                       
                       {booking.status !== "CUSTOMER_CANCELLED" && booking.status !== "COMPLETED" && booking.status !== "DELIVERED" && booking.status !== "DRIVER_ASSIGNED" && booking.status !== "IN_TRANSIT" && booking.status !== "PICKUP_IN_PROGRESS" && booking.status !== "ARRIVED" && booking.status !== "POD_SUBMITTED" && (
                           <button onClick={() => handleCancelClick(booking)} className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded hover:bg-red-200 text-xs">
                              Cancel
                           </button>
                       )}

                       {booking.status !== "REQUESTED" && booking.status !== "SUBMITTED" && booking.status !== "CUSTOMER_CANCELLED" && (
                           <button onClick={() => handleTrackBooking(booking.id)} className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded hover:bg-blue-200 text-xs flex items-center gap-1">
                              <MapIcon size={12}/> Track
                           </button>
                       )}
                     </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-6">
            <FileText className="text-foreground" />
            <h2 className="text-2xl font-bold text-foreground">My Invoices</h2>
          </div>
          <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden divide-y divide-gray-200">
            {invoices.length === 0 ? (
              <p className="p-4 text-muted text-center">No invoices found.</p>
            ) : (
              invoices.map((inv: any) => {
                // Match booking for display
                const booking = bookings.find((b: any) => b.id === inv.request_id);
                const bookingId = booking?.request_number || inv.invoice_number;
                return (
                  <div key={inv.id} className="p-4 flex flex-wrap justify-between items-start gap-3">
                     <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground">{inv.invoice_number}</p>
                        <p className="text-sm text-muted">Booking: <span className="font-mono font-semibold">{bookingId}</span></p>
                        {booking && (
                          <p className="text-xs text-muted mt-1">
                            {booking.pickup_address} → {booking.destination_address} &nbsp;•&nbsp; {booking.weight_tons}T {booking.goods_type}
                          </p>
                        )}
                        <p className="text-sm font-bold text-foreground mt-1">Total: ₹{parseFloat(inv.total_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
                     </div>
                     <div className="flex flex-col items-end gap-2.5">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                          inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                          inv.status === 'PARTIALLY_PAID' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                          'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {inv.status} • Due: ₹{parseFloat(inv.amount_due).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* View Invoice */}
                          <button 
                            onClick={() => handlePrintInvoice(inv, false)} 
                            title="View Invoice"
                            className="inline-flex items-center gap-1 bg-surface-elevated hover:bg-surface-elevated/80 text-foreground border border-border-theme px-2.5 py-1.5 rounded text-xs font-semibold transition"
                          >
                            <Eye size={13}/> View
                          </button>
                          {/* Print Invoice */}
                          <button 
                            onClick={() => handlePrintInvoice(inv, true)} 
                            title="Print Invoice"
                            className="inline-flex items-center gap-1 bg-surface-elevated hover:bg-surface-elevated/80 text-foreground border border-border-theme px-2.5 py-1.5 rounded text-xs font-semibold transition"
                          >
                            <Printer size={13}/> Print
                          </button>
                          {/* Download PDF */}
                          <button 
                            onClick={() => handlePrintInvoice(inv, true)} 
                            title="Download PDF"
                            className="inline-flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition"
                          >
                            <Download size={13}/> Download PDF
                          </button>
                          {inv.status !== 'PAID' && (
                            <button 
                              onClick={() => handlePayInvoice(inv.id, inv.amount_due)} 
                              className="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded font-semibold transition"
                            >
                              Pay Now
                            </button>
                          )}
                        </div>
                      </div>
                  </div>
                );
              })
            )}
          </div>
        </div>


      </main>
    </div>
  );
}

