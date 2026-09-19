import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LogOut, Map as MapIcon, Bot, Sparkles, ShieldCheck, RefreshCw, AlertCircle, Users } from "lucide-react";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/react";
import { api, setTokenGetter } from "../../services/api";
import TrackingMap from "../../components/TrackingMap";
import NotificationDropdown from "../../components/NotificationDropdown";
import ThemeToggle from "../../components/ThemeToggle";

export default function AdminDashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<Record<number, any>>({});

  // Phase 12: Compliance State
  const [complianceDashboard, setComplianceDashboard] = useState<any>(null);
  const [complianceDocs, setComplianceDocs] = useState<any[]>([]);
  
  // Compliance Filters
  const [compStatusFilter, setCompStatusFilter] = useState<string>("ALL");
  const [compOwnerFilter, setCompOwnerFilter] = useState<string>("ALL");
  const [_compTypeFilter, _setCompTypeFilter] = useState<string>("ALL");
  
  // Rejection Modal
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  
  // Pricing
  const [activePricing, setActivePricing] = useState<any>(null);
  const [isUpdatingPricing, setIsUpdatingPricing] = useState(false);

  // Upload Form
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
     owner_type: "DRIVER",
     owner_id: "",
     document_type: "DRIVING_LICENSE",
     document_number: "",
     issued_date: "",
     expiry_date: ""
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Wire Clerk token retrieval into API service
  useEffect(() => {
    if (getToken) {
      setTokenGetter(getToken);
    }
  }, [getToken]);

  const loadData = async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const [v, d, inv, exp, dispatchRequests, finDash, tripList, pricingResp, usersList] = await Promise.allSettled([
        api.getVehicles(),
        api.getDrivers(),
        api.getInvoices(),
        api.getExpenses(),
        api.getBookings(),
        api.getFinancialDashboard(),
        api.getTrips(),
        api.getActivePricing(),
        api.getUsers()
      ]);
      
      if (v.status === 'fulfilled') setVehicles(v.value);
      if (d.status === 'fulfilled') setDrivers(d.value);
      if (inv.status === 'fulfilled') setInvoices(inv.value);
      if (exp.status === 'fulfilled') setExpenses(exp.value);
      if (exp.status === 'fulfilled') setExpenses(exp.value);
      if (pricingResp.status === 'fulfilled') setActivePricing(pricingResp.value);
      if (usersList.status === 'fulfilled') setUsers(usersList.value);
      
      if (dispatchRequests.status === 'fulfilled') {
        setBookings(dispatchRequests.value);
      } else {
        console.error("Failed to load dispatch requests:", dispatchRequests.reason);
      }
      
      if (tripList.status === 'fulfilled' && tripList.value && tripList.value.length > 0) {
        setTrips(tripList.value);
      } else if (dispatchRequests.status === 'fulfilled') {
        setTrips(dispatchRequests.value.filter((b: any) => b.status === 'IN TRANSIT' || b.status === 'DELIVERED'));
      }

      if (finDash.status === 'fulfilled') setDashboard(finDash.value);

      // Load Compliance
      await loadComplianceData();
    } catch (e: any) {
      console.error("loadData error:", e);
      setLoadError(e?.message || "Failed to load dashboard data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadComplianceData = async () => {
    try {
      setComplianceDashboard(await api.getComplianceDashboard());
      setComplianceDocs(await api.getComplianceDocuments());
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger load when Clerk authentication is confirmed
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadData();
      const interval = setInterval(() => {
        loadData();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isLoaded, isSignedIn]);

  const handleApproveBooking = async (bookingId: string) => {
    try {
      await api.approveBooking(bookingId);
      alert("Booking approved successfully! Ready for vehicle and driver dispatch.");
      loadData();
    } catch (e: any) {
      alert("Failed to approve booking: " + e);
    }
  };

  const handleCreateTrip = async (booking: any) => {
    if (!selectedVehicle || !selectedDriver) return alert("Select vehicle and driver");
    try {
      const bookingId = typeof booking === "object" ? booking.id : booking;
      const bookingStatus = typeof booking === "object" ? booking.status : null;

      // If booking is SUBMITTED, auto-approve first before dispatching
      if (bookingStatus === "SUBMITTED") {
        await api.approveBooking(bookingId);
      }

      await api.createTrip({
        booking_id: bookingId,
        vehicle_id: selectedVehicle,
        driver_id: selectedDriver
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
          const v_rec = await api.recommendVehicle(booking.weight_tons);
          
          // 2. Pricing estimation (Mock distance if coordinates aren't real, but we have a dedicated endpoint)
          const p_rec = await api.predictPrice(500, booking.weight_tons); // default 500km for demo
          
          // 3. Route intelligence
          let r_rec = [];
          if (booking.pickup_lat && booking.destination_lat) {
             r_rec = await api.recommendRoute(booking.pickup_lat, booking.pickup_lng, booking.destination_lat, booking.destination_lng);
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

  const handleApproveDocument = async (id: string) => {
     try {
        await api.verifyComplianceDocument(id, true);
        loadComplianceData();
     } catch (e: any) {
        alert("Failed to approve document: " + e.message);
     }
  };

  const handleRejectDocument = async () => {
     if (!rejectingDocId) return;
     if (!rejectionReason.trim()) {
        alert("Rejection reason is mandatory.");
        return;
     }
     try {
        await api.verifyComplianceDocument(rejectingDocId, false, rejectionReason);
        setRejectingDocId(null);
        setRejectionReason("");
        loadComplianceData();
     } catch (e: any) {
        alert("Failed to reject document: " + e.message);
     }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!uploadFile) {
        alert("Please select a file.");
        return;
     }
     if (!uploadFormData.owner_id) {
        alert("Please select an owner.");
        return;
     }

     const formData = new FormData();
     formData.append("owner_type", uploadFormData.owner_type);
     formData.append("owner_id", uploadFormData.owner_id);
     formData.append("document_type", uploadFormData.document_type);
     if (uploadFormData.document_number) formData.append("document_number", uploadFormData.document_number);
     if (uploadFormData.issued_date) formData.append("issued_date", uploadFormData.issued_date);
     if (uploadFormData.expiry_date) formData.append("expiry_date", uploadFormData.expiry_date);
     formData.append("file", uploadFile);

     try {
        await api.uploadComplianceDocument(formData);
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadFormData({ ...uploadFormData, document_number: "", issued_date: "", expiry_date: "", owner_id: "" });
        loadComplianceData();
        alert("Document uploaded successfully.");
     } catch (e: any) {
        alert("Failed to upload document: " + e.message);
     }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center text-[var(--text-primary)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-slate-400 font-medium">Connecting to CargoX Operations...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center border border-slate-700/60 shadow-2xl bg-slate-900/90 backdrop-blur rounded-2xl">
          <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
            <ShieldCheck size={36} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Admin Sign-in Required</h2>
          <p className="text-slate-400 text-sm mb-6">
            You are accessing the CargoX Admin Operations Portal on port 5174. Please sign in with your administrator account to dispatch shipments and view live operations.
          </p>
          <SignInButton mode="modal">
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
              <span>Sign In as Admin</span>
            </button>
          </SignInButton>
          <div className="mt-6 pt-4 border-t border-slate-800">
            <Link to="/" className="text-xs text-slate-400 hover:text-white transition">
              ← Return to CargoX Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 text-white min-h-screen flex flex-col shadow-2xl z-10">
        <div className="p-6 pb-2">
          <h2 className="text-2xl font-bold tracking-wider mb-2 flex items-center justify-between">
            CargoX Admin
          </h2>
          <div className="flex justify-between items-center mb-6 text-sm text-slate-400">
             <span>Premium Ops</span>
             <ThemeToggle />
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 mb-6">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left py-2.5 px-4 rounded flex items-center gap-3 ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>
             <MapIcon size={18} /> <span>Dashboard</span>
          </button>
          <button onClick={() => setActiveTab('bookings')} className={`w-full text-left py-2.5 px-4 rounded flex items-center justify-between ${activeTab === 'bookings' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>
             <div className="flex items-center gap-3"><Sparkles size={18} /> <span>Dispatch</span></div>
             {bookings.filter(b => b.status === "REQUESTED" || b.status === "SUBMITTED" || b.status === "ACCEPTED").length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{bookings.filter(b => b.status === "REQUESTED" || b.status === "SUBMITTED" || b.status === "ACCEPTED").length}</span>
             )}
          </button>
          <button onClick={() => setActiveTab('vehicles')} className={`w-full text-left py-2.5 px-4 rounded flex items-center gap-3 ${activeTab === 'vehicles' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>
             <MapIcon size={18}/> <span>Fleet Status</span>
          </button>
          <button onClick={() => setActiveTab('compliance')} className={`w-full text-left py-2.5 px-4 rounded flex items-center gap-3 ${activeTab === 'compliance' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>
             <ShieldCheck size={18}/> <span>Compliance</span>
          </button>
          <button onClick={() => setActiveTab('trips')} className={`w-full text-left py-2.5 px-4 rounded flex items-center gap-3 ${activeTab === 'trips' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>
             <MapIcon size={18}/> <span>Active Trips</span>
          </button>
          <button onClick={() => setActiveTab('financials')} className={`w-full text-left py-2.5 px-4 rounded flex items-center gap-3 ${activeTab === 'financials' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>
             <MapIcon size={18}/> <span>Financials</span>
          </button>
           <button onClick={() => setActiveTab('users')} className={`w-full text-left px-4 py-3 rounded-md transition font-medium flex items-center gap-3 ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-foreground hover:bg-surface-elevated'}`}>
             <Users size={20} /> Team Management
           </button>
           <button onClick={() => setActiveTab('ai')} className={`w-full text-left px-4 py-3 rounded-md transition font-medium flex items-center gap-3 ${activeTab === 'ai' ? 'bg-purple-600 text-white' : 'text-foreground hover:bg-surface-elevated'}`}>
             <Bot size={20} /> AI Assistant
           </button>
        </nav>
        
        <div className="mb-4 px-3">
           <NotificationDropdown userType="ADMIN" userId={0} />
        </div>
        
        <div className="p-4 border-t border-slate-800 flex items-center justify-between mt-auto">
          <div className="flex items-center gap-3 min-w-0">
            <UserButton />
            <div className="truncate max-w-[110px]">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.primaryEmailAddress?.emailAddress || user?.fullName || "Admin User"}</p>
              <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider font-bold">ADMIN</span>
            </div>
          </div>
          <Link to="/" title="Exit to Home" className="p-2 text-slate-400 hover:text-red-400 transition rounded-lg hover:bg-slate-800">
            <LogOut size={18} />
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        
        {activeTab === 'dashboard' && (
          <div className="fade-in">
             <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
               <div>
                 <h1 className="text-3xl font-bold text-[var(--text-primary)]">Operations Dashboard</h1>
                 <p className="text-sm text-[var(--text-secondary)] mt-1">Live overview of requests, fleet dispatch, and trip tracking</p>
               </div>
               <div className="flex items-center gap-3">
                 <button 
                   onClick={() => loadData()} 
                   disabled={isRefreshing}
                   className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition disabled:opacity-50"
                 >
                   <RefreshCw size={16} className={isRefreshing ? "animate-spin text-blue-400" : ""} />
                   <span>{isRefreshing ? "Updating..." : "Refresh Data"}</span>
                 </button>
                 <button 
                   onClick={() => setActiveTab('bookings')} 
                   className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-500/20"
                 >
                   <Sparkles size={16} />
                   <span>Dispatch Board ({bookings.filter(b => b.status === 'SUBMITTED' || b.status === 'REQUESTED' || b.status === 'ACCEPTED').length})</span>
                 </button>
               </div>
             </div>

             {loadError && (
               <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-between gap-3">
                 <div className="flex items-center gap-3">
                   <AlertCircle size={20} className="shrink-0" />
                   <span className="text-sm font-medium">{loadError}</span>
                 </div>
                 <button onClick={() => loadData()} className="text-xs bg-red-500/20 hover:bg-red-500/30 px-3 py-1 rounded text-white font-semibold">Retry</button>
               </div>
             )}
             
             {/* KPI Cards */}
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="card p-6">
                   <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">Active Trips</h3>
                   <p className="text-4xl font-bold text-[var(--text-primary)] mt-2">{trips.filter(t => t.status === 'IN TRANSIT').length}</p>
                </div>
                <div className="card p-6">
                   <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">Available Fleet</h3>
                   <p className="text-4xl font-bold text-green-500 mt-2">{vehicles.filter(v => v.status === 'AVAILABLE').length}</p>
                </div>
                <div className="card p-6">
                   <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">Pending Bookings</h3>
                   <p className="text-4xl font-bold text-yellow-500 mt-2">{bookings.filter(b => b.status === 'SUBMITTED' || b.status === 'REQUESTED' || b.status === 'ACCEPTED').length}</p>
                </div>
                <div className="card p-6">
                   <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">Total Revenue</h3>
                   <p className="text-4xl font-bold text-blue-500 mt-2">₹{((dashboard?.revenue || dashboard?.total_invoiced || 0)).toLocaleString()}</p>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 card p-6 min-h-[400px] flex items-center justify-center">
                   <p className="text-[var(--text-secondary)]">Fleet Map will be integrated here (Phase 8.4)</p>
                </div>
                <div className="card p-6">
                   <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Recent Activity</h3>
                   <div className="space-y-4">
                      {trips.slice(0, 3).map(t => (
                        <div key={t.id} className="flex items-start gap-3 border-b border-[var(--border-color)] pb-3">
                           <div className="bg-blue-500/10 p-2 rounded text-blue-500">
                             <MapIcon size={16} />
                           </div>
                           <div>
                             <p className="text-sm font-medium text-[var(--text-primary)]">Trip #{t.id} {t.status}</p>
                             <p className="text-xs text-[var(--text-secondary)]">
                               {t.booking?.pickup_address || t.request?.pickup_address} → {t.booking?.drop_address || t.request?.destination_address}
                             </p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        )}
        {activeTab === 'bookings' && (
          <div className="fade-in">
             <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-6">Dispatch Board (Phase 8.5)</h1>
             
             {bookings.filter(b => b.status === "REQUESTED" || b.status === "SUBMITTED" || b.status === "ACCEPTED").map(booking => (
               <div key={booking.id} className="card p-6 mb-6">
                  <div className="flex justify-between items-start mb-4 border-b pb-4">
                     <div>
                       <h3 className="text-xl font-bold text-foreground">{booking.request_number || `REQ-${booking.id.substring(0,6)}`}</h3>
                       <p className="text-muted mt-1">{booking.pickup_company_name} → {booking.destination_company_name}</p>
                       <p className="text-sm font-medium text-blue-600 mt-2">Cargo: {booking.weight_tons} Ton {booking.goods_type}</p>
                     </div>
                     <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          booking.status === 'ACCEPTED' ? 'bg-green-100 text-green-800 border border-green-300' :
                          booking.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {booking.status}
                        </span>
                        <div className="flex items-center gap-2">
                          {booking.status === "SUBMITTED" && (
                            <button onClick={() => handleApproveBooking(booking.id)} className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded text-sm hover:bg-emerald-200 transition flex items-center gap-1">
                               ✓ Approve Request
                            </button>
                          )}
                          <button onClick={() => handleGetTripRecommendation(booking)} className="bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded text-sm flex items-center gap-1 hover:bg-purple-200">
                             <Sparkles size={14}/> Get AI Recommendation
                          </button>
                        </div>
                     </div>
                  </div>
                  
                  {aiRecommendations[booking.id] && (
                     <div className="mb-6 bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2"><Sparkles size={16}/> AI Intelligence Report</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                           <div>
                              <p className="font-bold text-foreground">Recommended Vehicle</p>
                              <p className="text-muted mb-1">Vehicle {aiRecommendations[booking.id].vehicle?.vehicle?.vehicle_number} (Score: {aiRecommendations[booking.id].vehicle?.score}/100)</p>
                              <ul className="text-xs text-muted space-y-1">
                                  {aiRecommendations[booking.id].vehicle?.reasons?.map((r: string, i: number) => <li key={i}>{r}</li>)}
                              </ul>
                           </div>
                           <div>
                              <p className="font-bold text-foreground">Price Prediction</p>
                              <p className="text-muted mb-1">Suggested Price: ₹{aiRecommendations[booking.id].price?.total}</p>
                              <ul className="text-xs text-muted space-y-1">
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
                       <label className="block text-sm font-medium text-foreground">Assign Vehicle</label>
                       <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)} className="mt-1 block w-full rounded-md border-border-theme shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2">
                          <option value="">Select Available Vehicle...</option>
                          {vehicles.filter(v => v.status === "AVAILABLE").map(v => (
                            <option key={v.id} value={v.id}>[ {v.registration_number || v.vehicle_number} ] {v.capacity_tons || v.capacity} Ton</option>
                          ))}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-foreground">Assign Driver</label>
                       <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)} className="mt-1 block w-full rounded-md border-border-theme shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2">
                          <option value="">Select Available Driver...</option>
                          {drivers.filter(d => d.status === "AVAILABLE").map(d => (
                            <option key={d.id} value={d.id}>[ {d.name || d.full_name} ]</option>
                          ))}
                       </select>
                     </div>
                     <div className="col-span-2 text-right mt-2">
                       <button type="button" onClick={() => handleCreateTrip(booking)} className="bg-blue-600 text-white px-6 py-2 rounded-md font-bold hover:bg-blue-700">Create Trip</button>
                     </div>
                  </form>
               </div>
             ))}
             
             {bookings.filter(b => b.status === "REQUESTED" || b.status === "SUBMITTED" || b.status === "ACCEPTED").length === 0 && (
               <p className="text-muted">No pending bookings.</p>
             )}
          </div>
        )}
        
        {activeTab === 'ai' && (
          <div>
             <h1 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-2"><Bot size={32} className="text-purple-600"/> AI Business Assistant</h1>
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme p-6 max-w-3xl">
                <p className="text-muted mb-6">Ask CargoX AI about your business performance, revenue, expenses, and fleet status.</p>
                <form onSubmit={handleAskAi} className="flex gap-4 mb-8">
                    <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="e.g. What is our net profit this month?" className="flex-1 rounded-md border-border-theme shadow-sm focus:border-purple-500 focus:ring-purple-500 border p-3" required />
                    <button type="submit" disabled={aiLoading} className="bg-purple-600 text-white px-6 py-3 rounded-md font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                        {aiLoading ? "Thinking..." : <><Sparkles size={18}/> Ask AI</>}
                    </button>
                </form>
                
                {aiResponse && (
                    <div className="bg-surface-elevated rounded-lg p-6 border">
                        <h3 className="font-bold text-foreground mb-2">AI Response</h3>
                        <p className="text-foreground whitespace-pre-wrap">{aiResponse.answer}</p>
                        <div className="mt-4 pt-4 border-t">
                            <p className="text-xs text-muted font-medium">Data tools queried: {aiResponse.context_used?.join(', ')}</p>
                        </div>
                    </div>
                )}
             </div>
          </div>
        )}
        
        {activeTab === 'trips' && (
          <div>
             <h1 className="text-3xl font-bold text-foreground mb-6">Active Trips</h1>
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden divide-y divide-gray-200">
               {trips.length === 0 ? (
                 <p className="p-4 text-muted text-center">No active trips found.</p>
               ) : (
                 trips.map(trip => (
                   <div key={trip.id} className="p-4 flex justify-between items-center">
                      <div>
                         <p className="font-bold text-foreground">Trip #{trip.id} (Booking #CX100{trip.booking_id})</p>
                         <p className="text-sm text-muted">{trip.booking.pickup_address} → {trip.booking.drop_address}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="bg-surface-elevated text-foreground px-3 py-1 rounded-full text-xs font-bold">{trip.status}</span>
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
             <h1 className="text-3xl font-bold text-foreground mb-6">Fleet Status</h1>
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-surface-elevated">
                      <tr>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Vehicle</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Capacity</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                      </tr>
                   </thead>
                   <tbody className="bg-surface divide-y divide-gray-200">
                      {vehicles.map((v: any, i: number) => (
                        <tr key={v.id || i}>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                              {v.type || "TRUCK"} - {v.registration_number || `TG${String(10 + (i%90)).padStart(2, '0')}HS${String(1000 + i).padStart(4, '0')}`} <br/>
                              <span className="text-xs text-muted">Driver: {drivers.find((d: any) => d.id === v.driver_id)?.name || drivers.find((d: any) => d.id === v.driver_id)?.full_name || 'Unassigned'}</span>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{v.capacity_tons || v.capacity || 10} Ton</td>
                           <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-bold ${v.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{v.status}</span></td>
                        </tr>
                      ))}
                      {vehicles.length === 0 && (
                          <tr>
                             <td colSpan={3} className="px-6 py-4 text-center text-muted">No vehicles found.</td>
                          </tr>
                      )}
                   </tbody>
                </table>
             </div>
             
             <div className="mt-8 bg-surface rounded-lg shadow-sm border border-border-theme p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">Add New Vehicle</h2>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    try {
                        await api.createVehicle({
                            registration_number: formData.get('registration_number'),
                            type: formData.get('type'),
                            capacity_tons: parseFloat(formData.get('capacity_tons') as string)
                        });
                        alert('Vehicle added successfully');
                        loadData();
                        (e.target as HTMLFormElement).reset();
                    } catch (err: any) {
                        alert('Failed to add vehicle: ' + err.message);
                    }
                }} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Registration Number</label>
                        <input name="registration_number" required placeholder="TG09HS1234" className="w-full rounded-md border-border-theme shadow-sm border p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                        <select name="type" required className="w-full rounded-md border-border-theme shadow-sm border p-2">
                            <option value="OPEN">OPEN (Open Truck / Flatbed)</option>
                            <option value="CONTAINER">CONTAINER (Closed Container)</option>
                            <option value="TRAILER">TRAILER (Heavy Trailer)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Capacity (Tons)</label>
                        <input name="capacity_tons" type="number" step="0.1" required placeholder="10" className="w-full rounded-md border-border-theme shadow-sm border p-2" />
                    </div>
                    <div>
                        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition">
                            Add Vehicle
                        </button>
                    </div>
                </form>
             </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div>
             <h1 className="text-3xl font-bold text-foreground mb-6">Business Dashboard</h1>
             
             {dashboard && (
                 <div className="grid grid-cols-3 gap-6 mb-8">
                     <div className="bg-surface p-6 rounded-lg shadow-sm border-l-4 border-green-500">
                         <h3 className="text-sm font-medium text-muted uppercase">Total Revenue</h3>
                         <p className="text-3xl font-bold text-foreground mt-2">₹{(dashboard.revenue || dashboard.total_invoiced || 0).toLocaleString()}</p>
                     </div>
                     <div className="bg-surface p-6 rounded-lg shadow-sm border-l-4 border-red-500">
                         <h3 className="text-sm font-medium text-muted uppercase">Total Expenses</h3>
                         <p className="text-3xl font-bold text-foreground mt-2">₹{(dashboard.expenses || dashboard.total_operating_expenses || 0).toLocaleString()}</p>
                     </div>
                     <div className="bg-surface p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
                         <h3 className="text-sm font-medium text-muted uppercase">Net Profit</h3>
                         <p className="text-3xl font-bold text-foreground mt-2">₹{(dashboard.profit || dashboard.operating_profit || 0).toLocaleString()}</p>
                     </div>
                 </div>
             )}

             <h2 className="text-2xl font-bold text-foreground mb-4">Pricing Configuration</h2>
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme p-6 mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-muted uppercase">Base Delivery Rate</p>
                        {activePricing ? (
                            <p className="text-3xl font-bold text-foreground mt-1">₹{activePricing.base_rate_per_km} <span className="text-sm font-normal text-muted">/ km</span></p>
                        ) : (
                            <p className="text-xl text-muted mt-1">Not configured</p>
                        )}
                    </div>
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const newRate = parseFloat(formData.get('base_rate_per_km') as string);
                        try {
                            setIsUpdatingPricing(true);
                            await api.updatePricing(newRate);
                            await loadData();
                        } catch (err: any) {
                            alert("Failed to update pricing: " + err.message);
                        } finally {
                            setIsUpdatingPricing(false);
                            (e.target as HTMLFormElement).reset();
                        }
                    }} className="flex items-end gap-2">
                        <div>
                            <label className="block text-xs font-bold text-foreground mb-1">Set New Rate (₹/km)</label>
                            <input name="base_rate_per_km" type="number" step="0.1" required placeholder="22.0" className="w-32 rounded-md border-border-theme shadow-sm border p-2 text-sm" />
                        </div>
                        <button type="submit" disabled={isUpdatingPricing} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50">
                            {isUpdatingPricing ? 'Updating...' : 'Update'}
                        </button>
                    </form>
                </div>
             </div>

             <h2 className="text-2xl font-bold text-foreground mb-4">Invoices</h2>
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden mb-8">
                <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-surface-elevated">
                      <tr>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Invoice #</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Date</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Total Amount</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Amount Due</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Action</th>
                      </tr>
                   </thead>
                   <tbody className="bg-surface divide-y divide-gray-200">
                      {invoices.map(inv => (
                        <tr key={inv.id}>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{inv.invoice_number}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{inv.issue_date}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">₹{inv.total_amount}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">₹{inv.amount_due}</td>
                           <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{inv.status}</span></td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                               {inv.status !== 'PAID' && (
                                   <button onClick={() => handleRecordPayment(inv.id, inv.amount_due)} className="text-blue-600 hover:text-blue-800 font-medium">Record Demo Payment</button>
                               )}
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             
              <h2 className="text-2xl font-bold text-foreground mb-4">Trip Expenses</h2>
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-surface-elevated">
                      <tr>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Trip ID</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Expense Type</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Amount</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Recorded By</th>
                      </tr>
                   </thead>
                   <tbody className="bg-surface divide-y divide-gray-200">
                      {expenses.map(exp => (
                        <tr key={exp.id}>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">Trip #{exp.trip_id}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground">{exp.expense_type}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">₹{exp.amount}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{exp.recorded_by}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {activeTab === 'compliance' && (
           <div className="fade-in">
              <div className="flex justify-between items-center mb-6">
                 <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck size={32} className="text-blue-600" /> Compliance Management
                 </h1>
                 <button onClick={() => setShowUploadModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">
                    Upload Document
                 </button>
              </div>

              {/* Compliance Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                 <div className="bg-surface rounded-lg shadow-sm border p-6 border-l-4 border-l-blue-500">
                    <h3 className="font-bold text-foreground mb-4 border-b pb-2">Vehicle Documents</h3>
                    <div className="flex justify-between text-center">
                       <div>
                          <p className="text-2xl font-bold text-green-600">{complianceDashboard?.vehicles?.valid || 0}</p>
                          <p className="text-xs text-muted uppercase tracking-wider">Valid</p>
                       </div>
                       <div>
                          <p className="text-2xl font-bold text-yellow-500">{complianceDashboard?.vehicles?.expiring_soon || 0}</p>
                          <p className="text-xs text-muted uppercase tracking-wider">Expiring Soon</p>
                       </div>
                       <div>
                          <p className="text-2xl font-bold text-red-600">{complianceDashboard?.vehicles?.expired || 0}</p>
                          <p className="text-xs text-muted uppercase tracking-wider">Expired</p>
                       </div>
                    </div>
                 </div>
                 <div className="bg-surface rounded-lg shadow-sm border p-6 border-l-4 border-l-purple-500">
                    <h3 className="font-bold text-foreground mb-4 border-b pb-2">Driver Documents</h3>
                    <div className="flex justify-between text-center">
                       <div>
                          <p className="text-2xl font-bold text-green-600">{complianceDashboard?.drivers?.valid || 0}</p>
                          <p className="text-xs text-muted uppercase tracking-wider">Valid</p>
                       </div>
                       <div>
                          <p className="text-2xl font-bold text-yellow-500">{complianceDashboard?.drivers?.expiring_soon || 0}</p>
                          <p className="text-xs text-muted uppercase tracking-wider">Expiring Soon</p>
                       </div>
                       <div>
                          <p className="text-2xl font-bold text-red-600">{complianceDashboard?.drivers?.expired || 0}</p>
                          <p className="text-xs text-muted uppercase tracking-wider">Expired</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Pending Queue */}
              <h2 className="text-xl font-bold text-foreground mb-4">Pending Verification</h2>
              <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden mb-8">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-surface-elevated">
                       <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Document</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Owner</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Expiry Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Uploaded At</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-gray-200">
                       {complianceDocs.filter(d => d.status === 'PENDING').length === 0 && (
                          <tr><td colSpan={5} className="px-6 py-4 text-center text-sm text-muted">No pending documents.</td></tr>
                       )}
                       {complianceDocs.filter(d => d.status === 'PENDING').map(doc => (
                          <tr key={doc.id}>
                             <td className="px-6 py-4 whitespace-nowrap">
                                <p className="font-bold text-sm text-foreground">{doc.document_type}</p>
                                <p className="text-xs text-muted">{doc.document_number || 'N/A'}</p>
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${doc.owner_type === 'VEHICLE' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{doc.owner_type}</span>
                                <p className="text-xs text-muted mt-1">ID: {doc.owner_id.substring(0,8)}...</p>
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                                {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : 'N/A'}
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                                {new Date(doc.created_at).toLocaleDateString()}
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <button onClick={() => handleApproveDocument(doc.id)} className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded hover:bg-green-200 mr-2">Approve</button>
                                <button onClick={() => setRejectingDocId(doc.id)} className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded hover:bg-red-200">Reject</button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>

              {/* Verified & Archived History */}
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-foreground">Document History</h2>
                 <div className="flex gap-2">
                    <select value={compStatusFilter} onChange={(e) => setCompStatusFilter(e.target.value)} className="text-sm border-border-theme rounded shadow-sm p-1.5 border">
                       <option value="ALL">All Status</option>
                       <option value="VERIFIED">Verified</option>
                       <option value="ARCHIVED">Archived</option>
                       <option value="REJECTED">Rejected</option>
                    </select>
                    <select value={compOwnerFilter} onChange={(e) => setCompOwnerFilter(e.target.value)} className="text-sm border-border-theme rounded shadow-sm p-1.5 border">
                       <option value="ALL">All Owners</option>
                       <option value="VEHICLE">Vehicles</option>
                       <option value="DRIVER">Drivers</option>
                    </select>
                 </div>
              </div>
              <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-surface-elevated">
                       <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Document</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Owner</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Expiry</th>
                       </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-gray-200">
                       {complianceDocs.filter(d => d.status !== 'PENDING' && (compStatusFilter === 'ALL' || d.status === compStatusFilter) && (compOwnerFilter === 'ALL' || d.owner_type === compOwnerFilter)).map(doc => (
                          <tr key={doc.id} className={doc.status === 'ARCHIVED' ? 'opacity-60 bg-surface-elevated' : ''}>
                             <td className="px-6 py-4 whitespace-nowrap">
                                <p className="font-bold text-sm text-foreground">{doc.document_type}</p>
                                <p className="text-xs text-muted">{doc.document_number || 'N/A'}</p>
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${doc.owner_type === 'VEHICLE' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{doc.owner_type}</span>
                                <p className="text-xs text-muted mt-1">ID: {doc.owner_id.substring(0,8)}...</p>
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${doc.status === 'VERIFIED' ? 'bg-green-100 text-green-800' : doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-surface-elevated text-foreground'}`}>{doc.status}</span>
                                {doc.status === 'REJECTED' && <p className="text-xs text-red-500 mt-1">{doc.rejection_reason}</p>}
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                                {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : 'N/A'}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
         )}

         {activeTab === 'users' && (
           <div>
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-foreground">Team & User Management</h2>
             </div>
             
             <div className="bg-surface rounded-lg shadow-sm border border-border-theme overflow-hidden">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-surface-elevated border-b border-border-theme">
                         <th className="p-4 font-semibold text-muted text-sm">User ID / Email</th>
                         <th className="p-4 font-semibold text-muted text-sm">Role</th>
                         <th className="p-4 font-semibold text-muted text-sm text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody>
                      {users.length === 0 ? (
                         <tr><td colSpan={3} className="p-4 text-center text-muted">No users found.</td></tr>
                      ) : (
                         users.map(u => (
                            <tr key={u.id} className="border-b border-border-theme last:border-0 hover:bg-surface-elevated/50 transition">
                               <td className="p-4">
                                  <p className="font-medium text-foreground">{u.email}</p>
                                  <p className="text-xs text-muted font-mono">{u.id}</p>
                               </td>
                               <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    u.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' : 
                                    u.role === 'DRIVER' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {u.role}
                                  </span>
                               </td>
                               <td className="p-4 text-right">
                                  {u.role !== 'ADMIN' && (
                                     <button 
                                        onClick={async () => {
                                           if (confirm("Are you sure you want to promote this user to Admin?")) {
                                              try {
                                                 await api.updateUserRole(u.id, "ADMIN");
                                                 alert("User promoted to Admin successfully.");
                                                 loadData();
                                              } catch (e: any) {
                                                 alert("Failed to promote: " + e.message);
                                              }
                                           }
                                        }}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                     >
                                        Make Admin
                                     </button>
                                  )}
                                  {u.role === 'ADMIN' && (
                                     <button 
                                        onClick={async () => {
                                           if (confirm("Are you sure you want to revoke Admin rights?")) {
                                              try {
                                                 await api.updateUserRole(u.id, "CUSTOMER");
                                                 alert("User demoted successfully.");
                                                 loadData();
                                              } catch (e: any) {
                                                 alert("Failed to demote: " + e.message);
                                              }
                                           }
                                        }}
                                        className="text-sm text-red-600 hover:text-red-800 font-medium ml-3"
                                     >
                                        Revoke Admin
                                     </button>
                                  )}
                               </td>
                            </tr>
                         ))
                      )}
                   </tbody>
                </table>
             </div>
           </div>
         )}
      </div>

      {/* Reject Modal */}
      {rejectingDocId && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-lg p-6 w-full max-w-md">
               <h3 className="text-lg font-bold mb-4 text-foreground">Reject Document</h3>
               <textarea 
                  className="w-full border rounded p-2 text-sm min-h-[100px] mb-4"
                  placeholder="Reason for rejection (mandatory)..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
               />
               <div className="flex justify-end gap-3">
                  <button onClick={() => {setRejectingDocId(null); setRejectionReason("");}} className="px-4 py-2 text-muted hover:bg-surface-elevated rounded">Cancel</button>
                  <button onClick={handleRejectDocument} className="px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700">Reject</button>
               </div>
            </div>
         </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-lg p-6 w-full max-w-md">
               <h3 className="text-lg font-bold mb-4 text-foreground">Upload Compliance Document</h3>
               <form onSubmit={handleUploadDocument} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-foreground mb-1">Owner Type</label>
                        <select className="w-full border rounded p-2 text-sm" value={uploadFormData.owner_type} onChange={e => setUploadFormData({...uploadFormData, owner_type: e.target.value, owner_id: "", document_type: e.target.value === 'DRIVER' ? 'DRIVING_LICENSE' : 'REGISTRATION'})}>
                           <option value="DRIVER">Driver</option>
                           <option value="VEHICLE">Vehicle</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-foreground mb-1">Select {uploadFormData.owner_type}</label>
                        <select className="w-full border rounded p-2 text-sm" value={uploadFormData.owner_id} onChange={e => setUploadFormData({...uploadFormData, owner_id: e.target.value})} required>
                           <option value="">Select...</option>
                           {uploadFormData.owner_type === 'DRIVER' 
                              ? drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)
                              : vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)
                           }
                        </select>
                     </div>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-foreground mb-1">Document Type</label>
                     <select className="w-full border rounded p-2 text-sm" value={uploadFormData.document_type} onChange={e => setUploadFormData({...uploadFormData, document_type: e.target.value})}>
                        {uploadFormData.owner_type === 'DRIVER' ? (
                           <>
                              <option value="DRIVING_LICENSE">Driving License</option>
                              <option value="BACKGROUND_CHECK">Background Check</option>
                              <option value="MEDICAL_CERTIFICATE">Medical Certificate</option>
                           </>
                        ) : (
                           <>
                              <option value="REGISTRATION">Registration (RC)</option>
                              <option value="INSURANCE">Insurance</option>
                              <option value="FITNESS_CERTIFICATE">Fitness Certificate</option>
                              <option value="PERMIT">Permit</option>
                              <option value="PUC">PUC (Pollution)</option>
                           </>
                        )}
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-foreground mb-1">Document Number (Optional)</label>
                     <input type="text" className="w-full border rounded p-2 text-sm" value={uploadFormData.document_number} onChange={e => setUploadFormData({...uploadFormData, document_number: e.target.value})} placeholder="e.g. MH01-..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-foreground mb-1">Issue Date</label>
                        <input type="date" className="w-full border rounded p-2 text-sm" value={uploadFormData.issued_date} onChange={e => setUploadFormData({...uploadFormData, issued_date: e.target.value})} />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-foreground mb-1">Expiry Date</label>
                        <input type="date" className="w-full border rounded p-2 text-sm" value={uploadFormData.expiry_date} onChange={e => setUploadFormData({...uploadFormData, expiry_date: e.target.value})} />
                     </div>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-foreground mb-1">File</label>
                     <input type="file" className="w-full text-sm" onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)} required />
                  </div>
                  <div className="flex justify-end gap-3 pt-2 border-t">
                     <button type="button" onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-muted hover:bg-surface-elevated rounded">Cancel</button>
                     <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Upload</button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
}

