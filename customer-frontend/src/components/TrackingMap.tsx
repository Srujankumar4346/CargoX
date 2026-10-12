import { CheckCircle2, Circle, Truck, PackageCheck, Package, MapPin, Clock, Flag } from "lucide-react";

export default function TrackingMap({ trip, locations }: { trip: any, locations: any[] }) {
  if (!trip) return null;

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

      {(trip.driver_name || trip.vehicle_registration) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
           <div>
              <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Assigned Driver</span>
              <p className="mt-1 font-bold text-[var(--text-primary)]">{trip.driver_name || "Driver contact unavailable"}</p>
              {trip.driver_phone && <a href={`tel:${trip.driver_phone}`} className="text-sm text-blue-500">{trip.driver_phone}</a>}
           </div>
           <div>
              <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Assigned Vehicle</span>
              <p className="mt-1 font-bold text-[var(--text-primary)]">{trip.vehicle_registration || "Vehicle unavailable"}</p>
              <p className="text-sm text-[var(--text-secondary)]">{trip.vehicle_type || ""}{trip.vehicle_capacity_tons ? ` · ${trip.vehicle_capacity_tons} tons` : ""}</p>
           </div>
        </div>
      )}

      {/* Customer-authorized Proof of Delivery (POD) section */}
      {trip.pod && (
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
            <div className="flex items-center gap-2">
              <PackageCheck size={20} className="text-emerald-500" />
              <div>
                <h4 className="text-base font-bold text-[var(--text-primary)]">Proof of Delivery (POD)</h4>
                <p className="text-xs text-[var(--text-secondary)]">Consignment handover verification</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
              trip.pod.status === "VERIFIED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
              trip.pod.status === "REJECTED" ? "bg-red-500/10 text-red-400 border-red-500/30" :
              "bg-purple-500/10 text-purple-400 border-purple-500/30"
            }`}>
              {trip.pod.status === "VERIFIED" ? "Verified Delivery" :
               trip.pod.status === "REJECTED" ? "Verification Resubmission" :
               "Pending Verification"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)]">
              <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)] block">Recipient</span>
              <p className="mt-1 font-bold text-[var(--text-primary)]">{trip.pod.receiver_name || "Recipient"}</p>
              {trip.pod.receiver_phone && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{trip.pod.receiver_phone}</p>}
            </div>

            <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)]">
              <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)] block">Delivery Timestamp</span>
              <p className="mt-1 font-semibold text-[var(--text-primary)]">
                {trip.pod.submitted_at ? formatDate(trip.pod.submitted_at) : "Recent"}
              </p>
              <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-1">
                <CheckCircle2 size={12} /> Handover Confirmed
              </p>
            </div>
          </div>

          {trip.pod.notes && (
            <div className="mt-3 p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-sm">
              <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)] block">Delivery Notes</span>
              <p className="mt-1 text-[var(--text-primary)] italic">{trip.pod.notes}</p>
            </div>
          )}

          {/* Customer Attachment / Signature Preview */}
          {(trip.pod.file_url || trip.pod.pod_photo_url || trip.pod.pod_signature_url) && (
            <div className="mt-4 p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)]">
              <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)] block mb-2">POD Document & Signature</span>
              <div className="flex items-center gap-4">
                <a
                  href={trip.pod.file_url || trip.pod.pod_photo_url || trip.pod.pod_signature_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative h-20 w-28 overflow-hidden rounded-lg border border-[var(--border-color)] bg-slate-900 shrink-0"
                >
                  <img
                    src={trip.pod.file_url || trip.pod.pod_photo_url || trip.pod.pod_signature_url}
                    alt="Proof of Delivery"
                    className="h-full w-full object-cover group-hover:opacity-80 transition"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition">
                    View
                  </span>
                </a>
                <div className="text-xs space-y-1">
                  <a
                    href={trip.pod.file_url || trip.pod.pod_photo_url || trip.pod.pod_signature_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-blue-500 hover:underline inline-flex items-center gap-1"
                  >
                    Open Document in New Tab
                  </a>
                  <p className="text-[var(--text-secondary)]">Legally binding delivery receipt captured at destination</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-sm p-8">
         <h3 className="text-lg font-bold text-[var(--text-primary)] mb-8 border-b pb-4">Tracking History</h3>
         
         <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-4 space-y-8 pb-4">
            {steps.map((step, idx) => {
               const isCompleted = currentLevel >= step.level;
               
               return (
                 <div key={idx} className="relative pl-8">
                    <div className={`absolute -left-[17px] top-1 h-8 w-8 rounded-full flex items-center justify-center border-4 border-[var(--bg-secondary)]
                      ${isCompleted ? step.activeBg + ' ' + step.activeColor : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
                       {isCompleted ? <CheckCircle2 size={18} className="fill-current text-white" /> : <Circle size={12} />}
                    </div>
                    
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
