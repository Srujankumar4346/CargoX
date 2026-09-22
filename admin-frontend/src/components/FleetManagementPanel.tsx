import { useMemo, useState } from "react";
import { AlertCircle, Edit2, Plus, RefreshCw, Save, Search, Trash2, Truck, UserRound, Users, Wrench, X } from "lucide-react";
import { api } from "../services/api";

type Props = {
  vehicles: any[];
  drivers: any[];
  trips: any[];
  isRefreshing: boolean;
  loadData: () => void;
  showConfirm: (options: { title: string; message: string; confirmLabel: string; onConfirm: () => void }) => void;
};

const normalize = (value: string | undefined) => (value || "").toUpperCase().replace(/ /g, "_");
const vehicleRegistrationPattern = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;

function StatusBadge({ status }: { status: string }) {
  const normalized = normalize(status);
  const tone = normalized === "AVAILABLE"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
    : normalized === "MAINTENANCE"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
      : normalized === "ON_TRIP" || normalized === "ASSIGNED"
        ? "border-blue-400/20 bg-blue-400/10 text-blue-300"
        : "border-slate-700 bg-slate-800 text-slate-400";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold tracking-[0.12em] ${tone}`}>{status?.replace(/_/g, " ") || "UNKNOWN"}</span>;
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
  return <form onSubmit={async (event) => {
    event.preventDefault(); setError(""); setSaving(true);
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") || "").replace(/\D/g, "");
    const aadhaar = String(form.get("aadhaar_number") || "").replace(/\s/g, "");
    const age = Number(form.get("age"));
    if (phone.length !== 10 || aadhaar.length !== 12 || age < 18 || age > 75) { setError("Enter a valid phone, Aadhaar, and age from 18 to 75."); setSaving(false); return; }
    try { await api.createDriver({ email: form.get("email"), aadhaar_number: aadhaar, age, name: form.get("name"), phone, license_number: form.get("license_number") }); event.currentTarget.reset(); onDone(); } catch (err: any) { setError(err?.message || "Unable to add driver."); } finally { setSaving(false); }
  }} className="space-y-3">
    {error && <div className="flex gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"><AlertCircle size={15} />{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <input name="name" required placeholder="Full name" className="fleet-input" /><input name="email" type="email" required placeholder="Email address" className="fleet-input" />
      <input name="phone" required inputMode="numeric" maxLength={10} placeholder="Mobile number" className="fleet-input" /><input name="age" type="number" required min="18" max="75" placeholder="Age" className="fleet-input" />
      <input name="license_number" required placeholder="License number" className="fleet-input" /><input name="aadhaar_number" required inputMode="numeric" maxLength={14} placeholder="Aadhaar number" className="fleet-input" />
    </div>
    <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"><Plus size={16} />{saving ? "Adding driver..." : "Add driver"}</button>
  </form>;
}

function VehicleForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return <form onSubmit={async (event) => {
    event.preventDefault(); setError(""); setSaving(true); const form = new FormData(event.currentTarget);
    const registration = String(form.get("registration_number") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!vehicleRegistrationPattern.test(registration)) { setError("Use a valid registration such as TG09HS1234."); setSaving(false); return; }
    try { await api.createVehicle({ registration_number: registration, type: form.get("type"), capacity_tons: Number(form.get("capacity_tons")) }); event.currentTarget.reset(); onDone(); } catch (err: any) { setError(err?.message || "Unable to add vehicle."); } finally { setSaving(false); }
  }} className="space-y-3">
    {error && <div className="flex gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"><AlertCircle size={15} />{error}</div>}
    <input name="registration_number" required placeholder="Registration number" className="fleet-input font-mono uppercase tracking-wider" />
    <select name="type" defaultValue="OPEN" className="fleet-input"><option value="OPEN">Open truck / flatbed</option><option value="CONTAINER">Closed container</option><option value="TRAILER">Heavy trailer</option></select>
    <input name="capacity_tons" type="number" required min="0.5" max="50" step="0.1" placeholder="Capacity in tons" className="fleet-input" />
    <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"><Plus size={16} />{saving ? "Adding vehicle..." : "Add vehicle"}</button>
  </form>;
}

function InlineEdit({ kind, record, onCancel, onSaved }: any) {
  const [error, setError] = useState("");
  const isDriver = kind === "driver";
  const fields = isDriver
    ? [{ name: "name", value: record.name }, { name: "email", value: record.email, type: "email" }, { name: "phone", value: record.phone }, { name: "age", value: record.age, type: "number" }, { name: "license_number", value: record.license_number }, { name: "aadhaar_number", value: record.aadhaar_number }]
    : [{ name: "registration_number", value: record.registration_number }, { name: "capacity_tons", value: record.capacity_tons, type: "number" }];
  const statuses = isDriver ? ["AVAILABLE", "ON_TRIP", "INACTIVE"] : ["AVAILABLE", "ON_TRIP", "MAINTENANCE"];
  return <form onSubmit={async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const data: any = Object.fromEntries(form.entries());
    if (data.age) data.age = Number(data.age); if (data.capacity_tons) data.capacity_tons = Number(data.capacity_tons);
    try { await (isDriver ? api.updateDriver(record.id, data) : api.updateVehicle(record.id, data)); onSaved(); } catch (err: any) { setError(err?.message || "Unable to save changes."); }
  }} className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
    <div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-300">Edit {kind}</p><button type="button" onClick={onCancel}><X size={16} className="text-slate-500" /></button></div>
    {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{fields.map((field) => <input key={field.name} {...field} required className="fleet-input" />)}{!isDriver && <select name="type" defaultValue={record.type} className="fleet-input"><option value="OPEN">OPEN</option><option value="CONTAINER">CONTAINER</option><option value="TRAILER">TRAILER</option></select>}<select name="status" defaultValue={record.status} className="fleet-input">{statuses.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select></div>
    <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400">Cancel</button><button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"><Save size={13} />Save changes</button></div>
  </form>;
}

export default function FleetManagementPanel({ vehicles, drivers, trips, isRefreshing, loadData, showConfirm }: Props) {
  const [driverQuery, setDriverQuery] = useState(""); const [driverFilter, setDriverFilter] = useState("ALL"); const [vehicleQuery, setVehicleQuery] = useState(""); const [vehicleFilter, setVehicleFilter] = useState("ALL");
  const [editingDriver, setEditingDriver] = useState<any>(null); const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const activeTrips = trips.filter((trip) => !["COMPLETED", "DELIVERED"].includes(normalize(trip.status)));
  const filteredDrivers = useMemo(() => drivers.filter((driver) => (!driverQuery || [driver.name, driver.phone, driver.email, driver.license_number].some((value) => String(value || "").toLowerCase().includes(driverQuery.toLowerCase()))) && (driverFilter === "ALL" || normalize(driver.status) === driverFilter)), [drivers, driverFilter, driverQuery]);
  const filteredVehicles = useMemo(() => vehicles.filter((vehicle) => (!vehicleQuery || [vehicle.registration_number, vehicle.type].some((value) => String(value || "").toLowerCase().includes(vehicleQuery.toLowerCase()))) && (vehicleFilter === "ALL" || normalize(vehicle.status) === vehicleFilter)), [vehicles, vehicleFilter, vehicleQuery]);
  const refresh = () => loadData();

  return <div className="mx-auto max-w-[1600px] space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">Fleet command center</div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Fleet Management</h1><p className="mt-1 text-sm text-slate-500">Manage drivers and vehicles across your operations</p></div><button onClick={refresh} disabled={isRefreshing} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-blue-500/50 disabled:opacity-50"><RefreshCw size={15} className={isRefreshing ? "animate-spin text-blue-400" : ""} />{isRefreshing ? "Updating..." : "Refresh fleet"}</button></header>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Total drivers", value: drivers.length, detail: `${drivers.filter((driver) => normalize(driver.status) === "AVAILABLE").length} available`, icon: UserRound, tone: "text-emerald-400" }, { label: "Total vehicles", value: vehicles.length, detail: `${vehicles.filter((vehicle) => normalize(vehicle.status) === "AVAILABLE").length} available`, icon: Truck, tone: "text-blue-400" }, { label: "Maintenance due", value: vehicles.filter((vehicle) => normalize(vehicle.status) === "MAINTENANCE").length, detail: "Authoritative vehicle status", icon: Wrench, tone: "text-amber-400" }, { label: "Active trips", value: activeTrips.length, detail: "Vehicles currently on the road", icon: Users, tone: "text-blue-400" }].map((metric) => <div key={metric.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/10"><div className="flex items-start justify-between"><span className={`rounded-lg bg-slate-800 p-2 ${metric.tone}`}><metric.icon size={17} /></span><span className="text-xs font-bold text-slate-600">LIVE</span></div><p className="mt-4 text-2xl font-bold text-white">{metric.value}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p><p className="mt-2 text-xs text-slate-600">{metric.detail}</p></div>)}</div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><PanelTitle icon={<UserRound size={17} />} title="Driver profiles" count={drivers.length} /><SearchFilter query={driverQuery} setQuery={setDriverQuery} filter={driverFilter} setFilter={setDriverFilter} options={["AVAILABLE", "ON_TRIP", "INACTIVE"]} placeholder="Search drivers..." /></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-195 text-left"><thead><tr className="border-b border-slate-800 text-[10px] uppercase tracking-[0.14em] text-slate-600"><th className="px-3 py-3">Driver</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">License / Aadhaar</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Current assignment</th><th className="px-3 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-800/80">{filteredDrivers.map((driver) => editingDriver?.id === driver.id ? <tr key={driver.id}><td colSpan={6} className="p-3"><InlineEdit kind="driver" record={driver} onCancel={() => setEditingDriver(null)} onSaved={() => { setEditingDriver(null); loadData(); }} /></td></tr> : <tr key={driver.id} className="hover:bg-slate-800/30"><td className="px-3 py-3"><p className="text-sm font-semibold text-slate-200">{driver.name}</p><p className="text-xs text-slate-600">Age {driver.age || "—"}</p></td><td className="px-3 py-3 text-xs text-slate-400"><p>{driver.phone}</p><p className="mt-1 text-slate-600">{driver.email}</p></td><td className="px-3 py-3 text-xs text-slate-400"><p>{driver.license_number}</p><p className="mt-1 font-mono text-slate-600">XXXX XXXX {String(driver.aadhaar_number || "").replace(/\D/g, "").slice(-4).padStart(4, "X")}</p></td><td className="px-3 py-3"><StatusBadge status={driver.status} /></td><td className="px-3 py-3 text-xs text-slate-500">Assignment unavailable</td><td className="px-3 py-3"><div className="flex justify-end gap-2"><button onClick={() => setEditingDriver(driver)} className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-300" title="Edit driver"><Edit2 size={14} /></button><button onClick={() => showConfirm({ title: "Delete Driver", message: `Delete driver "${driver.name}"? Backend rules will be enforced.`, confirmLabel: "Delete driver", onConfirm: async () => { try { await api.deleteDriver(driver.id); loadData(); } catch (err: any) { alert(`Unable to delete driver: ${err?.message || err}`); } } })} className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-300" title="Delete driver"><Trash2 size={14} /></button></div></td></tr>)}{!filteredDrivers.length && <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-500">{drivers.length ? "No matching drivers" : "No drivers found"}</td></tr>}</tbody></table></div></section><aside className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5"><PanelTitle icon={<Plus size={17} />} title="Add new driver" count={0} /><p className="mb-4 mt-2 text-xs leading-5 text-slate-500">Provision a CargoX driver profile with the existing fleet workflow.</p><DriverForm onDone={refresh} /></aside></div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><PanelTitle icon={<Truck size={17} />} title="Vehicles" count={vehicles.length} /><SearchFilter query={vehicleQuery} setQuery={setVehicleQuery} filter={vehicleFilter} setFilter={setVehicleFilter} options={["AVAILABLE", "ON_TRIP", "MAINTENANCE"]} placeholder="Search vehicles..." /></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-175 text-left"><thead><tr className="border-b border-slate-800 text-[10px] uppercase tracking-[0.14em] text-slate-600"><th className="px-3 py-3">Vehicle</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Capacity</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Driver assignment</th><th className="px-3 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-800/80">{filteredVehicles.map((vehicle) => editingVehicle?.id === vehicle.id ? <tr key={vehicle.id}><td colSpan={6} className="p-3"><InlineEdit kind="vehicle" record={vehicle} onCancel={() => setEditingVehicle(null)} onSaved={() => { setEditingVehicle(null); loadData(); }} /></td></tr> : <tr key={vehicle.id} className="hover:bg-slate-800/30"><td className="px-3 py-3 font-mono text-sm font-bold tracking-wider text-slate-200">{vehicle.registration_number}</td><td className="px-3 py-3 text-xs text-slate-400">{vehicle.type}</td><td className="px-3 py-3 text-sm font-bold text-white">{vehicle.capacity_tons} <span className="text-xs font-normal text-slate-500">ton</span></td><td className="px-3 py-3"><StatusBadge status={vehicle.status} /></td><td className="px-3 py-3 text-xs text-slate-500">Assignment unavailable</td><td className="px-3 py-3"><div className="flex justify-end gap-2"><button onClick={() => setEditingVehicle(vehicle)} className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-300" title="Edit vehicle"><Edit2 size={14} /></button>{vehicle.is_deletable && <button onClick={() => showConfirm({ title: "Delete Vehicle", message: `Delete vehicle "${vehicle.registration_number}"? Backend history restrictions remain enforced.`, confirmLabel: "Delete vehicle", onConfirm: async () => { try { await api.deleteVehicle(vehicle.id); loadData(); } catch (err: any) { alert(`Unable to delete vehicle: ${err?.message || err}`); } } })} className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-300" title="Delete vehicle"><Trash2 size={14} /></button>}</div></td></tr>)}{!filteredVehicles.length && <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-500">{vehicles.length ? "No matching vehicles" : "No vehicles found"}</td></tr>}</tbody></table></div></section><aside className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5"><PanelTitle icon={<Plus size={17} />} title="Add new vehicle" count={0} /><p className="mb-4 mt-2 text-xs leading-5 text-slate-500">Register a CargoX-owned vehicle using existing capacity rules.</p><VehicleForm onDone={refresh} /></aside></div>
  </div>;
}
