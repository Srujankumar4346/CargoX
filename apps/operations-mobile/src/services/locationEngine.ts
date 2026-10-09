import { offlineQueue } from './offlineQueue';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export class LocationEngine {
  private lastLocation: LocationPoint | null = null;
  private readonly MOVEMENT_THRESHOLD_METERS = 25.0; // 25m movement sampling
  private readonly STATIONARY_INTERVAL_MS = 60000;   // 60s when stationary
  private readonly MOVING_INTERVAL_MS = 15000;       // 15s when active in transit
  private lastSentTime: number = 0;

  private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  shouldSampleLocation(newLoc: LocationPoint): boolean {
    const now = Date.now();
    if (!this.lastLocation) {
      this.lastLocation = newLoc;
      this.lastSentTime = now;
      return true;
    }

    const distanceMoved = this.calculateDistanceMeters(
      this.lastLocation.latitude,
      this.lastLocation.longitude,
      newLoc.latitude,
      newLoc.longitude
    );

    // If moved more than 25 meters, sample if at least moving interval has elapsed
    if (distanceMoved >= this.MOVEMENT_THRESHOLD_METERS) {
      if (now - this.lastSentTime >= this.MOVING_INTERVAL_MS) {
        this.lastLocation = newLoc;
        this.lastSentTime = now;
        return true;
      }
    } else {
      // Stationary: throttle down to stationary interval to conserve battery
      if (now - this.lastSentTime >= this.STATIONARY_INTERVAL_MS) {
        this.lastLocation = newLoc;
        this.lastSentTime = now;
        return true;
      }
    }

    return false;
  }

  async recordLocation(tripId: string, loc: LocationPoint, apiCallFn: (endpoint: string, opts: any) => Promise<any>): Promise<boolean> {
    if (!this.shouldSampleLocation(loc)) {
      return false; // Throttled for battery conservation
    }

    try {
      await apiCallFn(`/driver/trips/${tripId}/location`, {
        method: 'POST',
        body: JSON.stringify({
          latitude: loc.latitude,
          longitude: loc.longitude
        })
      });
      return true;
    } catch {
      // Network offline: Enqueue into persistent local storage for later safe sync
      await offlineQueue.enqueue({
        type: 'LOCATION_UPDATE',
        endpoint: `/driver/trips/${tripId}/location`,
        method: 'POST',
        payload: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          recorded_at: new Date(loc.timestamp).toISOString()
        }
      });
      return false;
    }
  }
}

export const locationEngine = new LocationEngine();
