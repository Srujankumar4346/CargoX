import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LogOut, Truck, FileText, Map as MapIcon } from "lucide-react";
import { api } from "../../services/api";
import TrackingMap from "../../components/TrackingMap";
import NotificationDropdown from "../../components/NotificationDropdown";
import StructuredAddressForm, { type AddressData } from "../../components/StructuredAddressForm";

export default function CustomerDashboard() {
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [formData, setFormData] = useState({ 
    pickup_company: "", pickup_address: "", pickup_lat: "", pickup_lng: "", 
    drop_company: "", drop_address: "", drop_lat: "", drop_lng: "", 
    cargo: "", weight: "" 
  });
  const [trackingTrip, setTrackingTrip] = useState<any>(null);
  const [trackingLocations, setTrackingLocations] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setBookings(await api.getBookings());
      // Filter invoices for customer 1 (Mock)
      const allInvoices = await api.getInvoices();
      setInvoices(allInvoices.filter((i: any) => i.customer_id === 1));
    } catch (e) {
      console.error("Failed to load data", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);
  
  // Track location history if a tracking trip is active
  useEffect(() => {
     let interval: any;
     if (trackingTrip && trackingTrip.status === "IN TRANSIT") {
         const fetchLocs = async () => {
             try {
                 const locs = await api.getLocationHistory(trackingTrip.id);
                 setTrackingLocations(locs);
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
      await api.createBooking({
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
      });
      setShowBookingForm(false);
      loadData();
    } catch (e) {
      alert("Failed to create booking: " + e);
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
  
  const handleTrackBooking = async (bookingId: number) => {
      try {
          const tripsResp = await fetch("http://127.0.0.1:8000/api/trips/");
          if(tripsResp.ok) {
              const trips = await tripsResp.json();
              const trip = trips.find((t: any) => t.booking_id === bookingId);
              if (trip) {
                  setTrackingTrip(trip);
                  const locs = await api.getLocationHistory(trip.id);
                  setTrackingLocations(locs);
              } else {
                  alert("Trip not yet assigned for tracking.");
              }
          }
      } catch (e) {
          alert("Error loading tracking.");
      }
  };

  return (
    <div className="min-h-screen bg-surface-elevated relative">
      {trackingTrip && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-surface rounded-lg shadow-xl w-full max-w-4xl p-6">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xl font-bold flex items-center gap-2"><MapIcon/> Live Tracking - Booking #CX100{trackingTrip.booking_id}</h3>
                     <button onClick={() => setTrackingTrip(null)} className="text-muted font-bold hover:text-black text-xl">×</button>
                  </div>
                  <TrackingMap trip={trackingTrip} locations={trackingLocations} />
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
              onClick={() => setShowBookingForm(!showBookingForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium shadow hover:bg-blue-700"
            >
              {showBookingForm ? "Cancel" : "+ Book Transport"}
            </button>
          </div>

          {showBookingForm && (
            <div className="bg-surface rounded-lg shadow-sm border border-border-theme p-6 mb-8">
              <h3 className="text-xl font-bold mb-4">Request a Vehicle</h3>
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
                   <div className="flex items-center gap-4">
                     <span className="bg-surface-elevated text-foreground px-3 py-1 rounded-full text-xs font-bold">{booking.status}</span>
                     {booking.status !== "REQUESTED" && booking.status !== "CANCELLED" && (
                         <button onClick={() => handleTrackBooking(booking.id)} className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded hover:bg-blue-200 text-sm flex items-center gap-1">
                            <MapIcon size={14}/> Track
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
              invoices.map((inv: any) => (
                <div key={inv.id} className="p-4 flex justify-between items-center">
                   <div>
                      <p className="font-bold text-foreground">Invoice {inv.invoice_number}</p>
                      <p className="text-sm text-muted">Booking #CX100{inv.booking_id} • {inv.issue_date}</p>
                      <p className="text-sm font-medium text-foreground mt-1">Total: ₹{inv.total_amount}</p>
                   </div>
                   <div className="flex flex-col items-end gap-2">
                     <span className={`px-3 py-1 rounded-full text-xs font-bold ${inv.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                       {inv.status} (Due: ₹{inv.amount_due})
                     </span>
                     {inv.status !== 'PAID' && (
                       <button onClick={() => handlePayInvoice(inv.id, inv.amount_due)} className="text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded font-bold flex items-center gap-1">
                         Record Payment (Demo)
                       </button>
                     )}
                   </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

