import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LogOut, Map as MapIcon, Bot, Sparkles, Navigation } from "lucide-react";
import { api } from "../../services/api";
import TrackingMap from "../../components/TrackingMap";
import NotificationDropdown from "../../components/NotificationDropdown";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("trips");
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<Record<number, any>>({});

  const loadData = async () => {
    try {
      setBookings(await api.getBookings());
      setVehicles(await api.getVehicles());
      setDrivers(await api.getDrivers());
      setInvoices(await api.getInvoices());
      setExpenses(await api.getExpenses());
      setDashboard(await api.getFinancialDashboard());
      
      const tripsResp = await fetch("http://127.0.0.1:8000/api/trips/");
      if (tripsResp.ok) setTrips(await tripsResp.json());
      setDashboard(await api.getFinancialDashboard());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTrip = async (bookingId: number) => {
    if (!selectedVehicle || !selectedDriver) return alert("Select vehicle and driver");
    try {
      await api.createTrip({
        booking_id: bookingId,
        vehicle_id: parseInt(selectedVehicle),
        driver_id: parseInt(selectedDriver)
      });
      alert("Trip created successfully! Invoice auto-generated.");
      loadData();
      setSelectedVehicle("");
      setSelectedDriver("");
      setAiRecommendations(prev => {
        const next = {...prev};
        delete next[bookingId];
        return next;
      });
    } catch (e: any) {
      alert("Failed to create trip: " + e);
    }
  };
  
  const handleAskAi = async (e: any) => {
      e.preventDefault();
      if (!aiQuery) return;
      setAiLoading(true);
      try {
          const res = await api.askAssistant(aiQuery);
          setAiResponse(res);
      } catch (err: any) {
          alert("Failed to query AI: " + err.message);
      } finally {
          setAiLoading(false);
      }
  };
  
  const handleGetTripRecommendation = async (booking: any) => {
      try {
          // 1. Vehicle recommendation
          const v_rec = await api.recommendVehicle(booking.cargo_weight);
          
          // 2. Pricing estimation (Mock distance if coordinates aren't real, but we have a dedicated endpoint)
          const p_rec = await api.predictPrice(500, booking.cargo_weight); // default 500km for demo
          
          // 3. Route intelligence
          let r_rec = [];
          if (booking.pickup_latitude && booking.drop_latitude) {
             r_rec = await api.recommendRoute(booking.pickup_latitude, booking.pickup_longitude, booking.drop_latitude, booking.drop_longitude);
          }
          
          setAiRecommendations(prev => ({
              ...prev,
              [booking.id]: { vehicle: v_rec, price: p_rec, routes: r_rec }
          }));
          
          if (v_rec && v_rec.vehicle) {
              setSelectedVehicle(v_rec.vehicle.id.toString());
          }
      } catch(err: any) {
          alert("Error getting AI recommendations: " + err.message);
      }
  };

  const handleRecordPayment = async (invoiceId: number, amountDue: number) => {
    const amount = prompt(`Enter payment amount (Due: Rs. ${amountDue}):`);
    if (!amount) return;
    try {
      await api.createPayment({
        invoice_id: invoiceId,
        amount: parseFloat(amount),
        payment_method: "BANK_TRANSFER",
        payment_type: "MANUAL",
        recorded_by: "Admin"
      });
      alert("Payment recorded successfully!");
      loadData();
    } catch (e: any) {
      alert("Failed to record payment: " + e);
    }
  };

  const [trackingTrip, setTrackingTrip] = useState<any>(null);
  const [trackingLocations, setTrackingLocations] = useState<any[]>([]);

  const handleTrackTrip = async (trip: any) => {
      setTrackingTrip(trip);
      try {
          const locs = await api.getLocationHistory(trip.id);
          setTrackingLocations(locs);
      } catch (e) {}
  };

  useEffect(() => {
     let interval: any;
     if (trackingTrip && trackingTrip.status === "IN TRANSIT") {
         const fetchLocs = async () => {
             try {
                 const locs = await api.getLocationHistory(trackingTrip.id);
                 setTrackingLocations(locs);
             } catch (e) {}
         };
         interval = setInterval(fetchLocs, 10000);
     }
     return () => {
         if(interval) clearInterval(interval);
     };
  }, [trackingTrip]);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
        <h2 className="text-2xl font-bold mb-8 tracking-wider">CargoX Admin</h2>
        <nav className="flex-1 space-y-2 mb-6">
          <button onClick={() => setActiveTab('bookings')} className={`w-full text-left py-2.5 px-4 rounded flex items-center justify-between ${activeTab === 'bookings' ? 'bg-gray-800' : 'hover:bg-gray-800'}`}>
             <span>Pending Bookings</span>
             {bookings.filter(b => b.status === "REQUESTED").length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{bookings.filter(b => b.status === "REQUESTED").length}</span>
             )}
          </button>
          <button onClick={() => setActiveTab('vehicles')} className={`w-full text-left py-2.5 px-4 rounded ${activeTab === 'vehicles' ? 'bg-gray-800' : 'hover:bg-gray-800'}`}>Fleet Status</button>
          <button onClick={() => setActiveTab('trips')} className={`w-full text-left py-2.5 px-4 rounded ${activeTab === 'trips' ? 'bg-gray-800' : 'hover:bg-gray-800'}`}>Active Trips</button>
          <button onClick={() => setActiveTab('financials')} className={`w-full text-left py-2.5 px-4 rounded ${activeTab === 'financials' ? 'bg-gray-800' : 'hover:bg-gray-800'}`}>Business Operations</button>
          <button onClick={() => setActiveTab('ai')} className={`w-full text-left py-2.5 px-4 rounded flex items-center gap-2 ${activeTab === 'ai' ? 'bg-gray-800 text-purple-400' : 'hover:bg-gray-800'}`}><Bot size={18}/> AI Assistant</button>
        </nav>
        
        <div className="mb-4">
           <NotificationDropdown userType="ADMIN" userId={0} />
        </div>
        
        <Link to="/" className="flex items-center gap-2 mt-auto py-2.5 px-4 hover:bg-gray-800 rounded">
          <LogOut size={20} /> Logout
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {activeTab === 'bookings' && (
          <div>
             <h1 className="text-3xl font-bold text-gray-800 mb-6">Pending Bookings Assignment</h1>
             
             {bookings.filter(b => b.status === "REQUESTED").map(booking => (
               <div key={booking.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                  <div className="flex justify-between items-start mb-4 border-b pb-4">
                     <div>
                       <h3 className="text-xl font-bold text-gray-900">Booking #CX100{booking.id}</h3>
                       <p className="text-gray-600 mt-1">{booking.pickup_location} → {booking.drop_location}</p>
                       <p className="text-sm font-medium text-blue-600 mt-2">Cargo: {booking.cargo_weight} Ton {booking.cargo_type}</p>
                     </div>
                     <div className="flex flex-col items-end gap-2">
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold">PENDING</span>
                        <button onClick={() => handleGetTripRecommendation(booking)} className="bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded text-sm flex items-center gap-1 hover:bg-purple-200">
                           <Sparkles size={14}/> Get AI Recommendation
                        </button>
                     </div>
                  </div>
                  
                  {aiRecommendations[booking.id] && (
                     <div className="mb-6 bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2"><Sparkles size={16}/> AI Intelligence Report</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                           <div>
                               <p className="font-bold text-gray-800">Recommended Vehicle</p>
                               <p className="text-gray-600 mb-1">Vehicle {aiRecommendations[booking.id].vehicle?.vehicle?.vehicle_number} (Score: {aiRecommendations[booking.id].vehicle?.score}/100)</p>
                               <ul className="text-xs text-gray-500 space-y-1">
                                   {aiRecommendations[booking.id].vehicle?.reasons?.map((r: string, i: number) => <li key={i}>{r}</li>)}
                               </ul>
                           </div>
                           <div>
                               <p className="font-bold text-gray-800">Price Prediction</p>
                               <p className="text-gray-600 mb-1">Suggested Price: ₹{aiRecommendations[booking.id].price?.total}</p>
                               <ul className="text-xs text-gray-500 space-y-1">
                                   <li>Base: ₹{aiRecommendations[booking.id].price?.base}</li>
                                   <li>Distance: ₹{aiRecommendations[booking.id].price?.distance}</li>
                                   <li>Margin: ₹{aiRecommendations[booking.id].price?.margin}</li>
                               </ul>
                           </div>
                        </div>
                     </div>
                  )}
                  
                  <form className="grid grid-cols-2 gap-4 border-t pt-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700">Assign Vehicle</label>
                       <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2">
                          <option value="">Select Available Vehicle...</option>
                          {vehicles.filter(v => v.status === "AVAILABLE").map(v => (
                            <option key={v.id} value={v.id}>[ {v.vehicle_number} ] {v.capacity}</option>
                          ))}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-700">Assign Driver</label>
                       <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2">
                          <option value="">Select Available Driver...</option>
                          {drivers.filter(d => d.status === "AVAILABLE").map(d => (
                            <option key={d.id} value={d.id}>[ {d.full_name} ]</option>
                          ))}
                       </select>
                     </div>
                     <div className="col-span-2 text-right mt-2">
                       <button type="button" onClick={() => handleCreateTrip(booking.id)} className="bg-blue-600 text-white px-6 py-2 rounded-md font-bold hover:bg-blue-700">Create Trip</button>
                     </div>
                  </form>
               </div>
             ))}
             
             {bookings.filter(b => b.status === "REQUESTED").length === 0 && (
               <p className="text-gray-500">No pending bookings.</p>
             )}
          </div>
        )}
        
        {activeTab === 'ai' && (
          <div>
             <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Bot size={32} className="text-purple-600"/> AI Business Assistant</h1>
             <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-3xl">
                <p className="text-gray-600 mb-6">Ask CargoX AI about your business performance, revenue, expenses, and fleet status.</p>
                <form onSubmit={handleAskAi} className="flex gap-4 mb-8">
                    <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="e.g. What is our net profit this month?" className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 border p-3" required />
                    <button type="submit" disabled={aiLoading} className="bg-purple-600 text-white px-6 py-3 rounded-md font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                        {aiLoading ? "Thinking..." : <><Sparkles size={18}/> Ask AI</>}
                    </button>
                </form>
                
                {aiResponse && (
                    <div className="bg-gray-50 rounded-lg p-6 border">
                        <h3 className="font-bold text-gray-900 mb-2">AI Response</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{aiResponse.answer}</p>
                        <div className="mt-4 pt-4 border-t">
                            <p className="text-xs text-gray-500 font-medium">Data tools queried: {aiResponse.context_used?.join(', ')}</p>
                        </div>
                    </div>
                )}
             </div>
          </div>
        )}
        
        {activeTab === 'trips' && (
          <div>
             <h1 className="text-3xl font-bold text-gray-800 mb-6">Active Trips</h1>
             <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
               {trips.length === 0 ? (
                 <p className="p-4 text-gray-500 text-center">No active trips found.</p>
               ) : (
                 trips.map(trip => (
                   <div key={trip.id} className="p-4 flex justify-between items-center">
                      <div>
                         <p className="font-bold text-gray-900">Trip #{trip.id} (Booking #CX100{trip.booking_id})</p>
                         <p className="text-sm text-gray-500">{trip.booking.pickup_address} → {trip.booking.drop_address}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold">{trip.status}</span>
                        {trip.status !== "TRIP CREATED" && (
                            <button onClick={() => handleTrackTrip(trip)} className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded hover:bg-blue-200 text-sm flex items-center gap-1">
                               <MapIcon size={14}/> View Map
                            </button>
                        )}
                      </div>
                   </div>
                 ))
               )}
             </div>
             
             {trackingTrip && (
                 <div className="mt-8">
                     <h2 className="text-xl font-bold mb-4">Tracking Trip #{trackingTrip.id}</h2>
                     <div className="h-96 rounded-lg overflow-hidden border shadow-sm">
                         <TrackingMap trip={trackingTrip} locations={trackingLocations} />
                     </div>
                 </div>
             )}
          </div>
        )}

        {activeTab === 'vehicles' && (
          <div>
             <h1 className="text-3xl font-bold text-gray-800 mb-6">Fleet Status</h1>
             <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50">
                      <tr>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                      {vehicles.map(v => (
                        <tr key={v.id}>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{v.vehicle_number}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.capacity} Ton</td>
                           <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-bold ${v.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{v.status}</span></td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div>
             <h1 className="text-3xl font-bold text-gray-800 mb-6">Business Dashboard</h1>
             
             {dashboard && (
                 <div className="grid grid-cols-3 gap-6 mb-8">
                     <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
                         <h3 className="text-sm font-medium text-gray-500 uppercase">Total Revenue</h3>
                         <p className="text-3xl font-bold text-gray-900 mt-2">₹{dashboard.revenue.toLocaleString()}</p>
                     </div>
                     <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-red-500">
                         <h3 className="text-sm font-medium text-gray-500 uppercase">Total Expenses</h3>
                         <p className="text-3xl font-bold text-gray-900 mt-2">₹{dashboard.expenses.toLocaleString()}</p>
                     </div>
                     <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
                         <h3 className="text-sm font-medium text-gray-500 uppercase">Net Profit</h3>
                         <p className="text-3xl font-bold text-gray-900 mt-2">₹{dashboard.profit.toLocaleString()}</p>
                     </div>
                 </div>
             )}

             <h2 className="text-2xl font-bold text-gray-800 mb-4">Invoices</h2>
             <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
                <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50">
                      <tr>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Due</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                      {invoices.map(inv => (
                        <tr key={inv.id}>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{inv.issue_date}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">₹{inv.total_amount}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">₹{inv.amount_due}</td>
                           <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{inv.status}</span></td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                               {inv.status !== 'PAID' && (
                                   <button onClick={() => handleRecordPayment(inv.id, inv.amount_due)} className="text-blue-600 hover:text-blue-800 font-medium">Record Demo Payment</button>
                               )}
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             
             <h2 className="text-2xl font-bold text-gray-800 mb-4">Trip Expenses</h2>
             <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50">
                      <tr>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip ID</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expense Type</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recorded By</th>
                      </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                      {expenses.map(exp => (
                        <tr key={exp.id}>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Trip #{exp.trip_id}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">{exp.expense_type}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">₹{exp.amount}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exp.recorded_by}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
