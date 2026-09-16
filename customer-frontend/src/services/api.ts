const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000") + "/api";

async function authFetch(url: string, options: RequestInit = {}) {
  let token = null;
  
  // Try to get Clerk token first
  if (typeof window !== 'undefined' && (window as any).Clerk && (window as any).Clerk.session) {
    try {
      token = await (window as any).Clerk.session.getToken();
    } catch (e) {
      console.warn("Failed to fetch Clerk token", e);
    }
  }
  
  // Fallback to localStorage
  if (!token) {
    token = localStorage.getItem('access_token');
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(url, { ...options, headers });
}


export const api = {
  // Auth
  login: async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    const res = await authFetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    return res.json();
  },
  // Bookings (now Delivery Requests)
  createBooking: async (data: any) => {
    const res = await authFetch(`${API_URL}/customer/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getBookings: async () => {
    const res = await authFetch(`${API_URL}/customer/requests`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  cancelBooking: async (id: string) => { // id is now a UUID string
    const res = await authFetch(`${API_URL}/customer/requests/${id}/cancel`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Vehicles
  getVehicles: async () => {
    const res = await authFetch(`${API_URL}/vehicles/`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createVehicle: async (data: any) => {
    const res = await authFetch(`${API_URL}/vehicles/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Drivers
  getDrivers: async () => {
    const res = await authFetch(`${API_URL}/drivers/`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createDriver: async (data: any) => {
    const res = await authFetch(`${API_URL}/drivers/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Trips
  createTrip: async (data: any) => {
    const res = await authFetch(`${API_URL}/trips/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  updateTripStatus: async (tripId: number, status: string) => {
    const res = await authFetch(`${API_URL}/trips/${tripId}/status?new_status=${encodeURIComponent(status)}`, { method: "PUT" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Financials
  getInvoices: async () => {
    const res = await authFetch(`${API_URL}/financials/invoices`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createPayment: async (data: any) => {
    const res = await authFetch(`${API_URL}/financials/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getExpenses: async () => {
    const res = await authFetch(`${API_URL}/financials/expenses`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createExpense: async (data: any) => {
    const res = await authFetch(`${API_URL}/financials/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getFinancialDashboard: async () => {
    const res = await authFetch(`${API_URL}/financials/dashboard`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Tracking
  logLocation: async (tripId: number, lat: number, lng: number) => {
    const res = await authFetch(`${API_URL}/tracking/${tripId}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getLocationHistory: async (tripId: number) => {
    const res = await authFetch(`${API_URL}/tracking/${tripId}/location`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  submitPOD: async (tripId: number, data: any) => {
    const res = await authFetch(`${API_URL}/tracking/${tripId}/pod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // --- Intelligence AI ---
  recommendVehicle: async (cargo_weight: number) => {
    const res = await authFetch(`${API_URL}/intelligence/recommend-vehicle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cargo_weight })
    });
    if (!res.ok) throw new Error("Failed to get vehicle recommendation");
    return res.json();
  },
  
  predictPrice: async (distance_km: number, cargo_weight: number) => {
    const res = await authFetch(`${API_URL}/intelligence/predict-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distance_km, cargo_weight })
    });
    if (!res.ok) throw new Error("Failed to predict price");
    return res.json();
  },
  
  recommendRoute: async (pickup_latitude: number, pickup_longitude: number, drop_latitude: number, drop_longitude: number) => {
    const res = await authFetch(`${API_URL}/intelligence/recommend-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup_latitude, pickup_longitude, drop_latitude, drop_longitude })
    });
    if (!res.ok) throw new Error("Failed to recommend route");
    return res.json();
  },
  
  askAssistant: async (query: string) => {
    const res = await authFetch(`${API_URL}/intelligence/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    if (!res.ok) throw new Error("Failed to query assistant");
    return res.json();
  },
  
  // Notifications (Phase 6)
  getNotifications: async (userType: string, userId: number) => {
    const res = await authFetch(`${API_URL}/notifications/?user_type=${userType}&user_id=${userId}`);
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return res.json();
  },
  
  markNotificationRead: async (notificationId: number) => {
    const res = await authFetch(`${API_URL}/notifications/${notificationId}/read`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to mark notification read");
    return res.json();
  },

  // Mobile Driver (Phase 6)
  getMobileTripsToday: async (driverId: number) => {
    const res = await authFetch(`${API_URL}/mobile/trips/today?driver_id=${driverId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  updateMobileTripStatus: async (tripId: number, status: string, driverId: number) => {
    const res = await authFetch(`${API_URL}/mobile/trips/${tripId}/status?new_status=${encodeURIComponent(status)}&driver_id=${driverId}`, { method: "PUT" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  submitMobilePOD: async (tripId: number, driverId: number, data: any) => {
    const res = await authFetch(`${API_URL}/mobile/trips/${tripId}/pod?driver_id=${driverId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // --- Phase 12: Compliance Management ---
  getComplianceDashboard: async () => {
    const res = await authFetch(`${API_URL}/admin/compliance/dashboard`);
    if (!res.ok) throw new Error("Failed to fetch compliance dashboard");
    return res.json();
  },
  
  getComplianceDocuments: async (ownerType?: string, ownerId?: string, status?: string) => {
    let query = "";
    const params = new URLSearchParams();
    if (ownerType) params.append("owner_type", ownerType);
    if (ownerId) params.append("owner_id", ownerId);
    if (status) params.append("status", status);
    
    if (params.toString()) query = `?${params.toString()}`;
    
    const res = await authFetch(`${API_URL}/admin/compliance/documents${query}`);
    if (!res.ok) throw new Error("Failed to fetch compliance documents");
    return res.json();
  },
  
  verifyComplianceDocument: async (documentId: string, isVerified: boolean, rejectionReason?: string) => {
    const res = await authFetch(`${API_URL}/admin/compliance/documents/${documentId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_verified: isVerified,
        rejection_reason: rejectionReason || null
      }),
    });
    if (!res.ok) throw new Error("Failed to verify document");
    return res.json();
  },
  
  uploadComplianceDocument: async (formData: FormData) => {
    // FormData requires omitting the Content-Type header so the browser sets it with the boundary
    const res = await authFetch(`${API_URL}/admin/compliance/documents`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload document");
    return res.json();
  }
};
