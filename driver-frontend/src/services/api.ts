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

  if (userEmail) {
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

  updateDriverLocation: async (tripId: number, lat: number, lng: number) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  driverStartPickup: async (tripId: number) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/start-pickup`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  driverStartTransit: async (tripId: number) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/start-transit`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  driverArrive: async (tripId: number) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/arrive`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  driverSubmitPOD: async (tripId: number, data: any) => {
    const res = await authFetch(`${API_URL}/driver/trips/${tripId}/pod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
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
