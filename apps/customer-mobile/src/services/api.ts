export const DEFAULT_API_BASE_URL = "http://10.0.2.2:8000/api/v1";

export async function getApiBaseUrl(): Promise<string> {
  const custom = await storage.getItem("cargox_api_base_url");
  return (custom && custom.trim()) ? custom.trim() : DEFAULT_API_BASE_URL;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  await storage.setItem("cargox_api_base_url", url.trim());
}

export let API_BASE_URL = DEFAULT_API_BASE_URL;

export interface AuthSession {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

class StorageService {
  private memoryStore: Record<string, string> = {};

  async getItem(key: string): Promise<string | null> {
    try {
      const SecureStore = require("expo-secure-store");
      return await SecureStore.getItemAsync(key);
    } catch {
      return this.memoryStore[key] || null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const SecureStore = require("expo-secure-store");
      await SecureStore.setItemAsync(key, value);
    } catch {
      this.memoryStore[key] = value;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const SecureStore = require("expo-secure-store");
      await SecureStore.deleteItemAsync(key);
    } catch {
      delete this.memoryStore[key];
    }
  }
}

export const storage = new StorageService();

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await storage.getItem("cargox_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const baseUrl = await getApiBaseUrl();
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;
  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      errorDetail = `Server returned status ${response.status}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}
