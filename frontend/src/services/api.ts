const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000") + "/api";

export const api = {
  // Bookings
  createBooking: async (data: any) => {
    const res = await fetch(`${API_URL}/bookings/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getBookings: async () => {
    const res = await fetch(`${API_URL}/bookings/`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  cancelBooking: async (id: number) => {
    const res = await fetch(`${API_URL}/bookings/${id}/cancel`, { method: "PUT" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Vehicles
  getVehicles: async () => {
    const res = await fetch(`${API_URL}/vehicles/`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createVehicle: async (data: any) => {
    const res = await fetch(`${API_URL}/vehicles/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Drivers
  getDrivers: async () => {
    const res = await fetch(`${API_URL}/drivers/`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createDriver: async (data: any) => {
    const res = await fetch(`${API_URL}/drivers/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Trips
  createTrip: async (data: any) => {
    const res = await fetch(`${API_URL}/trips/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  updateTripStatus: async (tripId: number, status: string) => {
    const res = await fetch(`${API_URL}/trips/${tripId}/status?new_status=${encodeURIComponent(status)}`, { method: "PUT" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Financials
  getInvoices: async () => {
    const res = await fetch(`${API_URL}/financials/invoices`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createPayment: async (data: any) => {
    const res = await fetch(`${API_URL}/financials/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getExpenses: async () => {
    const res = await fetch(`${API_URL}/financials/expenses`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createExpense: async (data: any) => {
    const res = await fetch(`${API_URL}/financials/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getFinancialDashboard: async () => {
    const res = await fetch(`${API_URL}/financials/dashboard`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Tracking
  logLocation: async (tripId: number, lat: number, lng: number) => {
    const res = await fetch(`${API_URL}/tracking/${tripId}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getLocationHistory: async (tripId: number) => {
    const res = await fetch(`${API_URL}/tracking/${tripId}/location`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  submitPOD: async (tripId: number, data: any) => {
    const res = await fetch(`${API_URL}/tracking/${tripId}/pod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // --- Intelligence AI ---
  recommendVehicle: async (cargo_weight: number) => {
    const res = await fetch(`${API_URL}/intelligence/recommend-vehicle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cargo_weight })
    });
    if (!res.ok) throw new Error("Failed to get vehicle recommendation");
    return res.json();
  },
  
  predictPrice: async (distance_km: number, cargo_weight: number) => {
    const res = await fetch(`${API_URL}/intelligence/predict-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distance_km, cargo_weight })
    });
    if (!res.ok) throw new Error("Failed to predict price");
    return res.json();
  },
  
  recommendRoute: async (pickup_latitude: number, pickup_longitude: number, drop_latitude: number, drop_longitude: number) => {
    const res = await fetch(`${API_URL}/intelligence/recommend-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup_latitude, pickup_longitude, drop_latitude, drop_longitude })
    });
    if (!res.ok) throw new Error("Failed to recommend route");
    return res.json();
  },
  
  askAssistant: async (query: string) => {
    const res = await fetch(`${API_URL}/intelligence/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    if (!res.ok) throw new Error("Failed to query assistant");
    return res.json();
  },
  
  // Notifications (Phase 6)
  getNotifications: async (userType: string, userId: number) => {
    const res = await fetch(`${API_URL}/notifications/?user_type=${userType}&user_id=${userId}`);
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return res.json();
  },
  
  markNotificationRead: async (notificationId: number) => {
    const res = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to mark notification read");
    return res.json();
  }
};
