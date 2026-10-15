import { useMemo, useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Clock3, FileCheck, MapPin, RefreshCw, Search, Truck, UserRound, X, ExternalLink, XCircle, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import { api } from "../services/api";

type Props = { trips: any[]; vehicles: any[]; drivers: any[]; isRefreshing: boolean; loadData: () => void; onMarkInTransit: (id: string) => void; onForceComplete: (id: string) => void };
const normalize = (value: string | undefined) => (value || "").toUpperCase().replace(/ /g, "_");
const activeStatuses = ["VEHICLE_ASSIGNED", "DRIVER_ASSIGNED", "PICKUP_IN_PROGRESS", "IN_TRANSIT", "ARRIVED", "POD_SUBMITTED"];
const statusOptions = ["ALL", ...activeStatuses, "DELIVERED", "COMPLETED"];

function StatusBadge({ status }: { status: string }) {
  const value = normalize(status);
  const tone = ["DELIVERED", "COMPLETED"].includes(value) ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : value === "ARRIVED" ? "border-amber-400/20 bg-amber-400/10 text-amber-300" : value === "POD_SUBMITTED" ? "border-purple-400/20 bg-purple-400/10 text-purple-300" : "border-blue-400/20 bg-blue-400/10 text-blue-300";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold tracking-[0.12em] ${tone}`}>{status?.replace(/_/g, " ") || "UNKNOWN"}</span>;
}

function Route({ trip }: { trip: any }) {
  return <div className="space-y-1.5"><p className="flex items-start gap-1.5 text-xs text-slate-300"><MapPin size={13} className="mt-0.5 shrink-0 text-emerald-400" />{trip.request?.pickup_address || "Pickup unavailable"}</p><p className="ml-5 text-[10px] text-slate-700">to</p><p className="flex items-start gap-1.5 text-xs text-slate-400"><MapPin size={13} className="mt-0.5 shrink-0 text-red-400" />{trip.request?.destination_address || "Destination unavailable"}</p></div>;
}

function Coordinates({ trip }: { trip: any }) {
  const lat = Number(trip.current_lat); const lng = Number(trip.current_lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? <span className="font-mono text-xs text-slate-400">{lat.toFixed(4)}, {lng.toFixed(4)}</span> : <span className="text-slate-600">Location unavailable</span>;
}

function DetailPanel({ trip, vehicles, drivers, detail, locations, loading, error, onClose, onMarkInTransit, onForceComplete, onRefreshTrip }: any) {
  const assignment = detail?.assignment;
  const vehicle = vehicles.find((item: any) => String(item.id) === String(assignment?.vehicle_id));
  const driver = drivers.find((item: any) => String(item.id) === String(assignment?.driver_id));
  const hasCoordinates = Number.isFinite(Number(trip.current_lat)) && Number.isFinite(Number(trip.current_lng));
  const pod = detail?.pod;

  const [verifyingPod, setVerifyingPod] = useState(false);
  const [rejectingPod, setRejectingPod] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Delivery and Pickup OTP State and Exception Override
  const [pickupOtpStatus, setPickupOtpStatus] = useState<any>(null);
  const [deliveryOtpStatus, setDeliveryOtpStatus] = useState<any>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overridePurpose, setOverridePurpose] = useState<"PICKUP" | "DELIVERY">("DELIVERY");
  const [overrideReason, setOverrideReason] = useState("");
  const [overridingOtp, setOverridingOtp] = useState(false);

  const fetchBothOtpStatuses = async () => {
    if (!trip?.id) return;
    try {
      const [pickupRes, deliveryRes] = await Promise.allSettled([
        api.getTripOTPStatus(trip.id, "PICKUP"),
        api.getTripOTPStatus(trip.id, "DELIVERY")
      ]);
      if (pickupRes.status === "fulfilled") setPickupOtpStatus(pickupRes.value);
      if (deliveryRes.status === "fulfilled") setDeliveryOtpStatus(deliveryRes.value);
    } catch (err: any) {
      console.warn("Failed to fetch OTP statuses:", err);
    }
  };

  useEffect(() => {
    if (trip?.id) {
      fetchBothOtpStatuses();
    }
  }, [trip?.id, detail?.pod]);

  const handleOverrideOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const reqId = trip.request_id || trip.request?.id;
    if (!reqId) {
      alert("Delivery request ID not found.");
      return;
    }
    if (overrideReason.trim().length < 5) {
      alert("A detailed justification reason (min 5 characters) is mandatory for admin override.");
      return;
    }
    setOverridingOtp(true);
    try {
      const res = await api.overrideDeliveryOTP(reqId, overrideReason.trim(), overridePurpose);
      alert(res.message || `${overridePurpose} OTP successfully bypassed by Admin.`);
      setOverrideModalOpen(false);
      setOverrideReason("");
      await fetchBothOtpStatuses();
      if (onRefreshTrip) await onRefreshTrip();
    } catch (err: any) {
      alert(`Failed to override OTP: ${err.message}`);
    } finally {
      setOverridingOtp(false);
    }
  };

  const handleVerifyPOD = async () => {
    if (!confirm("Confirm and verify Proof of Delivery for this shipment?")) return;
    setVerifyingPod(true);
    try {
      await api.verifyPOD(trip.id);
      alert("POD successfully verified! Trip marked as Delivered.");
      if (onRefreshTrip) await onRefreshTrip();
    } catch (err: any) {
      alert(`Failed to verify POD: ${err.message}`);
    } finally {
      setVerifyingPod(false);
    }
  };

  const handleRejectPOD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert("Please enter a specific rejection reason.");
      return;
    }
    setRejectingPod(true);
    try {
      await api.rejectPOD(trip.id, rejectionReason.trim());
      alert("POD rejected. Trip status reverted to ARRIVED for driver resubmission.");
      setRejectModalOpen(false);
      setRejectionReason("");
      if (onRefreshTrip) await onRefreshTrip();
    } catch (err: any) {
      alert(`Failed to reject POD: ${err.message}`);
    } finally {
      setRejectingPod(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    {/* Full image preview modal */}
    {previewImage && (
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewImage(null)}>
        <div className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
          <button onClick={() => setPreviewImage(null)} className="absolute right-3 top-3 z-10 rounded-full bg-slate-900/80 p-2 text-slate-300 hover:text-white">
            <X size={18} />
          </button>
          <img src={previewImage} alt="POD Document" className="max-h-[80vh] w-auto rounded-lg object-contain" />
        </div>
      </div>
    )}

    {/* Reject POD Modal */}
    {rejectModalOpen && (
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={18} />
              <h3 className="font-bold text-white text-base">Reject Proof of Delivery</h3>
            </div>
            <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
          </div>
          <p className="text-xs text-slate-400">
            Specify the reason for rejecting this POD. The driver will be notified to review and resubmit an updated proof of delivery.
          </p>
          <form onSubmit={handleRejectPOD} className="space-y-4">
            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Signature illegible, damaged packaging on arrival, or incorrect recipient name"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white outline-none focus:border-red-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rejectingPod || !rejectionReason.trim()}
                className="rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white transition"
              >
                {rejectingPod ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Admin Delivery OTP Override Exception Modal */}
    {overrideModalOpen && (
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 p-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-950 p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-amber-400">
              <ShieldAlert size={20} />
              <h3 className="font-bold text-white text-base">Authorized Delivery OTP Override</h3>
            </div>
            <button onClick={() => setOverrideModalOpen(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
          </div>
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200">
            <p className="font-bold mb-1">Security & Compliance Rule:</p>
            This action creates an immutable audit record attributing this delivery handover bypass to your admin credentials. A specific reason is mandatory (e.g. recipient phone damaged, cellular network outage at remote warehouse).
          </div>
          <form onSubmit={handleOverrideOTP} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Stage / Purpose <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-4 text-xs text-white">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="overridePurpose"
                    value="DELIVERY"
                    checked={overridePurpose === "DELIVERY"}
                    onChange={() => setOverridePurpose("DELIVERY")}
                    className="accent-amber-500"
                  />
                  Delivery Handover OTP
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="overridePurpose"
                    value="PICKUP"
                    checked={overridePurpose === "PICKUP"}
                    onChange={() => setOverridePurpose("PICKUP")}
                    className="accent-amber-500"
                  />
                  Pickup Handover OTP
                </label>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Override Justification Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="e.g. Device offline at dock; verified identity manually via physical badge #EMP-9402"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOverrideModalOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={overridingOtp || overrideReason.trim().length < 5}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5"
              >
                <ShieldCheck size={14} />
                {overridingOtp ? "Authorizing Override..." : "Authorize OTP Bypass"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950/95 p-5 backdrop-blur">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400">Trip operations workspace</p>
          <h2 className="mt-1 text-xl font-bold text-white">Trip #{String(trip.id).slice(-8)}</h2>
          <p className="mt-1 text-xs text-slate-500">{trip.request?.request_number || `Request #${String(trip.request_id).slice(-8)}`}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={trip.status} />
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
        </div>
      </div>

      {error && <div className="m-5 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"><AlertCircle size={15} />Unable to load trip assignment or location details.</div>}
      
      <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">Customer and cargo</p>
              <p className="mt-2 text-sm font-semibold text-white">{trip.request?.pickup_company_name || "Customer unavailable"}</p>
              <p className="mt-1 text-xs text-slate-500">{trip.request?.goods_type || "Cargo unavailable"} · {trip.request?.weight_tons ?? "—"} tons</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">GPS update</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white"><Clock3 size={15} className="text-blue-400" />{hasCoordinates ? "Coordinate available" : "No location reported"}</p>
              <p className="mt-1 text-xs text-slate-500">Timestamp unavailable from current trip payload</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Route</p>
            <Route trip={trip} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-2 text-blue-400"><Truck size={16} /><p className="text-[10px] font-bold uppercase tracking-wider">Vehicle</p></div>
              <p className="mt-3 text-sm font-bold text-white">{vehicle?.registration_number || "Assignment unavailable"}</p>
              <p className="mt-1 text-xs text-slate-500">{vehicle ? `${vehicle.type} · ${vehicle.capacity_tons} tons` : "Vehicle details not provided"}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-2 text-blue-400"><UserRound size={16} /><p className="text-[10px] font-bold uppercase tracking-wider">Driver</p></div>
              <p className="mt-3 text-sm font-bold text-white">{driver?.name || "Assignment unavailable"}</p>
              <p className="mt-1 text-xs text-slate-500">{driver?.phone || "Driver details not provided"}</p>
            </div>
          </div>

          {/* Operational Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => onMarkInTransit(trip.id)} disabled={!['VEHICLE_ASSIGNED', 'DRIVER_ASSIGNED'].includes(normalize(trip.status))} className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-2 text-xs font-bold text-white disabled:opacity-40 transition">Mark in transit</button>
            <button onClick={() => onForceComplete(trip.id)} disabled={normalize(trip.status) === "COMPLETED"} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40 transition">Complete and invoice</button>
          </div>

          {/* Dedicated Proof of Delivery (POD) Section */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck size={16} className="text-emerald-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Proof of Delivery (POD)</p>
                  <p className="text-xs font-semibold text-white mt-0.5">Delivery Verification Record</p>
                </div>
              </div>
              {pod ? (
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                  pod.status === "VERIFIED" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" :
                  pod.status === "REJECTED" ? "bg-red-500/10 text-red-300 border-red-500/30" :
                  "bg-purple-500/10 text-purple-300 border-purple-500/30"
                }`}>
                  {pod.status || "SUBMITTED"}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono">Not submitted yet</span>
              )}
            </div>

            {pod ? (
              <div className="mt-3 space-y-3">
                {/* Dual Stage OTP Verification Status (Pickup & Delivery) */}
                <div className="space-y-2">
                  {/* Pickup OTP Status */}
                  <div className={`rounded-xl border p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                    pickupOtpStatus?.is_verified
                      ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                      : "bg-slate-900 border-slate-800 text-slate-400"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`p-1.5 rounded-lg ${
                        pickupOtpStatus?.is_verified ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                      }`}>
                        <ShieldCheck size={16} />
                      </span>
                      <div>
                        <p className="font-bold text-white text-xs">
                          {pickupOtpStatus?.is_verified
                            ? (pickupOtpStatus?.is_admin_override
                                ? "Pickup OTP Verified (Admin Override)"
                                : "Pickup OTP Verified")
                            : "Pickup OTP Pending / Not Verified"}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {pickupOtpStatus?.is_verified
                            ? `Verified on ${pickupOtpStatus?.verified_at ? new Date(pickupOtpStatus.verified_at).toLocaleTimeString() : "pickup"}`
                            : "Required before transit start"}
                        </p>
                        {pickupOtpStatus?.override_reason && (
                          <p className="text-[11px] text-amber-300/90 italic mt-0.5">
                            Override: {pickupOtpStatus.override_reason}
                          </p>
                        )}
                      </div>
                    </div>
                    {!pickupOtpStatus?.is_verified && (
                      <button
                        type="button"
                        onClick={() => {
                          setOverridePurpose("PICKUP");
                          setOverrideModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <ShieldAlert size={12} />
                        Override Pickup OTP
                      </button>
                    )}
                  </div>

                  {/* Delivery OTP Status */}
                  <div className={`rounded-xl border p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                    (deliveryOtpStatus?.is_verified || pod?.otp_verified)
                      ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                      : "bg-amber-950/20 border-amber-500/30 text-amber-300"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`p-1.5 rounded-lg ${
                        (deliveryOtpStatus?.is_verified || pod?.otp_verified) ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                      }`}>
                        <ShieldCheck size={16} />
                      </span>
                      <div>
                        <p className="font-bold text-white text-xs">
                          {(deliveryOtpStatus?.is_verified || pod?.otp_verified)
                            ? (deliveryOtpStatus?.is_admin_override || pod?.otp_is_override
                                ? "Delivery Handover Verified (Admin Override)"
                                : "Delivery Handover OTP Verified")
                            : "Delivery Handover OTP Pending"}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {(deliveryOtpStatus?.is_verified || pod?.otp_verified)
                            ? `Verified on ${deliveryOtpStatus?.verified_at ? new Date(deliveryOtpStatus.verified_at).toLocaleTimeString() : "arrival"}`
                            : `Customer displays code upon driver arrival`}
                        </p>
                        {deliveryOtpStatus?.override_reason && (
                          <p className="text-[11px] text-amber-300/90 italic mt-0.5">
                            Override: {deliveryOtpStatus.override_reason}
                          </p>
                        )}
                      </div>
                    </div>
                    {!deliveryOtpStatus?.is_verified && !pod?.otp_verified && (
                      <button
                        type="button"
                        onClick={() => {
                          setOverridePurpose("DELIVERY");
                          setOverrideModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <ShieldAlert size={12} />
                        Override Delivery OTP
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-950/60 p-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Recipient Name</p>
                    <p className="mt-1 font-bold text-white">{pod.receiver_name || "—"}</p>
                    {pod.receiver_phone && <p className="mt-0.5 text-slate-400">{pod.receiver_phone}</p>}
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Submitted Time</p>
                    <p className="mt-1 font-semibold text-white">{pod.submitted_at ? new Date(pod.submitted_at).toLocaleString() : "Recent"}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">By {pod.submitted_by_name || "Driver"}</p>
                  </div>
                </div>

                {pod.notes && (
                  <div className="rounded-lg bg-slate-950/40 p-2.5 text-xs">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Delivery Notes</p>
                    <p className="mt-1 text-slate-300 italic">{pod.notes}</p>
                  </div>
                )}

                {pod.rejection_reason && pod.status === "REJECTED" && (
                  <div className="rounded-lg bg-red-950/30 border border-red-500/20 p-2.5 text-xs text-red-300">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-red-400">Rejection Reason</p>
                    <p className="mt-1">{pod.rejection_reason}</p>
                  </div>
                )}

                {/* Attachment / Photo / Signature preview */}
                {(pod.file_url || pod.pod_signature_url || pod.pod_photo_url) && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-2">POD Document / Signature</p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewImage(pod.file_url || pod.pod_signature_url || pod.pod_photo_url)}
                        className="group relative h-20 w-28 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 transition hover:border-blue-400"
                      >
                        <img
                          src={pod.file_url || pod.pod_signature_url || pod.pod_photo_url}
                          alt="POD Proof"
                          className="h-full w-full object-cover group-hover:opacity-80"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition">
                          Inspect
                        </span>
                      </button>
                      <div className="text-xs space-y-1">
                        <a
                          href={pod.file_url || pod.pod_signature_url || pod.pod_photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-blue-400 hover:text-blue-300"
                        >
                          Open Full Image <ExternalLink size={12} />
                        </a>
                        <p className="text-[11px] text-slate-500">Captured and digitally signed at destination</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Verification Actions (when POD is pending verification) */}
                {normalize(trip.status) === "POD_SUBMITTED" && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
                    <button
                      type="button"
                      disabled={verifyingPod}
                      onClick={handleVerifyPOD}
                      className="flex-1 min-w-[120px] rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2.5 px-3 text-xs font-bold text-white transition flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={14} />
                      {verifyingPod ? "Verifying..." : "Verify & Approve POD"}
                    </button>
                    <button
                      type="button"
                      disabled={rejectingPod}
                      onClick={() => setRejectModalOpen(true)}
                      className="flex-1 min-w-[120px] rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 disabled:opacity-50 py-2.5 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <XCircle size={14} />
                      Reject POD
                    </button>
                  </div>
                )}

                {pod.status === "VERIFIED" && pod.verified_at && (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Verified on {new Date(pod.verified_at).toLocaleString()}
                    {pod.verified_by_email && ` by ${pod.verified_by_email}`}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Awaiting destination handover. The assigned driver will submit the proof of delivery upon physical arrival.
              </p>
            )}
          </div>

          {detail?.invoice && <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center justify-between border-b border-slate-800 pb-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Payment records & monitoring</p><p className="mt-0.5 text-xs font-semibold text-white">Invoice #{detail.invoice.invoice_number}</p></div><span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${detail.invoice.is_fully_paid ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : (detail.invoice.amount_paid > 0 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30")}`}>{detail.invoice.is_fully_paid ? "Payment Completed" : detail.invoice.invoice_status}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-slate-950/60 p-2"><p className="text-[9px] uppercase tracking-wider text-slate-500">Total</p><p className="mt-1 font-bold text-white">₹{detail.invoice.total_amount?.toLocaleString("en-IN") || "—"}</p></div><div className="rounded-lg bg-slate-950/60 p-2"><p className="text-[9px] uppercase tracking-wider text-emerald-400">Paid</p><p className="mt-1 font-bold text-emerald-300">₹{detail.invoice.amount_paid?.toLocaleString("en-IN") || "0"}</p></div><div className="rounded-lg bg-slate-950/60 p-2"><p className="text-[9px] uppercase tracking-wider text-amber-400">Due</p><p className="mt-1 font-bold text-amber-300">₹{detail.invoice.amount_due?.toLocaleString("en-IN") || "0"}</p></div></div><div className="mt-3 space-y-1 rounded-lg bg-slate-950/40 p-2.5 text-xs"><div className="flex justify-between text-slate-400"><span>Method:</span><span className="font-semibold text-slate-200">{detail.invoice.payment_method || "Pending selection"}</span></div>{detail.invoice.gateway_order_id && <div className="flex justify-between text-slate-400"><span>Provider Order ID:</span><span className="font-mono text-[11px] text-blue-400">{detail.invoice.gateway_order_id}</span></div>}{detail.invoice.gateway_payment_id && <div className="flex justify-between text-slate-400"><span>Provider Payment ID:</span><span className="font-mono text-[11px] text-emerald-400">{detail.invoice.gateway_payment_id}</span></div>}</div>{detail.invoice.payments?.length > 0 && <div className="mt-3 border-t border-slate-800/80 pt-2.5"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Verified payment ledger</p><div className="space-y-2">{detail.invoice.payments.map((p: any) => <div key={p.payment_id} className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 text-xs"><div className="flex items-center justify-between font-semibold text-white"><span>₹{p.amount?.toLocaleString("en-IN")} via {p.payment_method}</span><span className="text-[10px] text-slate-400">{p.paid_at ? new Date(p.paid_at).toLocaleString() : "Recent"}</span></div><div className="mt-1 space-y-0.5 text-[11px] text-slate-400"><p><span className="text-slate-500">Internal Record ID:</span> <span className="font-mono text-slate-300">{p.payment_id}</span></p>{p.provider_payment_id && <p><span className="text-emerald-500">Provider Trans ID:</span> <span className="font-mono text-emerald-300">{p.provider_payment_id}</span></p>}{p.collection_reference && <p><span className="text-amber-500">Collection Ref / UTR:</span> <span className="font-mono text-amber-300">{p.collection_reference}</span></p>}{p.recorded_by_email && <p><span className="text-slate-500">Recorded By:</span> <span className="text-slate-300">{p.recorded_by_email}</span></p>}{p.notes && <p className="italic text-slate-500">{p.notes}</p>}</div></div>)}</div></div>}</div>}
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Current location</p>
                <p className="mt-1 text-sm font-semibold text-white">{hasCoordinates ? "Vehicle coordinate" : "Location unavailable"}</p>
              </div>
              <MapPin size={18} className={hasCoordinates ? "text-emerald-400" : "text-slate-700"} />
            </div>
            {hasCoordinates ? (
              <>
                <p className="mb-3"><Coordinates trip={trip} /></p>
                <div className="h-40 overflow-hidden rounded-lg">
                  <div className="flex h-full items-center justify-center border border-dashed border-slate-700 bg-slate-950 text-center text-xs text-slate-500">
                    Live map is unavailable in the current admin tracking components.<br />Coordinates are shown from the backend.
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950 text-center">
                <MapPin size={22} className="text-slate-700" />
                <p className="text-sm font-semibold text-slate-400">No live location available</p>
                <p className="text-xs text-slate-600">GPS location will appear when the assigned vehicle reports its position.</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Location history</p>
            {loading ? <div className="h-20 animate-pulse rounded bg-slate-800" /> : locations.length ? <div className="space-y-3">{locations.slice().reverse().map((location: any, index: number) => <div key={`${location.recorded_at || index}-${index}`} className="flex gap-3 border-l border-slate-700 pl-3"><div className="-ml-4.75 mt-1 h-2.5 w-2.5 rounded-full bg-blue-400" /><div><p className="font-mono text-xs text-slate-300">{Number(location.lat ?? location.latitude).toFixed(4)}, {Number(location.lng ?? location.longitude).toFixed(4)}</p><p className="mt-1 text-[10px] text-slate-600">{location.recorded_at ? new Date(location.recorded_at).toLocaleString() : "Timestamp unavailable"}</p></div></div>)}</div> : <p className="py-5 text-center text-xs text-slate-600">No tracking events recorded yet.</p>}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Trip progress</p>
            <div className="flex flex-wrap gap-2">{["TRIP_CREATED", "VEHICLE_ASSIGNED", "DRIVER_ASSIGNED", "PICKUP_IN_PROGRESS", "IN_TRANSIT", "ARRIVED", "POD_SUBMITTED", "DELIVERED", "COMPLETED"].map((stage) => <span key={stage} className={`rounded-md border px-2 py-1 text-[10px] ${normalize(trip.status) === stage ? "border-blue-400/30 bg-blue-400/10 text-blue-300" : "border-slate-800 text-slate-600"}`}>{stage.replace(/_/g, " ")}</span>)}</div>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

export default function ActiveTripsPanel({ trips, vehicles, drivers, isRefreshing, loadData, onMarkInTransit, onForceComplete }: Props) {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState("ALL"); const [selectedTrip, setSelectedTrip] = useState<any>(null); const [detail, setDetail] = useState<any>(null); const [locations, setLocations] = useState<any[]>([]); const [detailLoading, setDetailLoading] = useState(false); const [detailError, setDetailError] = useState(false);
  const operationalTrips = trips.filter((trip) => activeStatuses.includes(normalize(trip.status)) || ["DELIVERED", "COMPLETED"].includes(normalize(trip.status)));
  const filteredTrips = useMemo(() => operationalTrips.filter((trip) => { const searchable = [trip.id, trip.request_id, trip.request?.request_number, trip.request?.pickup_company_name, trip.request?.goods_type, trip.request?.pickup_address, trip.request?.destination_address].join(" ").toLowerCase(); return (!query || searchable.includes(query.toLowerCase())) && (filter === "ALL" || normalize(trip.status) === filter); }), [filter, operationalTrips, query]);
  const openTrip = async (trip: any) => { setSelectedTrip(trip); setDetail(null); setLocations([]); setDetailError(false); setDetailLoading(true); try { const [tripDetail, history] = await Promise.all([api.getTripDetail(String(trip.id)), api.getLocationHistory(trip.id)]); setDetail(tripDetail); setLocations(Array.isArray(history) ? history : []); } catch { setDetailError(true); } finally { setDetailLoading(false); } };
  const reloadTripDetail = async () => {
    if (!selectedTrip) return;
    loadData();
    try {
      const [tripDetail, history] = await Promise.all([api.getTripDetail(String(selectedTrip.id)), api.getLocationHistory(selectedTrip.id)]);
      setDetail(tripDetail);
      setLocations(Array.isArray(history) ? history : []);
      // update status in selectedTrip if changed
      if (tripDetail?.status) {
        setSelectedTrip((prev: any) => ({ ...prev, status: tripDetail.status }));
      }
    } catch {
      // ignore
    }
  };
  const inTransit = operationalTrips.filter((trip) => normalize(trip.status) === "IN_TRANSIT").length; const arrived = operationalTrips.filter((trip) => normalize(trip.status) === "ARRIVED").length; const gpsLive = operationalTrips.filter((trip) => Number.isFinite(Number(trip.current_lat)) && Number.isFinite(Number(trip.current_lng))).length;
  const metrics = [{ label: "Active trips", value: operationalTrips.filter((trip) => activeStatuses.includes(normalize(trip.status))).length, detail: "Currently operational", icon: Truck, tone: "text-blue-400" }, { label: "In transit", value: inTransit, detail: "On the road", icon: Truck, tone: "text-blue-400" }, { label: "Arrived", value: arrived, detail: "At destination", icon: MapPin, tone: "text-amber-400" }, { label: "GPS live", value: gpsLive, detail: "Coordinates available", icon: CheckCircle2, tone: "text-emerald-400" }];
  return <div className="mx-auto max-w-[1600px] space-y-6">{selectedTrip && <DetailPanel trip={selectedTrip} vehicles={vehicles} drivers={drivers} detail={detail} locations={locations} loading={detailLoading} error={detailError} onClose={() => setSelectedTrip(null)} onMarkInTransit={onMarkInTransit} onForceComplete={onForceComplete} onRefreshTrip={reloadTripDetail} />}<header className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">Transport operations center</p><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Active Trips</h1><p className="mt-1 text-sm text-slate-500">Monitor active deliveries, vehicle locations, drivers and trip progress</p></div><button onClick={loadData} disabled={isRefreshing} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-blue-500/50 disabled:opacity-50"><RefreshCw size={15} className={isRefreshing ? "animate-spin text-blue-400" : ""} />{isRefreshing ? "Updating..." : "Refresh"}</button></header><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg"><span className={`inline-flex rounded-lg bg-slate-800 p-2 ${metric.tone}`}><metric.icon size={17} /></span><p className="mt-4 text-2xl font-bold text-white">{metric.value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p><p className="mt-2 text-xs text-slate-600">{metric.detail}</p></div>)}</div><section className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-white"><Truck size={17} className="text-blue-400" />Trip activity <span className="text-xs font-normal normal-case tracking-normal text-slate-600">{filteredTrips.length} shown</span></div><div className="flex flex-col gap-2 sm:flex-row"><div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"><Search size={15} className="text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trips..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600 sm:w-64" /></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-300 outline-none">{statusOptions.map((option) => <option key={option} value={option}>{option === "ALL" ? "All statuses" : option.replace(/_/g, " ")}</option>)}</select></div></div>{!filteredTrips.length ? <div className="py-16 text-center"><Truck className="mx-auto mb-3 text-slate-700" size={28} /><p className="text-sm font-semibold text-slate-300">{operationalTrips.length ? "No trips match your search" : "No active trips right now."}</p><p className="mt-1 text-xs text-slate-600">New dispatched trips will appear here.</p></div> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-212.5 text-left"><thead><tr className="border-b border-slate-800 text-[10px] uppercase tracking-[0.14em] text-slate-600"><th className="px-3 py-3">Trip / request</th><th className="px-3 py-3">Customer / cargo</th><th className="px-3 py-3">Route</th><th className="px-3 py-3">Vehicle / driver</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Last location</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-800/80">{filteredTrips.map((trip) => <tr key={String(trip.id)} className="hover:bg-slate-800/30"><td className="px-3 py-4"><p className="font-mono text-sm font-bold text-blue-300">#{String(trip.id).slice(-8)}</p><p className="mt-1 text-xs text-slate-500">{trip.request?.request_number || "Request unavailable"}</p></td><td className="px-3 py-4"><p className="text-sm font-semibold text-slate-200">{trip.request?.pickup_company_name || "Customer unavailable"}</p><p className="mt-1 text-xs text-slate-500">{trip.request?.goods_type || "Cargo unavailable"} · {trip.request?.weight_tons ?? "—"} t</p></td><td className="max-w-56 px-3 py-4"><Route trip={trip} /></td><td className="px-3 py-4 text-xs text-slate-500"><p>Assignment in detail</p><p className="mt-1 text-slate-600">Select to load</p></td><td className="px-3 py-4"><StatusBadge status={trip.status} /></td><td className="px-3 py-4"><Coordinates trip={trip} /></td><td className="px-3 py-4 text-right"><button onClick={() => openTrip(trip)} className="rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-300 hover:bg-blue-500/20">View tracking</button></td></tr>)}</tbody></table></div>}</section></div>;
}
