import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { LogOut, Receipt, MapPin, Navigation, User, Bell } from "lucide-react";
import { api } from "../../services/api";

export default function DriverDashboard() {
  const [activeTab, setActiveTab] = useState("trips"); // trips, expenses, profile
  const [trip, setTrip] = useState<any>(null);
  const [expenseForm, setExpenseForm] = useState({ type: "FUEL", amount: "", desc: "" });
  const [podForm, setPodForm] = useState({ receiver_name: "", notes: "" });
  const [showPodModal, setShowPodModal] = useState(false);
  const [locationLog, setLocationLog] = useState<string[]>([]);
  
  const simInterval = useRef<any>(null);

  const loadData = async () => {
    try {
      const tripsResp = await fetch("http://127.0.0.1:8000/api/trips/");
      if (tripsResp.ok) {
        const trips = await tripsResp.json();
        if (trips.length > 0) {
           const activeTrip = trips[trips.length - 1];
           setTrip(activeTrip);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // GPS Simulation logic
  useEffect(() => {
    if (trip && trip.status === "IN TRANSIT") {
      // Start simulator
      if (!simInterval.current) {
        let lat = trip.booking.pickup_latitude || 17.3850;
        let lng = trip.booking.pickup_longitude || 78.4867;
        const dropLat = trip.booking.drop_latitude || 16.5062;
        const dropLng = trip.booking.drop_longitude || 80.6480;
        
        simInterval.current = setInterval(async () => {
          // Move 10% closer to drop location each time
          lat = lat + (dropLat - lat) * 0.1;
          lng = lng + (dropLng - lng) * 0.1;
          
          try {
            await api.logLocation(trip.id, lat, lng);
            setLocationLog(prev => [`[${new Date().toLocaleTimeString()}] Pushed GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, ...prev.slice(0, 4)]);
          } catch (e) {
             console.error("GPS Sim Error:", e);
          }
        }, 10000); // every 10 seconds
      }
    } else {
      // Stop simulator
      if (simInterval.current) {
        clearInterval(simInterval.current);
        simInterval.current = null;
      }
    }
    
    return () => {
      if (simInterval.current) clearInterval(simInterval.current);
    };
  }, [trip]);

  const handleUpdateStatus = async (nextStatus: string) => {
    if (!trip) return;
    try {
      await api.updateTripStatus(trip.id, nextStatus);
      loadData();
    } catch (e: any) {
      alert("Failed to update status: " + e);
    }
  };

  const handleSubmitPod = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await api.submitPOD(trip.id, {
              receiver_name: podForm.receiver_name,
              signature_url: "/simulated_signatures/sig_1.png",
              notes: podForm.notes
          });
          alert("Proof of Delivery submitted successfully!");
          setShowPodModal(false);
          // Now mark it delivered and completed
          await api.updateTripStatus(trip.id, "DELIVERED");
          await api.updateTripStatus(trip.id, "COMPLETED");
          loadData();
      } catch(err: any) {
          alert("POD Failed: " + err);
      }
  };

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    try {
      await api.createExpense({
        trip_id: trip.id,
        expense_type: expenseForm.type,
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.desc,
        recorded_by: "Driver 1"
      });
      alert("Expense logged successfully!");
      setExpenseForm({ type: "FUEL", amount: "", desc: "" });
    } catch (err: any) {
      alert("Failed to log expense: " + err);
    }
  };

  const getNextStatusAction = () => {
    if (!trip) return null;
    switch (trip.status) {
      case "TRIP CREATED": return { label: "Start Trip", next: "IN TRANSIT" };
      case "IN TRANSIT": return { label: "Arrived at Destination", next: "ARRIVED AT DESTINATION" };
      case "ARRIVED AT DESTINATION": return { label: "Submit Proof of Delivery", action: "POD" };
      default: return null;
    }
  };

  const action = getNextStatusAction();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto border-x border-gray-200 shadow-xl relative pb-20">
      {/* Modal for POD */}
      {showPodModal && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl w-full p-6">
                  <h3 className="text-xl font-bold mb-4">Proof of Delivery</h3>
                  <form onSubmit={handleSubmitPod} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Receiver Name</label>
                          <input type="text" required value={podForm.receiver_name} onChange={e => setPodForm({...podForm, receiver_name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded p-2" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Notes</label>
                          <textarea value={podForm.notes} onChange={e => setPodForm({...podForm, notes: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded p-2" rows={3}></textarea>
                      </div>
                      <div className="bg-gray-100 p-4 rounded text-center border-2 border-dashed border-gray-300 text-gray-500">
                          [ Sign Here ]
                      </div>
                      <div className="flex gap-4">
                          <button type="button" onClick={() => setShowPodModal(false)} className="flex-1 bg-gray-200 text-gray-800 p-3 rounded-lg font-bold">Cancel</button>
                          <button type="submit" className="flex-1 bg-green-600 text-white p-3 rounded-lg font-bold">Submit</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      <header className="bg-green-600 text-white shadow-md sticky top-0 z-10">
        <div className="px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">CargoX Driver</h1>
          <button className="relative p-2 hover:bg-green-700 rounded-full">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {activeTab === "trips" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Assigned Trip</h2>

            {trip ? (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                   <div>
                     <h3 className="text-xl font-bold text-gray-900">Booking #CX100{trip.booking_id}</h3>
                     <p className="text-gray-500 mt-1">Trip ID: {trip.id}</p>
                   </div>
                   <span className={`px-3 py-1 rounded-full text-sm font-bold ${trip.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>{trip.status}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <p className="font-semibold">{trip.status}</p>
                   </div>
                   <div>
                      <p className="text-sm text-gray-500">Route</p>
                      <p className="font-semibold">{trip.booking.pickup_address} → {trip.booking.drop_address}</p>
                   </div>
                </div>

                <div className="flex gap-4">
                   {action ? (
                     <button 
                       onClick={() => action.action === "POD" ? setShowPodModal(true) : handleUpdateStatus(action.next as string)}
                       className="flex-1 bg-green-600 text-white py-3 rounded-md font-bold text-lg shadow hover:bg-green-700"
                     >
                        {action.label}
                     </button>
                   ) : (
                     <div className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-md font-bold text-lg text-center border border-gray-200">
                        Trip Completed
                     </div>
                   )}
                </div>

                {trip.status === "IN TRANSIT" && (
                    <div className="mt-6 bg-gray-900 text-green-400 p-4 rounded font-mono text-xs shadow-inner">
                        <div className="flex items-center gap-2 mb-2 font-bold text-white">
                            <MapPin size={16} /> GPS Simulator Active
                        </div>
                        {locationLog.map((log, i) => (
                            <div key={i} className="opacity-80">{log}</div>
                        ))}
                        {locationLog.length === 0 && <div>Waiting for next GPS ping... (every 10s)</div>}
                    </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No active trips assigned.</p>
            )}
          </div>

        )}

        {activeTab === "expenses" && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="text-gray-700" />
              <h2 className="text-xl font-bold text-gray-800">Log Expense</h2>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                {!trip ? (
                    <p className="text-gray-500 text-center py-4">You must have an active trip.</p>
                ) : (
                    <form onSubmit={handleLogExpense} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Expense Type</label>
                          <select value={expenseForm.type} onChange={e => setExpenseForm({...expenseForm, type: e.target.value})} className="block w-full rounded-lg border-gray-300 bg-gray-50 border p-3">
                             <option value="FUEL">Fuel</option>
                             <option value="TOLL">Toll Tax</option>
                             <option value="ALLOWANCE">Driver Allowance</option>
                             <option value="MAINTENANCE">Maintenance</option>
                             <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (INR)</label>
                          <input type="number" required min="1" step="0.1" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="block w-full rounded-lg border-gray-300 bg-gray-50 border p-3" placeholder="e.g. 500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <input type="text" value={expenseForm.desc} onChange={e => setExpenseForm({...expenseForm, desc: e.target.value})} className="block w-full rounded-lg border-gray-300 bg-gray-50 border p-3" placeholder="e.g. Toll at NH44" />
                        </div>
                        <button type="submit" className="w-full bg-green-600 text-white p-4 rounded-xl font-bold shadow-md active:bg-green-700 mt-4">Submit Expense</button>
                    </form>
                )}
            </div>
          </div>
        )}
        
        {activeTab === "profile" && (
          <div className="p-4 text-center">
             <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-md">
                <User size={40} className="text-green-600"/>
             </div>
             <h2 className="text-xl font-bold">Driver Name</h2>
             <p className="text-gray-500 mb-8">Vehicle: AP 09 XY 1234</p>
             <Link to="/" className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-6 py-3 rounded-full font-bold">
               <LogOut size={20} /> Logout
             </Link>
          </div>
        )}

      </main>
      
      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 fixed bottom-0 w-full max-w-md flex justify-around items-center pb-safe pt-2 pb-2">
         <button onClick={() => setActiveTab('trips')} className={`flex flex-col items-center p-2 ${activeTab === 'trips' ? 'text-green-600' : 'text-gray-400'}`}>
            <Navigation size={24} className={activeTab === 'trips' ? 'fill-current' : ''}/>
            <span className="text-[10px] font-bold mt-1">Trips</span>
         </button>
         <button onClick={() => setActiveTab('expenses')} className={`flex flex-col items-center p-2 ${activeTab === 'expenses' ? 'text-green-600' : 'text-gray-400'}`}>
            <Receipt size={24}/>
            <span className="text-[10px] font-bold mt-1">Expenses</span>
         </button>
         <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center p-2 ${activeTab === 'profile' ? 'text-green-600' : 'text-gray-400'}`}>
            <User size={24}/>
            <span className="text-[10px] font-bold mt-1">Profile</span>
         </button>
      </nav>
    </div>
  );
}
