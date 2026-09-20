const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000") + "/api/v1";

let tokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

async function authFetch(url: string, options: RequestInit = {}) {
  let token = null;
  
  // 1. Try registered tokenGetter first (from Clerk React hook)
  if (tokenGetter) {
    try {
      token = await tokenGetter();
    } catch (e) {
      console.warn("[authFetch] Failed to get token from tokenGetter:", e);
    }
  }

  // 2. Try window.Clerk fallback
  if (!token && typeof window !== 'undefined' && (window as any).Clerk && (window as any).Clerk.session) {
    try {
      token = await (window as any).Clerk.session.getToken();
    } catch (e) {
      console.warn("[authFetch] Failed to fetch Clerk token from window:", e);
    }
  }
  
  // 3. Fallback to localStorage
  if (!token) {
    token = localStorage.getItem('access_token');
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    console.warn(`[authFetch] No auth token found for ${url}`);
  }
  
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    console.warn(`[authFetch] 401 Unauthorized for ${url}`);
  }
  return res;
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
  // Bookings (Requests)
  createBooking: async (data: any) => {
    // Admins usually don't create bookings directly, but keeping it if needed
    const res = await authFetch(`${API_URL}/customer/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getBookings: async () => {
    const res = await authFetch(`${API_URL}/admin/requests`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  cancelBooking: async (id: string) => {
    const res = await authFetch(`${API_URL}/admin/requests/${id}/cancel`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  approveBooking: async (id: string) => {
    const res = await authFetch(`${API_URL}/admin/requests/${id}/approve`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Vehicles
  getVehicles: async () => {
    const res = await authFetch(`${API_URL}/admin/fleet/vehicles`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createVehicle: async (data: any) => {
    const res = await authFetch(`${API_URL}/admin/fleet/vehicles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  updateVehicle: async (id: string, data: any) => {
    const res = await authFetch(`${API_URL}/admin/fleet/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  deleteVehicle: async (id: string) => {
    const res = await authFetch(`${API_URL}/admin/fleet/vehicles/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },

  // Drivers
  getDrivers: async () => {
    const res = await authFetch(`${API_URL}/admin/fleet/drivers`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createDriver: async (data: any) => {
    const res = await authFetch(`${API_URL}/admin/fleet/drivers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  updateDriver: async (id: string, data: any) => {
    const res = await authFetch(`${API_URL}/admin/fleet/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  deleteDriver: async (id: string) => {
    const res = await authFetch(`${API_URL}/admin/fleet/drivers/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },

  // Trips
  createTrip: async (data: any) => {
    // The backend dispatch route expects request_id in path and dispatch payload in body
    const requestId = data.booking_id || data.request_id;
    const res = await authFetch(`${API_URL}/admin/requests/${requestId}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getTrips: async () => {
    const res = await authFetch(`${API_URL}/admin/trips`);
    if (!res.ok) return [];
    return res.json();
  },
  updateTripStatus: async (tripId: number, status: string) => {
    const res = await authFetch(`${API_URL}/trips/${tripId}/status?new_status=${encodeURIComponent(status)}`, { method: "PUT" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Financials
  getInvoices: async () => {
    const res = await authFetch(`${API_URL}/admin/invoices`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createPayment: async (data: any) => {
    const res = await authFetch(`${API_URL}/admin/invoices/${data.invoice_id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getExpenses: async () => {
    const res = await authFetch(`${API_URL}/admin/expenses`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createExpense: async (data: any) => {
    const res = await authFetch(`${API_URL}/admin/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getFinancialDashboard: async () => {
    const res = await authFetch(`${API_URL}/admin/analytics/dashboard`);
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
  
  // Pricing
  getActivePricing: async () => {
    const res = await authFetch(`${API_URL}/admin/pricing-configs/active`);
    if (!res.ok) throw new Error("Failed to fetch active pricing");
    return res.json();
  },
  
  updatePricing: async (base_rate_per_km: number, margin_per_km: number = 0) => {
    const res = await authFetch(`${API_URL}/admin/pricing-configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_rate_per_km, margin_per_km })
    });
    if (!res.ok) throw new Error("Failed to update pricing");
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


  // Users (Admin Only)
  getUsers: async () => {
    const res = await authFetch(`${API_URL}/admin/users`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  updateUserRole: async (userId: string, role: string) => {
    const res = await authFetch(`${API_URL}/admin/users/${userId}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};
