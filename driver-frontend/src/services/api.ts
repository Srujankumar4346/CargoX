const RAW_API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://cargox-1.onrender.com" : "http://127.0.0.1:8000");
const API_URL = RAW_API_URL.replace(/\/+$/, "") + "/api/v1";

let tokenGetter: (() => Promise<string | null>) | null = null;
let userEmailGetter: (() => string | null | undefined) | null = null;

export function setTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

export function setUserEmailGetter(getter: () => string | null | undefined) {
  userEmailGetter = getter;
}

async function authFetch(url: string, options: RequestInit = {}) {
  let token = null;
  
  // 1. Try local driver token first (Drivers log in with username/password given by admin)
  token = localStorage.getItem('access_token');

  // 2. Try registered tokenGetter (Clerk React hook fallback)
  if (!token && tokenGetter) {
    try {
      token = await tokenGetter();
    } catch (e) {
      console.warn("[authFetch] Failed to get token from tokenGetter:", e);
    }
  }

  // 3. Try window.Clerk fallback
  if (!token && typeof window !== 'undefined' && (window as any).Clerk && (window as any).Clerk.session) {
    try {
      token = await (window as any).Clerk.session.getToken();
    } catch (e) {
      console.warn("[authFetch] Failed to fetch Clerk token from window:", e);
    }
  }

  // Extract user email so backend can link pre-provisioned driver accounts accurately
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
  if (!userEmail) {
    userEmail = localStorage.getItem('user_email');
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    console.warn(`[authFetch] No auth token found for ${url}`);
  }

  const isLocalDriverToken = !!localStorage.getItem('access_token');
  if (userEmail && !isLocalDriverToken) {
    headers.set('X-User-Email', userEmail);
  }
  
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    console.warn(`[authFetch] 401 Unauthorized for ${url}`);
  }
  return res;
}

export const api = {
  // Auth
  getCurrentUserProfile: async () => {
    const res = await authFetch(`${API_URL}/auth/me`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Driver Workspace APIs
  getDriverActiveTrip: async () => {
    const res = await authFetch(`${API_URL}/driver/trips/active`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getDriverTripsHistory: async () => {
    const res = await authFetch(`${API_URL}/driver/trips/history`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  updateDriverLocation: async (tripId: string | number, lat: number, lng: number) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  driverStartPickup: async (tripId: string | number) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/start-pickup`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  driverStartTransit: async (tripId: string | number) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/start-transit`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  driverArrive: async (tripId: string | number) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/arrive`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Handover Delivery OTP verification
  sendDeliveryOTP: async (tripId: string) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      let errDetail = "Failed to dispatch OTP";
      try {
        const body = await res.json();
        errDetail = body.detail || body.message || errDetail;
      } catch (_) {
        errDetail = await res.text();
      }
      throw new Error(errDetail);
    }
    return res.json();
  },

  completeTripStop: async (tripId: string, stopId: string) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/stops/${stopId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      let errDetail = "Failed to complete stop";
      try {
        const body = await res.json();
        errDetail = body.detail || body.message || errDetail;
      } catch (_) {
        errDetail = await res.text();
      }
      throw new Error(errDetail);
    }
    return res.json();
  },

  verifyDeliveryOTP: async (tripId: string, otp: string, purpose: string = "DELIVERY") => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp, purpose }),
    });
    if (!res.ok) {
      let errDetail = "Verification failed";
      try {
        const body = await res.json();
        errDetail = body.detail || body.message || errDetail;
      } catch (_) {
        errDetail = await res.text();
      }
      throw new Error(errDetail);
    }
    return res.json();
  },

  getDeliveryOTPStatus: async (tripId: string, purpose: string = "DELIVERY") => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/otp/status?purpose=${encodeURIComponent(purpose)}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  driverSubmitPOD: async (tripId: string, data: any) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/pod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let errDetail = "Failed to submit POD";
      try {
        const body = await res.json();
        errDetail = body.detail || body.message || errDetail;
      } catch (_) {
        errDetail = await res.text();
      }
      throw new Error(errDetail);
    }
    return res.json();
  },

  driverPayCargoXNow: async (tripId: string) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/pay-cargox-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getDriverPaymentStatus: async (tripId: string) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/payment-status`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  driverRecordCollection: async (tripId: string, data: any) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/record-collection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getDriverSettlements: async () => {
    const res = await authFetch(`${API_URL}/driver/settlements`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Notifications
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
  }
};
