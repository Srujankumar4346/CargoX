
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

// Fix default icon issue with Leaflet in React
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
const defaultIcon = L.icon({
  iconUrl,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const truckIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/879/879136.png", // free truck icon
  shadowUrl: iconShadow,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

export default function TrackingMap({ trip, locations }: { trip: any, locations: any[] }) {
  if (!trip) return null;

  const pickup = [trip.booking.pickup_latitude || 17.385, trip.booking.pickup_longitude || 78.4867];
  const drop = [trip.booking.drop_latitude || 16.5062, trip.booking.drop_longitude || 80.648];

  const currentLoc = locations.length > 0 
    ? [locations[locations.length - 1].latitude, locations[locations.length - 1].longitude] 
    : pickup;

  // Simple distance calculation (Haversine formula approx)
  const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const distRemaining = calcDistance(currentLoc[0] as number, currentLoc[1] as number, drop[0] as number, drop[1] as number);
  const avgSpeed = 45; // km/h
  const etaHours = distRemaining / avgSpeed;
  const etaStr = etaHours > 0.1 ? `${Math.floor(etaHours)}h ${Math.round((etaHours % 1) * 60)}m` : 'Arriving soon';

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card p-6 border-l-4 border-l-[var(--accent)]">
         <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-[var(--text-primary)]">Status: {trip.status}</span>
            <div className="flex items-center gap-3">
               <span className="text-xs text-[var(--text-secondary)] italic">Near-real-time simulated tracking</span>
               {trip.status === "IN TRANSIT" && (
                   <span className="text-blue-500 font-bold bg-blue-500/10 px-3 py-1 rounded-full text-sm animate-pulse">
                      Live Tracking Active
                   </span>
               )}
            </div>
         </div>
         <div className="grid grid-cols-2 gap-4 text-sm mt-4">
            <div>
               <p className="text-[var(--text-secondary)]">Distance Remaining</p>
               <p className="font-bold text-lg text-[var(--text-primary)]">{distRemaining.toFixed(1)} km</p>
            </div>
            <div>
               <p className="text-[var(--text-secondary)]">Estimated Arrival (Avg 45km/h)</p>
               <p className="font-bold text-lg text-[var(--text-primary)]">{trip.status === "COMPLETED" || trip.status === "DELIVERED" ? "Arrived" : etaStr}</p>
            </div>
         </div>
      </div>
      
      <div className="h-[400px] w-full bg-[var(--bg-secondary)] rounded-xl overflow-hidden border border-[var(--border-color)] shadow-inner">
        <MapContainer center={currentLoc as any} zoom={7} className="h-full w-full">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          <Marker position={pickup as any}>
             <Popup>Pickup: {trip.booking.pickup_address}</Popup>
          </Marker>
          
          <Marker position={drop as any}>
             <Popup>Drop: {trip.booking.drop_address}</Popup>
          </Marker>
          
          {trip.status !== "TRIP CREATED" && (
             <Marker position={currentLoc as any} icon={truckIcon}>
                <Popup>Current Location of Vehicle</Popup>
             </Marker>
          )}

          <Polyline positions={[pickup as any, drop as any]} color="gray" dashArray="5, 10" />
          
          {locations.length > 0 && (
             <Polyline positions={locations.map(l => [l.latitude, l.longitude])} color="blue" weight={4} />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
