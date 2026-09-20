import { CheckCircle2, Circle, Truck, PackageCheck, Package, MapPin, Clock, Flag } from "lucide-react";

export default function TrackingMap({ trip, locations }: { trip: any, locations: any[] }) {
  if (!trip) return null;

  // Map backend status (may have underscores) to numeric level
  // Backend statuses: DRIVER_ASSIGNED, PICKUP_IN_PROGRESS, IN_TRANSIT, ARRIVED, POD_SUBMITTED, DELIVERED, COMPLETED
  const normalizeStatus = (s: string) => (s || "").toUpperCase().replace(/ /g, "_");

  const statusLevels: Record<string, number> = {
    "TRIP_CREATED": 1,
    "DRIVER_ASSIGNED": 1,
    "VEHICLE_ASSIGNED": 1,
    "PICKUP_IN_PROGRESS": 2,
    "IN_TRANSIT": 2,
    "ARRIVED": 3,
    "POD_SUBMITTED": 3,
    "DELIVERED": 3,
    "COMPLETED": 4,
  };

  const normalized = normalizeStatus(trip.status);
  const currentLevel = statusLevels[normalized] ?? 1;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const steps = [
    {
      level: 1,
      title: "Trip Created",
      description: `Vehicle assigned to ${trip.request?.pickup_address || 'Pickup address'}`,
      timestamp: formatDate(trip.assigned_at),
      icon: <Package size={24} />,
      activeColor: "text-blue-500",
      activeBg: "bg-blue-100"
    },
    {
      level: 2,
      title: "In Transit",
      description: currentLevel === 2 ? "Your cargo is on the way" : (currentLevel > 2 ? "Cargo was transported" : "Waiting for dispatch"),
      timestamp: trip.started_at ? formatDate(trip.started_at) : "",
      icon: <Truck size={24} />,
      activeColor: "text-amber-500",
      activeBg: "bg-amber-100",
      showLocations: true
    },
    {
      level: 3,
      title: "Delivered",
      description: `Arrived at ${trip.request?.destination_address || 'Destination address'}`,
      timestamp: trip.delivered_at ? formatDate(trip.delivered_at) : (currentLevel >= 3 ? "Delivery complete" : ""),
      icon: <PackageCheck size={24} />,
      activeColor: "text-green-500",
      activeBg: "bg-green-100"
    },
    {
      level: 4,
      title: "Completed",
      description: "Trip closed, invoice generated",
      timestamp: trip.completed_at ? formatDate(trip.completed_at) : (currentLevel >= 4 ? "Just now" : ""),
      icon: <Flag size={24} />,
      activeColor: "text-purple-500",
      activeBg: "bg-purple-100"
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card p-6 border-l-4 border-l-[var(--accent)] flex justify-between items-center">
         <div>
             <span className="text-sm text-[var(--text-secondary)] block">Current Status</span>
             <span className="text-xl font-bold text-[var(--text-primary)]">{trip.status}</span>
         </div>
         {(trip.status === "IN_TRANSIT" || trip.status === "IN TRANSIT") && (
             <span className="text-blue-500 font-bold bg-blue-500/10 px-3 py-1 rounded-full text-sm animate-pulse flex items-center gap-2">
                <Clock size={16} /> Live Tracking Active
             </span>
         )}
         {trip.status === "COMPLETED" && (
             <span className="text-purple-500 font-bold bg-purple-500/10 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                <CheckCircle2 size={16} /> Trip Completed
             </span>
         )}
      </div>
      
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-sm p-8">
         <h3 className="text-lg font-bold text-[var(--text-primary)] mb-8 border-b pb-4">Tracking History</h3>
         
         <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-4 space-y-8 pb-4">
            {steps.map((step, idx) => {
               const isCompleted = currentLevel >= step.level;
               
               return (
                 <div key={idx} className="relative pl-8">
                    {/* Timeline Node */}
                    <div className={`absolute -left-[17px] top-1 h-8 w-8 rounded-full flex items-center justify-center border-4 border-[var(--bg-secondary)]
                      ${isCompleted ? step.activeBg + ' ' + step.activeColor : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
                       {isCompleted ? <CheckCircle2 size={18} className="fill-current text-white" /> : <Circle size={12} />}
                    </div>
                    
                    {/* Content */}
                    <div>
                       <div className="flex items-center gap-3">
                          <h4 className={`text-lg font-bold ${isCompleted ? 'text-[var(--text-primary)]' : 'text-gray-400'}`}>
                             {step.title}
                          </h4>
                          {step.timestamp && (
                             <span className="text-sm text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded">
                               {step.timestamp}
                             </span>
                          )}
                       </div>
                       <p className={`mt-1 text-sm ${isCompleted ? 'text-[var(--text-secondary)]' : 'text-gray-400'}`}>
                          {step.description}
                       </p>

                       {/* Location History Log */}
                       {step.showLocations && isCompleted && locations && locations.length > 0 && (
                          <div className="mt-4 bg-[var(--bg-elevated)] rounded-lg p-4 border border-[var(--border-color)]">
                             <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Location Log</h5>
                             <div className="space-y-3">
                                {locations.slice().reverse().map((loc, i) => (
                                   <div key={i} className="flex items-start gap-3 text-sm">
                                      <MapPin size={16} className="text-amber-500 mt-0.5 shrink-0" />
                                      <div>
                                         <p className="text-[var(--text-primary)] font-medium">
                                            Location Update ({(loc.lat ?? loc.latitude ?? 0).toFixed(4)}, {(loc.lng ?? loc.longitude ?? 0).toFixed(4)})
                                         </p>
                                         <p className="text-xs text-[var(--text-secondary)]">
                                            {formatDate(loc.recorded_at)}
                                         </p>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}
                    </div>
                 </div>
               );
            })}
         </div>
      </div>
    </div>
  );
}
