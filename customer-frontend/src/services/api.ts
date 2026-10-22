const RAW_API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "https://cargox-1.onrender.com";
const API_URL = RAW_API_URL.replace(/\/+$/, "") + (RAW_API_URL.includes("/api/v1") ? "" : "/api/v1");

let tokenGetter: (() => Promise<string | null>) | null = null;
let userEmailGetter: (() => string | null | undefined) | null = null;

export function setTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

export function setUserEmailGetter(getter: () => string | null | undefined) {
  userEmailGetter = getter;
}

async function requestGuestSession(): Promise<string | null> {
  try {
    const guestRes = await fetch(`${API_URL}/auth/customer-guest-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Valued Customer" }),
    });
    if (guestRes.ok) {
      const guestData = await guestRes.json();
      if (guestData?.access_token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', guestData.access_token);
          if (guestData.email) localStorage.setItem('user_email', guestData.email);
        }
        return guestData.access_token;
      }
    }
  } catch (err) {
    console.warn("[authFetch] Failed to acquire guest customer session:", err);
  }
  return null;
}

async function authFetch(url: string, options: RequestInit = {}) {
  let token = null;
  
  // 1. Try registered tokenGetter first (from Clerk React hook)
  if (tokenGetter) {
    try {
      token = await tokenGetter();
      // If we received an authenticated Clerk token, remove any stale guest access token from localStorage
      if (token && typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
      }
    } catch (e) {
      console.warn("[authFetch] Failed to get token from tokenGetter:", e);
    }
  }

  // 2. Try to get Clerk token directly from window
  if (!token && typeof window !== 'undefined' && (window as any).Clerk && (window as any).Clerk.session) {
    try {
      token = await (window as any).Clerk.session.getToken();
      if (token && typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
      }
    } catch (e) {
      console.warn("Failed to fetch Clerk token", e);
    }
  }
  
  // Fallback to localStorage (e.g. guest token or local dev token)
  if (!token && typeof window !== 'undefined') {
    token = localStorage.getItem('access_token');
  }

  // 3. If still no token, automatically acquire a guest customer session to prevent "Not authenticated" 401 errors
  if (!token) {
    token = await requestGuestSession();
  }

  // Extract user email
  let userEmail: string | null = null;
  if (userEmailGetter) {
    try {
      userEmail = userEmailGetter() || null;
    } catch (e) {
      // ignore
    }
  }
  if (!userEmail && typeof window !== 'undefined' && (window as any).Clerk?.user?.primaryEmailAddress?.emailAddress) {
    userEmail = (window as any).Clerk.user.primaryEmailAddress.emailAddress;
  }
  if (!userEmail && typeof window !== 'undefined') {
    userEmail = localStorage.getItem('user_email');
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (userEmail) {
    headers.set('X-User-Email', userEmail);
  }
  
  let response = await fetch(url, { ...options, headers });

  // 4. If request returns 401 and we aren't calling login/guest-session itself, try refreshing guest token and retry once
  if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/customer-guest-session')) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
    const freshToken = await requestGuestSession();
    if (freshToken) {
      headers.set('Authorization', `Bearer ${freshToken}`);
      response = await fetch(url, { ...options, headers });
    }
  }

  return response;
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
  calculateRoute: async (data: { pickup_lat: number; pickup_lng: number; destination_lat: number; destination_lng: number }) => {
    const res = await authFetch(`${API_URL}/customer/requests/calculate-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
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
  cancelBooking: async (id: string, reason?: string) => { 
    const res = await authFetch(`${API_URL}/customer/requests/${id}/cancel`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || "No reason provided" })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  updateBooking: async (id: string, data: any) => {
    const res = await authFetch(`${API_URL}/customer/requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getActiveOTP: async (requestId: string) => {
    const res = await authFetch(`${API_URL}/customer/requests/${requestId}/otp`);
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
    const res = await authFetch(`${API_URL}/customer/fleet/drivers`);
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
    const res = await authFetch(`${API_URL}/customer/invoices`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getPaymentOptions: async (invoiceId: string) => {
    const res = await authFetch(`${API_URL}/customer/invoices/${invoiceId}/payment-options`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  selectPaymentMethod: async (invoiceId: string, paymentMethod: string, notes?: string) => {
    const res = await authFetch(`${API_URL}/customer/invoices/${invoiceId}/select-payment-method`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_method: paymentMethod, notes }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.detail || "Unable to select payment method.");
    return payload;
  },
  getPaymentQr: async (invoiceId: string) => {
    const res = await authFetch(`${API_URL}/customer/invoices/${invoiceId}/payment-qr`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.detail || "Unable to load payment QR.");
    return payload;
  },
  verifyRazorpayCheckout: async (orderId: string, paymentId: string, signature: string) => {
    const res = await authFetch(`${API_URL}/payments/razorpay/verify-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.detail || "Payment verification failed.");
    return payload;
  },
  createPayment: async (data: any) => {
    const res = await authFetch(`${API_URL}/customer/invoices/${data.invoice_id}/pay`, {
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
  getTracking: async (requestId: string) => {
    const res = await authFetch(`${API_URL}/customer/requests/${requestId}/tracking`);
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
    const res = await authFetch(`${API_URL}/customer/quotations/pricing/active`);
    if (!res.ok) throw new Error("Failed to fetch active pricing");
    return res.json();
  },
  getPricingEstimate: async (
    distance_km: number | string,
    options?: {
      weight_tons?: number | string;
      vehicle_capacity_tons?: number | string;
      special_handling?: string;
    }
  ) => {
    const params = new URLSearchParams({ distance_km: String(distance_km) });
    if (options?.weight_tons) params.append("weight_tons", String(options.weight_tons));
    if (options?.vehicle_capacity_tons) params.append("vehicle_capacity_tons", String(options.vehicle_capacity_tons));
    if (options?.special_handling) params.append("special_handling", options.special_handling);

    const res = await authFetch(`${API_URL}/customer/quotations/pricing/estimate?${params.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  // Notifications (Phase 6)
  getNotifications: async (userType: string, userId: number | string) => {
    const res = await authFetch(`${API_URL}/notifications/?user_type=${userType}&user_id=${userId}`);
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return res.json();
  },
  
  markNotificationRead: async (notificationId: string | number) => {
    const res = await authFetch(`${API_URL}/notifications/${notificationId}/read`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to mark notification read");
    return res.json();
  },

  markAllNotificationsRead: async () => {
    const res = await authFetch(`${API_URL}/notifications/read-all`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to mark all notifications read");
    return res.json();
  },

  deleteNotification: async (notificationId: string | number) => {
    const res = await authFetch(`${API_URL}/notifications/${notificationId}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Cannot delete notification until trip details are completed.");
    }
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

};
