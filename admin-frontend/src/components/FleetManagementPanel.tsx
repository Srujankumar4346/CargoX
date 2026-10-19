import { useMemo, useState } from "react";
import { 
  AlertCircle, Edit2, Plus, RefreshCw, Save, Search, Trash2, 
  Truck, UserRound, Users, Wrench, X, Camera
} from "lucide-react";
import { api } from "../services/api";

type Props = {
  vehicles: any[];
  drivers: any[];
  trips: any[];
  isRefreshing: boolean;
  loadData: () => void;
  showConfirm: (options: { title: string; message: string; confirmLabel: string; onConfirm: () => void }) => void;
  initialTab?: "vehicles" | "drivers";
  onTabChange?: (tab: "vehicles" | "drivers") => void;
};

const normalize = (value: string | undefined) => (value || "").toUpperCase().replace(/ /g, "_");
const vehicleRegistrationPattern = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;

// Pre-defined driver avatars users can pick from quickly, or enter custom URL
const AVATAR_OPTIONS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=256&h=256&q=80",
];

export const VEHICLE_TYPE_OPTIONS = [
  { value: "TATA_ACE", label: "Tata Ace / Mini Truck (0.8T - 1.2T)", defaultTons: 1.0, defaultImage: "/images/vehicles/tata-ace-gold.png" },
  { value: "BOLERO_PICKUP", label: "Mahindra Bolero / Dost Pickup (1.5T - 3.0T)", defaultTons: 2.5, defaultImage: "/images/vehicles/mahindra-bolero-pikup.png" },
  { value: "OPEN", label: "Open Truck / Flatbed (3.0T - 10T)", defaultTons: 5.0, defaultImage: "/images/vehicles/col5_full.png" },
  { value: "CONTAINER", label: "Closed Container (3.5T - 15T)", defaultTons: 7.0, defaultImage: "/images/vehicles/screen6_full.png" },
  { value: "TRUCK_14FT", label: "14ft - 19ft Intermediate Truck (5T - 12T)", defaultTons: 6.5, defaultImage: "/images/vehicles/screen2_trucks.png" },
  { value: "REFRIGERATED", label: "Refrigerated Reefer Van (1.5T - 8T)", defaultTons: 3.5, defaultImage: "/images/vehicles/ashok-leyland-dost.png" },
  { value: "TRAILER", label: "Heavy Trailer / Multi-Axle (15T - 40T)", defaultTons: 25.0, defaultImage: "/images/vehicles/col5_full.png" },
];

// Helper to resolve vehicle representative image
export function getVehicleImage(vehicle: any): string {
  if (vehicle?.image_url) return vehicle.image_url;
  const tons = Number(vehicle?.capacity_tons) || 1;
  const type = String(vehicle?.type || "").toUpperCase();

  if (type === "TATA_ACE") return "/images/vehicles/tata-ace-gold.png";
  if (type === "BOLERO_PICKUP") return "/images/vehicles/mahindra-bolero-pikup.png";
  if (type === "CONTAINER") return "/images/vehicles/screen6_full.png";
  if (type === "REFRIGERATED") return "/images/vehicles/ashok-leyland-dost.png";
  if (type === "TRUCK_14FT") return "/images/vehicles/screen2_trucks.png";
  if (type === "TRAILER") return "/images/vehicles/col5_full.png";

  if (tons <= 1.2) return "/images/vehicles/tata-ace-gold.png";
  if (tons <= 2.2) return "/images/vehicles/ashok-leyland-dost.png";
  if (tons <= 3.5) return "/images/vehicles/mahindra-bolero-pikup.png";
  if (type === "CONTAINER") return "/images/vehicles/screen6_full.png";
  return "/images/vehicles/col5_full.png";
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalize(status);
  const tone = normalized === "AVAILABLE"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
    : normalized === "MAINTENANCE"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
      : normalized === "ON_TRIP" || normalized === "ASSIGNED"
        ? "border-blue-400/20 bg-blue-400/10 text-blue-300"
        : "border-slate-700 bg-slate-800 text-slate-400";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] ${tone}`}>{status?.replace(/_/g, " ") || "UNKNOWN"}</span>;
}

function SearchFilter({ query, setQuery, filter, setFilter, options, placeholder }: any) {
  return <div className="flex flex-col gap-2 sm:flex-row">
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <Search size={15} className="shrink-0 text-slate-500" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600" />
    </div>
    <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-300 outline-none">
      <option value="ALL">All status</option>
      {options.map((option: string) => <option key={option} value={option}>{option.replace(/_/g, " ")}</option>)}
    </select>
  </div>;
}

function PanelTitle({ icon, title, count }: any) {
  return <div className="flex items-center gap-2.5">
    <span className="rounded-lg bg-blue-500/10 p-2 text-blue-400">{icon}</span>
    <div><h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white">{title}</h2><p className="text-xs text-slate-500">{count} records</p></div>
  </div>;
}

function DriverForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");

  const effectiveAvatar = customAvatarUrl.trim() || selectedAvatar;

  return <form onSubmit={async (event) => {
    event.preventDefault(); setError(""); setSaving(true);
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") || "").replace(/\D/g, "");
    const aadhaar = String(form.get("aadhaar_number") || "").replace(/\s/g, "");
    const age = Number(form.get("age"));
    if (phone.length !== 10 || aadhaar.length !== 12 || age < 18 || age > 75) { setError("Enter a valid phone (10 digits), Aadhaar (12 digits), and age 18-75."); setSaving(false); return; }
    try { 
      await api.createDriver({ 
        email: form.get("email"), 
        aadhaar_number: aadhaar, 
        age, 
        name: form.get("name"), 
        phone, 
        license_number: form.get("license_number"),
        username: form.get("username") || undefined,
        password: form.get("password") || undefined,
        avatar_url: effectiveAvatar || undefined
      }); 
      event.currentTarget.reset(); 
      setCustomAvatarUrl("");
      onDone(); 
    } catch (err: any) { 
      setError(err?.message || "Unable to add driver."); 
    } finally { 
      setSaving(false); 
    }
  }} className="space-y-4">
    {error && <div className="flex gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"><AlertCircle size={15} />{error}</div>}
    
    {/* Driver Photo Picker */}
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
        <Camera size={13} className="text-blue-400" /> Driver Profile Photo
      </label>
      <div className="flex items-center gap-3 mb-2.5">
        <img 
          src={effectiveAvatar || "/images/driver-avatar.png"} 
          alt="Driver Preview" 
          className="w-12 h-12 rounded-full object-cover border-2 border-blue-500/50 bg-slate-800 shrink-0 shadow-md"
          onError={(e: any) => { e.currentTarget.src = "/images/driver-avatar.png"; }}
        />
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-300">Choose preset avatar or enter photo URL:</p>
          <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto pb-1">
            {AVATAR_OPTIONS.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => { setSelectedAvatar(url); setCustomAvatarUrl(""); }}
                className={`relative w-7 h-7 rounded-full overflow-hidden border-2 shrink-0 transition ${selectedAvatar === url && !customAvatarUrl ? 'border-blue-400 scale-110 shadow-sm shadow-blue-500/50' : 'border-slate-700 opacity-60 hover:opacity-100'}`}
              >
                <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <input 
        type="url"
        placeholder="Or paste custom image link (e.g. https://...)" 
        value={customAvatarUrl}
        onChange={(e) => setCustomAvatarUrl(e.target.value)}
        className="fleet-input text-xs" 
      />
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <input
        name="name"
        required
        placeholder="Full name (alphabets only)"
        className="fleet-input"
        onInput={(e: React.FormEvent<HTMLInputElement>) => {
          e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z\s]/g, "");
        }}
      />
      <input name="email" type="email" required placeholder="Email address" className="fleet-input" />
      <input
        name="phone"
        required
        inputMode="numeric"
        maxLength={10}
        placeholder="Mobile number (10 digits)"
        className="fleet-input font-mono"
        onInput={(e: React.FormEvent<HTMLInputElement>) => {
          e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10);
        }}
      />
      <input name="age" type="number" required min="18" max="75" placeholder="Age" className="fleet-input" />
      <input name="license_number" required placeholder="License number" className="fleet-input" />
      <input
        name="aadhaar_number"
        required
        inputMode="numeric"
        maxLength={12}
        placeholder="Aadhaar number (12 digits)"
        className="fleet-input font-mono"
        onInput={(e: React.FormEvent<HTMLInputElement>) => {
          e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 12);
        }}
      />
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Driver Login Username *</label>
        <input 
          name="username" 
          required 
          placeholder="e.g. driver_pandu" 
          className="fleet-input font-mono" 
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Driver Login Password *</label>
        <input 
          name="password" 
          type="text" 
          required 
          placeholder="Set driver portal password" 
          className="fleet-input font-mono" 
        />
      </div>
    </div>
    <p className="text-[11px] text-slate-500">The driver will use this unique username and password to log in to the Driver App (without Gmail).</p>
    <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"><Plus size={16} />{saving ? "Adding driver..." : "Add driver"}</button>
  </form>;
}

function VehicleForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedType, setSelectedType] = useState(VEHICLE_TYPE_OPTIONS[0].value);
  const [capacityTons, setCapacityTons] = useState<number | string>(VEHICLE_TYPE_OPTIONS[0].defaultTons);
  const [customImage, setCustomImage] = useState("");

  const handleTypeChange = (newType: string) => {
    setSelectedType(newType);
    const matched = VEHICLE_TYPE_OPTIONS.find((opt) => opt.value === newType);
    if (matched && !customImage) {
      setCapacityTons(matched.defaultTons);
    }
  };

  return <form onSubmit={async (event) => {
    event.preventDefault(); setError(""); setSaving(true); const form = new FormData(event.currentTarget);
    const registration = String(form.get("registration_number") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!vehicleRegistrationPattern.test(registration)) { setError("Use a valid registration such as TG08T1223."); setSaving(false); return; }
    try { 
      await api.createVehicle({ 
        registration_number: registration, 
        type: selectedType, 
        capacity_tons: Number(capacityTons),
        image_url: customImage.trim() || undefined
      }); 
      event.currentTarget.reset(); 
      setCustomImage("");
      onDone(); 
    } catch (err: any) { 
      setError(err?.message || "Unable to add vehicle."); 
    } finally { 
      setSaving(false); 
    }
  }} className="space-y-3">
    {error && <div className="flex gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"><AlertCircle size={15} />{error}</div>}
    
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Vehicle Category</label>
      <select 
        name="type" 
        value={selectedType} 
        onChange={(e) => handleTypeChange(e.target.value)}
        className="fleet-input"
      >
        {VEHICLE_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>

    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Registration Number</label>
      <input 
        name="registration_number" 
        required 
        placeholder="e.g. TG08T1223 or TS07EJ3509" 
        className="fleet-input font-mono uppercase tracking-wider" 
      />
    </div>

    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Payload Capacity (in Metric Tons)</label>
      <input 
        name="capacity_tons" 
        type="number" 
        required 
        min="0.5" 
        max="50" 
        step="0.1" 
        value={capacityTons}
        onChange={(e) => setCapacityTons(e.target.value)}
        placeholder="Capacity in tons" 
        className="fleet-input" 
      />
    </div>

    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Vehicle Picture URL (Optional)</label>
      <input 
        type="url"
        value={customImage}
        onChange={(e) => setCustomImage(e.target.value)}
        placeholder="Or leave empty to use default vehicle image" 
        className="fleet-input text-xs" 
      />
    </div>

    <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">
      <Plus size={16} />{saving ? "Adding vehicle..." : "Add vehicle to fleet"}
    </button>
  </form>;
}

function InlineEdit({ kind, record, onCancel, onSaved }: any) {
  const [error, setError] = useState("");
  const isDriver = kind === "driver";
  const [avatarUrl, setAvatarUrl] = useState(record.avatar_url || "");
  const [imageUrl, setImageUrl] = useState(record.image_url || "");

  const fields = isDriver
    ? [{ name: "name", value: record.name }, { name: "email", value: record.email, type: "email" }, { name: "phone", value: record.phone }, { name: "age", value: record.age, type: "number" }, { name: "license_number", value: record.license_number }, { name: "aadhaar_number", value: record.aadhaar_number }, { name: "username", value: record.username || "" }, { name: "password", value: "", placeholder: "Leave blank to keep same" }]
    : [{ name: "registration_number", value: record.registration_number }, { name: "capacity_tons", value: record.capacity_tons, type: "number" }];
  const statuses = isDriver ? ["AVAILABLE", "ON_TRIP", "INACTIVE"] : ["AVAILABLE", "ON_TRIP", "MAINTENANCE"];
  
  return <form onSubmit={async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const data: any = Object.fromEntries(form.entries());
    if (data.age) data.age = Number(data.age); if (data.capacity_tons) data.capacity_tons = Number(data.capacity_tons);
    if (isDriver && !data.password) delete data.password;
    if (isDriver && !data.username) delete data.username;
    if (isDriver) data.avatar_url = avatarUrl;
    if (!isDriver) data.image_url = imageUrl;

    try { await (isDriver ? api.updateDriver(record.id, data) : api.updateVehicle(record.id, data)); onSaved(); } catch (err: any) { setError(err?.message || "Unable to save changes."); }
  }} className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
    <div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-300">Edit {kind}</p><button type="button" onClick={onCancel}><X size={16} className="text-slate-500" /></button></div>
    {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
    
    {/* Photo Editor */}
    <div className="mb-3 p-2.5 rounded border border-slate-800 bg-slate-900/60 flex items-center gap-3">
      {isDriver ? (
        <>
          <img 
            src={avatarUrl || "/images/driver-avatar.png"} 
            alt="Driver" 
            className="w-10 h-10 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0" 
            onError={(e: any) => { e.currentTarget.src = "/images/driver-avatar.png"; }}
          />
          <input 
            type="url" 
            value={avatarUrl} 
            onChange={(e) => setAvatarUrl(e.target.value)} 
            placeholder="Driver Photo URL (e.g. https://...)" 
            className="fleet-input flex-1 text-xs" 
          />
        </>
      ) : (
        <>
          <img 
            src={imageUrl || getVehicleImage(record)} 
            alt="Vehicle" 
            className="w-14 h-10 object-contain rounded bg-slate-800 p-1 border border-slate-700 shrink-0" 
          />
          <input 
            type="url" 
            value={imageUrl} 
            onChange={(e) => setImageUrl(e.target.value)} 
            placeholder="Vehicle Photo URL" 
            className="fleet-input flex-1 text-xs" 
          />
        </>
      )}
    </div>

    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {fields.map((field) => (
        <input
          key={field.name}
          {...field}
          required
          maxLength={field.name === "phone" ? 10 : field.name === "aadhaar_number" ? 12 : undefined}
          onInput={(e: React.FormEvent<HTMLInputElement>) => {
            if (field.name === "name") {
              e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z\s]/g, "");
            } else if (field.name === "phone") {
              e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10);
            } else if (field.name === "aadhaar_number") {
              e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 12);
            }
          }}
          className="fleet-input"
        />
      ))}
      {!isDriver && (
        <select name="type" defaultValue={record.type} className="fleet-input">
          {VEHICLE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
      <select name="status" defaultValue={record.status} className="fleet-input">{statuses.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select>
    </div>
    <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400">Cancel</button><button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"><Save size={13} />Save changes</button></div>
  </form>;
}

export default function FleetManagementPanel({ 
  vehicles, 
  drivers, 
  trips, 
  isRefreshing, 
  loadData, 
  showConfirm,
  initialTab = "vehicles",
  onTabChange
}: Props) {
  const [currentSection, setCurrentSection] = useState<"vehicles" | "drivers">(initialTab);

  // Sync if prop changes
  useMemo(() => {
    if (initialTab && (initialTab === "vehicles" || initialTab === "drivers")) {
      setCurrentSection(initialTab);
    }
  }, [initialTab]);

  const setSection = (sec: "vehicles" | "drivers") => {
    setCurrentSection(sec);
    if (onTabChange) onTabChange(sec);
  };

  const [driverQuery, setDriverQuery] = useState(""); 
  const [driverFilter, setDriverFilter] = useState("ALL"); 
  const [vehicleQuery, setVehicleQuery] = useState(""); 
  const [vehicleFilter, setVehicleFilter] = useState("ALL");
  const [editingDriver, setEditingDriver] = useState<any>(null); 
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [photoModalDriver, setPhotoModalDriver] = useState<any>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string>("");
  const [customPhotoInput, setCustomPhotoInput] = useState<string>("");
  const [photoSaving, setPhotoSaving] = useState(false);

  const activeTrips = trips.filter((trip) => !["COMPLETED", "DELIVERED"].includes(normalize(trip.status)));
  const filteredDrivers = useMemo(() => drivers.filter((driver) => (!driverQuery || [driver.name, driver.phone, driver.email, driver.license_number].some((value) => String(value || "").toLowerCase().includes(driverQuery.toLowerCase()))) && (driverFilter === "ALL" || normalize(driver.status) === driverFilter)), [drivers, driverFilter, driverQuery]);
  const filteredVehicles = useMemo(() => vehicles.filter((vehicle) => (!vehicleQuery || [vehicle.registration_number, vehicle.type].some((value) => String(value || "").toLowerCase().includes(vehicleQuery.toLowerCase()))) && (vehicleFilter === "ALL" || normalize(vehicle.status) === vehicleFilter)), [vehicles, vehicleFilter, vehicleQuery]);
  const refresh = () => loadData();

  return <div className="mx-auto max-w-[1600px] space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">Fleet command center</div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {currentSection === "vehicles" ? "Vehicles Fleet" : "Driver Directory"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {currentSection === "vehicles" 
            ? "Manage CargoX transport vehicles, tonnage capacity, specs & status" 
            : "Manage authoritative driver credentials, profile photos & assignments"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Portal Switcher Tabs */}
        <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1 shadow-inner">
          <button
            onClick={() => setSection("vehicles")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              currentSection === "vehicles"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Truck size={14} /> Vehicles ({vehicles.length})
          </button>
          <button
            onClick={() => setSection("drivers")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              currentSection === "drivers"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserRound size={14} /> Drivers ({drivers.length})
          </button>
        </div>

        <button 
          onClick={refresh} 
          disabled={isRefreshing} 
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-blue-500/50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={isRefreshing ? "animate-spin text-blue-400" : ""} />
          {isRefreshing ? "Updating..." : "Refresh"}
        </button>
      </div>
    </header>

    {/* Quick Stat Cards */}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "Total vehicles", value: vehicles.length, detail: `${vehicles.filter((v) => normalize(v.status) === "AVAILABLE").length} available for dispatch`, icon: Truck, tone: "text-blue-400" },
        { label: "Total drivers", value: drivers.length, detail: `${drivers.filter((d) => normalize(d.status) === "AVAILABLE").length} on duty & available`, icon: UserRound, tone: "text-emerald-400" },
        { label: "Active trips", value: activeTrips.length, detail: "Vehicles currently in transit", icon: Users, tone: "text-cyan-400" },
        { label: "Maintenance due", value: vehicles.filter((v) => normalize(v.status) === "MAINTENANCE").length, detail: "Vehicles under inspection", icon: Wrench, tone: "text-amber-400" },
      ].map((metric) => (
        <div key={metric.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/10">
          <div className="flex items-start justify-between">
            <span className={`rounded-lg bg-slate-800 p-2 ${metric.tone}`}><metric.icon size={17} /></span>
            <span className="text-xs font-bold text-slate-600">LIVE</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-white">{metric.value}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p>
          <p className="mt-2 text-xs text-slate-600">{metric.detail}</p>
        </div>
      ))}
    </div>

    {/* ===================== VEHICLES SECTION ===================== */}
    {currentSection === "vehicles" && (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <PanelTitle icon={<Truck size={17} />} title="Vehicles Fleet" count={vehicles.length} />
            <SearchFilter 
              query={vehicleQuery} 
              setQuery={setVehicleQuery} 
              filter={vehicleFilter} 
              setFilter={setVehicleFilter} 
              options={["AVAILABLE", "ON_TRIP", "MAINTENANCE"]} 
              placeholder="Search registration, type..." 
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-195 text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-3 py-3">Vehicle / Model</th>
                  <th className="px-3 py-3">Registration</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Capacity</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredVehicles.map((vehicle) => editingVehicle?.id === vehicle.id ? (
                  <tr key={vehicle.id}>
                    <td colSpan={6} className="p-3">
                      <InlineEdit 
                        kind="vehicle" 
                        record={vehicle} 
                        onCancel={() => setEditingVehicle(null)} 
                        onSaved={() => { setEditingVehicle(null); loadData(); }} 
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={vehicle.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Vehicle Preview Image & Name */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-12 rounded-lg bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                          <img 
                            src={getVehicleImage(vehicle)} 
                            alt={vehicle.registration_number} 
                            className="w-full h-full object-contain"
                            onError={(e: any) => { e.currentTarget.src = "/images/vehicles/col5_full.png"; }}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {Number(vehicle.capacity_tons) <= 1.0 ? "Tata Ace Gold" :
                             Number(vehicle.capacity_tons) <= 2.0 ? "Ashok Leyland Dost" :
                             Number(vehicle.capacity_tons) <= 3.5 ? "Mahindra Bolero Pik-Up" :
                             `${vehicle.capacity_tons}T Freight Carrier`}
                          </p>
                          <p className="text-xs text-slate-500">Commercial Goods Vehicle</p>
                        </div>
                      </div>
                    </td>

                    {/* Registration */}
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs font-bold tracking-wider text-slate-200 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                        {vehicle.registration_number}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-3 py-3 text-xs text-slate-300">
                      <span className="font-semibold">{vehicle.type}</span>
                    </td>

                    {/* Capacity */}
                    <td className="px-3 py-3">
                      <span className="text-sm font-bold text-white">{vehicle.capacity_tons}</span>
                      <span className="text-xs text-slate-500 ml-1">tons</span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <StatusBadge status={vehicle.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setEditingVehicle(vehicle)} 
                          className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-300 hover:bg-blue-500/20 transition" 
                          title="Edit vehicle"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => showConfirm({ 
                            title: "Delete Vehicle", 
                            message: `Are you sure you want to delete or decommission vehicle "${vehicle.registration_number}"? If it has historical trips, its operational record will be archived safely.`, 
                            confirmLabel: "Delete vehicle", 
                            onConfirm: async () => { 
                              try { 
                                await api.deleteVehicle(vehicle.id); 
                                loadData(); 
                              } catch (err: any) { 
                                alert(`Unable to delete vehicle: ${err?.message || err}`); 
                              } 
                            } 
                          })} 
                          className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20 transition" 
                          title="Delete vehicle"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!filteredVehicles.length && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                      {vehicles.length ? "No matching vehicles found" : "No vehicles registered in fleet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Add Vehicle Sidebar Form */}
        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5 h-fit">
          <PanelTitle icon={<Plus size={17} />} title="Add new vehicle" count={0} />
          <p className="mb-4 mt-2 text-xs leading-5 text-slate-500">Register a CargoX vehicle with automatic image mapping and tonnage rules.</p>
          <VehicleForm onDone={refresh} />
        </aside>
      </div>
    )}

    {/* ===================== DRIVERS SECTION ===================== */}
    {currentSection === "drivers" && (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <PanelTitle icon={<UserRound size={17} />} title="Driver Directory" count={drivers.length} />
            <SearchFilter 
              query={driverQuery} 
              setQuery={setDriverQuery} 
              filter={driverFilter} 
              setFilter={setDriverFilter} 
              options={["AVAILABLE", "ON_TRIP", "INACTIVE"]} 
              placeholder="Search driver by name, phone, license..." 
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-210 text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-3 py-3">Driver Profile</th>
                  <th className="px-3 py-3">Contact</th>
                  <th className="px-3 py-3">License & Aadhaar</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredDrivers.map((driver) => editingDriver?.id === driver.id ? (
                  <tr key={driver.id}>
                    <td colSpan={5} className="p-3">
                      <InlineEdit 
                        kind="driver" 
                        record={driver} 
                        onCancel={() => setEditingDriver(null)} 
                        onSaved={() => { setEditingDriver(null); loadData(); }} 
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={driver.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Driver Avatar & Name */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative group w-12 h-12 rounded-full overflow-hidden border-2 border-slate-700 bg-slate-950 shrink-0 shadow-md">
                          <img 
                            src={driver.avatar_url || "/images/driver-avatar.png"} 
                            alt="" 
                            className="w-full h-full object-cover"
                            onError={(e: any) => { e.currentTarget.src = "/images/driver-avatar.png"; }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoModalDriver(driver);
                              setSelectedPhoto(driver.avatar_url || AVATAR_OPTIONS[0]);
                              setCustomPhotoInput("");
                            }}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white"
                            title="Update Driver Profile Photo (Admin Only)"
                          >
                            <Camera size={14} className="text-blue-300" />
                            <span className="text-[8px] font-bold mt-0.5 tracking-tighter">CHANGE</span>
                          </button>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white flex items-center gap-1.5">
                            {driver.name}
                          </p>
                          <p className="text-xs text-slate-500">Age: {driver.age || "—"} yrs</p>
                          {driver.username ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded mt-0.5">
                              User ID: @{driver.username}
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-400">No login username set</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-3 py-3 text-xs text-slate-300">
                      <p className="font-semibold text-white">{driver.phone}</p>
                      <p className="mt-1 text-slate-500">{driver.email}</p>
                    </td>

                    {/* License & Aadhaar */}
                    <td className="px-3 py-3 text-xs">
                      <p className="font-mono text-slate-300 font-semibold">{driver.license_number}</p>
                      <p className="mt-1 font-mono text-slate-500">
                        XXXX XXXX {String(driver.aadhaar_number || "").replace(/\D/g, "").slice(-4).padStart(4, "X")}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <StatusBadge status={driver.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setEditingDriver(driver)} 
                          className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-300 hover:bg-blue-500/20 transition" 
                          title="Edit driver profile & photo"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => showConfirm({ 
                            title: "Delete Driver", 
                            message: `Delete driver "${driver.name}"? Backend rules will be enforced.`, 
                            confirmLabel: "Delete driver", 
                            onConfirm: async () => { 
                              try { 
                                await api.deleteDriver(driver.id); 
                                loadData(); 
                              } catch (err: any) { 
                                alert(`Unable to delete driver: ${err?.message || err}`); 
                              } 
                            } 
                          })} 
                          className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20 transition" 
                          title="Delete driver"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!filteredDrivers.length && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-slate-500">
                      {drivers.length ? "No matching drivers" : "No drivers registered"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Add Driver Sidebar Form with Avatar Selector */}
        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5 h-fit">
          <PanelTitle icon={<Plus size={17} />} title="Add new driver" count={0} />
          <p className="mb-4 mt-2 text-xs leading-5 text-slate-500">Provision a driver profile with custom or preset photo, credentials and vehicle authorization.</p>
          <DriverForm onDone={refresh} />
        </aside>
      </div>
    )}

    {/* ===================== ADMIN ONLY: DRIVER PROFILE PHOTO MODAL ===================== */}
    {photoModalDriver && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                Admin Authorized Action
              </span>
              <h3 className="text-base font-bold text-white mt-1">Update Driver Profile Photo</h3>
              <p className="text-xs text-slate-400">Driver: <strong className="text-slate-200">{photoModalDriver.name}</strong></p>
            </div>
            <button
              type="button"
              onClick={() => setPhotoModalDriver(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500 bg-slate-900 shadow-lg shadow-blue-500/20">
              <img
                src={customPhotoInput.trim() || selectedPhoto || "/images/driver-avatar.png"}
                alt=""
                className="w-full h-full object-cover"
                onError={(e: any) => { e.currentTarget.src = "/images/driver-avatar.png"; }}
              />
            </div>
            <p className="text-xs text-slate-400">Choose a verified preset or enter an authoritative image URL:</p>
            <div className="flex items-center gap-2 overflow-x-auto p-1 max-w-full">
              {AVATAR_OPTIONS.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedPhoto(url);
                    setCustomPhotoInput("");
                  }}
                  className={`relative w-10 h-10 rounded-full overflow-hidden border-2 shrink-0 transition ${
                    selectedPhoto === url && !customPhotoInput
                      ? "border-blue-400 scale-110 shadow-md shadow-blue-500/50"
                      : "border-slate-700 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Custom Photo Link</label>
            <input
              type="url"
              value={customPhotoInput}
              onChange={(e) => setCustomPhotoInput(e.target.value)}
              placeholder="https://... (direct image link)"
              className="fleet-input text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setPhotoModalDriver(null)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={photoSaving}
              onClick={async () => {
                const finalPhoto = customPhotoInput.trim() || selectedPhoto;
                if (!finalPhoto) return;
                setPhotoSaving(true);
                try {
                  await api.updateDriver(photoModalDriver.id, { avatar_url: finalPhoto });
                  setPhotoModalDriver(null);
                  loadData();
                } catch (err: any) {
                  alert(`Unable to update photo: ${err?.message || err}`);
                } finally {
                  setPhotoSaving(false);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Save size={14} />
              {photoSaving ? "Saving..." : "Save Profile Photo"}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
}
