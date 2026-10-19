import React, { useState } from 'react';
import {
  ArrowLeft,
  Navigation,
  Phone,
  MessageSquare,
  ShieldAlert,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Banknote,
  QrCode,
  FileCheck,
  RotateCw,
  Copy,
  ChevronRight,
  ShieldCheck,
  Compass,
  X,
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Polyline } from 'react-leaflet';
import { api } from '../services/api';

interface DriverActiveOrderScreenProps {
  onBack: () => void;
  activeTrip: any;
  onRefreshTrip: () => Promise<void>;
  onOpenSOSModal?: () => void;
  onOpenPODModal?: () => void;
  onOpenPaymentModal?: () => void;
}

export const DriverActiveOrderScreen: React.FC<DriverActiveOrderScreenProps> = ({
  onBack,
  activeTrip,
  onRefreshTrip,
  onOpenSOSModal,
  onOpenPODModal,
  onOpenPaymentModal,
}) => {
  const [navigating, setNavigating] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [startingPickup, setStartingPickup] = useState(false);
  const [startingTransit, setStartingTransit] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string | null>(null);

  // Pickup OTP State
  const [pickupOtpModalOpen, setPickupOtpModalOpen] = useState(false);
  const [pickupOtpInput, setPickupOtpInput] = useState('');
  const [verifyingPickupOtp, setVerifyingPickupOtp] = useState(false);
  const [pickupOtpError, setPickupOtpError] = useState<string | null>(null);
  const [pickupOtpSuccessMsg, setPickupOtpSuccessMsg] = useState<string | null>(null);

  // Cash payment collection state
  const [recordingCash, setRecordingCash] = useState(false);
  const [cashReference, setCashReference] = useState('');
  const [cashSuccessMsg, setCashSuccessMsg] = useState<string | null>(null);

  // Derive status
  const rawStatus = (activeTrip?.status || '').toUpperCase().replace(/ /g, '_');
  const isPickupPhase = ['DRIVER_ASSIGNED', 'ASSIGNED', 'PICKUP_IN_PROGRESS'].includes(rawStatus);
  const isInTransit = rawStatus === 'IN_TRANSIT';
  const isArrived = rawStatus === 'ARRIVED';
  const isPodSubmitted = rawStatus === 'POD_SUBMITTED';
  const isCompleted = ['COMPLETED', 'DELIVERED'].includes(rawStatus);

  // Fallback defaults matching Hyderabad -> Vijayawada
  const pickupCity = (activeTrip?.pickup_address || 'Qutubullapur, Hyderabad').split(',')[0].trim();
  const destCity = (activeTrip?.destination_address || 'Vijayawada, Andhra Pradesh').split(',')[0].trim();
  const pickupLat = activeTrip?.pickup_lat || 17.5097;
  const pickupLng = activeTrip?.pickup_lng || 78.4727;
  const destLat = activeTrip?.destination_lat || 16.5062;
  const destLng = activeTrip?.destination_lng || 80.6480;

  const currentLat = activeTrip?.current_lat || 17.3850;
  const currentLng = activeTrip?.current_lng || 78.4867;

  const routeWaypoints: [number, number][] = [
    [pickupLat, pickupLng],
    [17.0500, 79.2700], // Nalgonda
    [destLat, destLng],
  ];

  const targetTripId = activeTrip?.trip_id || activeTrip?.id;

  // 1. Google Maps Navigation
  const handleStartGoogleNavigation = () => {
    setNavigating(true);
    const destinationQuery = encodeURIComponent(activeTrip?.destination_address || `${destLat},${destLng}`);
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}&travelmode=driving`;
    window.open(navUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCallCustomer = () => {
    const phone = activeTrip?.destination_phone || activeTrip?.pickup_phone || '9876543210';
    window.location.href = `tel:${phone}`;
  };

  const handleMessageCustomer = () => {
    const phone = activeTrip?.destination_phone || activeTrip?.pickup_phone || '9876543210';
    const text = encodeURIComponent(`Hello, I am your CargoExpress driver for trip #${activeTrip?.request_number || 'ASSIGNED'}.`);
    window.location.href = `sms:${phone}?body=${text}`;
  };

  const handleSOS = () => {
    if (onOpenSOSModal) {
      onOpenSOSModal();
    } else {
      const confirmSOS = window.confirm(
        'EMERGENCY SOS: Contact CargoExpress 24/7 Operations Incident Desk immediately?'
      );
      if (confirmSOS) {
        window.location.href = 'tel:18002660000';
      }
    }
  };

  // Start Pickup Action (DRIVER_ASSIGNED -> PICKUP_IN_PROGRESS)
  const handleStartPickup = async () => {
    if (!targetTripId || startingPickup) return;
    setStartingPickup(true);
    try {
      await api.driverStartPickup(targetTripId);
      await onRefreshTrip();
    } catch (err: any) {
      alert(`Start pickup failed: ${err?.message || "Could not start pickup"}`);
    } finally {
      setStartingPickup(false);
    }
  };

  // Start Transit Action (PICKUP_IN_PROGRESS -> IN_TRANSIT)
  const handleStartTransit = async () => {
    if (!targetTripId || startingTransit) return;
    setStartingTransit(true);
    try {
      await api.driverStartTransit(targetTripId);
      await onRefreshTrip();
    } catch (err: any) {
      const errMsg = String(err?.message || "");
      if (errMsg.toLowerCase().includes("pickup") || errMsg.toLowerCase().includes("otp")) {
        // Automatically open the Pickup OTP Verification Modal
        setPickupOtpModalOpen(true);
      } else {
        alert(`Start transit failed: ${err?.message || "Could not start transit"}`);
      }
    } finally {
      setStartingTransit(false);
    }
  };

  const handleVerifyPickupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPickupOtpError(null);
    setPickupOtpSuccessMsg(null);

    const cleanOtp = pickupOtpInput.trim();
    if (cleanOtp.length !== 6) {
      setPickupOtpError("Please enter the 6-digit Pickup OTP.");
      return;
    }

    setVerifyingPickupOtp(true);
    try {
      const res = await api.verifyDeliveryOTP(targetTripId, cleanOtp, "PICKUP");
      setPickupOtpSuccessMsg(res.message || "Pickup verified successfully! Starting transit now...");
      setPickupOtpInput("");
      // Now start transit immediately
      await api.driverStartTransit(targetTripId);
      await onRefreshTrip();
      setTimeout(() => {
        setPickupOtpModalOpen(false);
      }, 1000);
    } catch (err: any) {
      setPickupOtpError(err.message || "Invalid Pickup OTP. Please ask customer to read the OTP from their tracking screen.");
    } finally {
      setVerifyingPickupOtp(false);
    }
  };

  // 2. Mark Arrival Action
  const handleConfirmArrival = async () => {
    if (!targetTripId || arriving) return;
    setArriving(true);
    try {
      await api.driverArrive(targetTripId);
      await onRefreshTrip();
    } catch (err: any) {
      alert(`Arrival failed: ${err.message || 'Could not confirm arrival'}`);
    } finally {
      setArriving(false);
    }
  };

  // 3. Verify Handover Delivery OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setOtpSuccessMsg(null);

    const cleanOtp = otpInput.trim();
    if (!/^\d{4,6}$/.test(cleanOtp)) {
      setOtpError('Please enter a valid numeric verification OTP code.');
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await api.verifyDeliveryOTP(targetTripId, cleanOtp, 'DELIVERY');
      setOtpSuccessMsg(res.message || 'Handover OTP verified successfully! You may now proceed with POD and settlement.');
      setOtpInput('');
      await onRefreshTrip();
    } catch (err: any) {
      setOtpError(err.message || 'OTP verification failed. Please check the code with the recipient.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // 4. Record Cash on Delivery
  const dueAmount = parseFloat(activeTrip?.amount_due_for_collection || '0');
  const isPrepaid = dueAmount <= 0;

  const handleRecordCashCollection = async () => {
    if (!targetTripId || recordingCash) return;
    if (dueAmount <= 0) {
      alert('No outstanding amount due for collection.');
      return;
    }
    const confirmColl = window.confirm(
      `Confirm Cash Collection of ₹${dueAmount.toLocaleString()} from recipient?`
    );
    if (!confirmColl) return;

    setRecordingCash(true);
    try {
      await api.driverRecordCollection(targetTripId, {
        amount: dueAmount,
        payment_method: 'CASH',
        reference_notes: cashReference.trim() || 'Cash received by driver at delivery destination',
      });
      setCashSuccessMsg(`Cash payment of ₹${dueAmount.toLocaleString()} recorded successfully.`);
      await onRefreshTrip();
    } catch (err: any) {
      alert(`Failed to record cash: ${err.message || 'Error recording payment'}`);
    } finally {
      setRecordingCash(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto pb-24 px-4 pt-3 flex flex-col gap-3 text-slate-900 bg-white min-h-screen">
      {/* 1. Header (Back button, Active Order, Red SOS Button) */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 text-slate-800 hover:text-black transition cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft size={22} className="stroke-[2.5]" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-950 tracking-tight">Active Order</h1>
            <p className="text-[11px] font-bold text-emerald-700">
              Trip #{activeTrip?.request_number || 'TRIP-2026-00456'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSOS}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#EF4444] text-white font-black text-xs tracking-wider shadow-sm hover:bg-rose-600 active:scale-95 transition cursor-pointer"
        >
          <ShieldAlert size={15} />
          <span>SOS</span>
        </button>
      </div>

      {/* 2. Route Summary Strip (Pickup & Drop) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-xs font-bold text-slate-800 truncate">
            {activeTrip?.pickup_address || 'Qutubullapur, Hyderabad'}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
          <span className="text-xs font-bold text-slate-800 truncate">
            {activeTrip?.destination_address || 'Vijayawada, Andhra Pradesh'}
          </span>
        </div>
        
        {/* Status Stage Pill */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Phase</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {rawStatus.replace(/_/g, ' ') || 'IN TRANSIT'}
          </span>
        </div>
      </div>

      {/* 3. Interactive Route Map Container */}
      <div className="relative h-[36vh] min-h-[260px] w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs z-0">
        <MapContainer
          center={[16.9, 79.5]}
          zoom={8}
          scrollWheelZoom={false}
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://osm.org">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Pickup Marker */}
          <CircleMarker
            center={[pickupLat, pickupLng]}
            radius={7}
            pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 1 }}
          />

          {/* Destination Marker */}
          <CircleMarker
            center={[destLat, destLng]}
            radius={7}
            pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 1 }}
          />

          {/* Driver Live Current Location Marker */}
          <CircleMarker
            center={[currentLat, currentLng]}
            radius={9}
            pathOptions={{ color: '#2563EB', fillColor: '#3B82F6', fillOpacity: 1, weight: 3 }}
          />

          {/* Blue Route Polyline */}
          <Polyline
            positions={routeWaypoints}
            pathOptions={{ color: '#2563EB', weight: 4, opacity: 0.85 }}
          />
        </MapContainer>

        {/* Floating map controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-[400]">
          <button
            type="button"
            className="w-9 h-9 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-700 hover:text-black transition"
            onClick={() => {}}
            aria-label="Compass"
          >
            <Compass size={18} />
          </button>
          <button
            type="button"
            className="w-9 h-9 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-700 hover:text-black transition cursor-pointer"
            onClick={handleStartGoogleNavigation}
            aria-label="Navigate"
          >
            <Navigation size={18} className="text-emerald-600" />
          </button>
        </div>
      </div>

      {/* 4. Context-Sensitive Action Stages */}

      {/* STAGE A: While Traveling / In Transit -> Start Navigation & Arrived Button */}
      {(!isArrived && !isPodSubmitted && !isCompleted) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-2xl font-black text-slate-950 leading-tight">
                {activeTrip?.distance_km ? `${activeTrip.distance_km} km` : '312 km'}
              </span>
              <span className="text-xs text-slate-400 font-medium">Estimated 4h 50m</span>
            </div>

            <button
              type="button"
              onClick={handleStartGoogleNavigation}
              className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-black active:scale-95 text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition cursor-pointer"
            >
              <Navigation size={15} className="fill-white" />
              <span>Start Navigation</span>
            </button>
          </div>

          {/* Phase 1: Start Pickup (if in DRIVER_ASSIGNED or ASSIGNED) */}
          {(rawStatus === 'DRIVER_ASSIGNED' || rawStatus === 'ASSIGNED') && (
            <button
              type="button"
              disabled={startingPickup}
              onClick={handleStartPickup}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              {startingPickup ? (
                <>
                  <RotateCw size={18} className="animate-spin" />
                  <span>Starting Pickup Journey...</span>
                </>
              ) : (
                <>
                  <Navigation size={18} className="fill-white" />
                  <span>Start Pickup Journey</span>
                </>
              )}
            </button>
          )}

          {/* Phase 2: Pickup Verification & Start Transit (if in PICKUP_IN_PROGRESS) */}
          {rawStatus === 'PICKUP_IN_PROGRESS' && (
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <KeyRound size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-slate-900">Step 1: Verify Customer Pickup OTP</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Ask customer at pickup location to read the 6-digit code on their screen before goods depart.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleVerifyPickupOtp} className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pickupOtpInput}
                    onChange={(e) => setPickupOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit Pickup OTP"
                    className="flex-1 px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-center tracking-[0.2em] font-bold text-sm focus:outline-none focus:border-blue-600 shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={verifyingPickupOtp || pickupOtpInput.trim().length !== 6}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    {verifyingPickupOtp ? <RotateCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    <span>{verifyingPickupOtp ? "Verifying..." : "Verify"}</span>
                  </button>
                </form>

                {pickupOtpError && (
                  <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" />
                    {pickupOtpError}
                  </p>
                )}
                {pickupOtpSuccessMsg && (
                  <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                    {pickupOtpSuccessMsg}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={startingTransit}
                onClick={handleStartTransit}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                {startingTransit ? (
                  <>
                    <RotateCw size={18} className="animate-spin" />
                    <span>Starting Transit...</span>
                  </>
                ) : (
                  <>
                    <Navigation size={18} className="fill-white" />
                    <span>Goods Loaded · Start Transit</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Phase 3: Arrived at Destination (when IN_TRANSIT) */}
          {rawStatus === 'IN_TRANSIT' && (
            <button
              type="button"
              disabled={arriving}
              onClick={handleConfirmArrival}
              className="w-full py-3.5 px-4 rounded-xl bg-[#10B981] hover:bg-emerald-600 active:scale-98 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              {arriving ? (
                <>
                  <RotateCw size={18} className="animate-spin" />
                  <span>Submitting Arrival...</span>
                </>
              ) : (
                <>
                  <MapPin size={18} className="fill-white" />
                  <span>Arrived at Destination</span>
                </>
              )}
            </button>
          )}

          {/* Contact buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCallCustomer}
              className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-2 text-xs font-bold text-slate-800 transition cursor-pointer"
            >
              <Phone size={15} className="text-slate-600" />
              <span>Call Customer</span>
            </button>

            <button
              type="button"
              onClick={handleMessageCustomer}
              className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-2 text-xs font-bold text-slate-800 transition cursor-pointer"
            >
              <MessageSquare size={15} className="text-slate-600" />
              <span>Message</span>
            </button>
          </div>
        </div>
      )}

      {/* STAGE B: On Arrival -> OTP Verification & Handover */}
      {isArrived && (
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/20 p-4 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                Arrival Confirmed
              </span>
              <h3 className="text-base font-black text-slate-950 mt-1">
                Recipient Handover Verification
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Ask the recipient at destination for their secure delivery verification code.
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <KeyRound size={20} />
            </div>
          </div>

          {/* OTP Verification Form */}
          <form onSubmit={handleVerifyOtp} className="space-y-3 pt-1">
            {otpError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{otpError}</span>
              </div>
            )}
            {otpSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                <span>{otpSuccessMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Enter Handover OTP Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 542198"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-bold tracking-widest text-center text-base focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                />
                <button
                  type="submit"
                  disabled={verifyingOtp || !otpInput.trim()}
                  className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {verifyingOtp ? <RotateCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  <span>Verify OTP</span>
                </button>
              </div>
            </div>
          </form>

          {/* Payment Status & Collection Box */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Settlement Status</span>
              {isPrepaid ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold">
                  <CheckCircle2 size={12} /> Prepaid / Settled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-extrabold">
                  Pay on Delivery Due
                </span>
              )}
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-500">Amount Due for Collection</span>
              <span className="text-xl font-black text-slate-950">
                ₹{dueAmount.toLocaleString()}
              </span>
            </div>

            {!isPrepaid && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                {cashSuccessMsg ? (
                  <p className="text-xs text-emerald-700 font-bold">{cashSuccessMsg}</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={recordingCash}
                      onClick={handleRecordCashCollection}
                      className="flex-1 py-2 px-3 rounded-lg bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Banknote size={15} />
                      <span>Record Cash Collection</span>
                    </button>
                    {onOpenPaymentModal && (
                      <button
                        type="button"
                        onClick={onOpenPaymentModal}
                        className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                        title="Show UPI QR Code"
                      >
                        <QrCode size={18} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Next Action: Submit Proof of Delivery */}
          {onOpenPODModal && (
            <button
              type="button"
              onClick={onOpenPODModal}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-black active:scale-98 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <FileCheck size={18} className="text-emerald-400" />
              <span>Submit Proof of Delivery (POD)</span>
            </button>
          )}
        </div>
      )}

      {/* STAGE C: POD Submitted -> Awaiting Admin Verification */}
      {isPodSubmitted && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-xs space-y-3 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
            <Clock size={24} />
          </div>
          <h3 className="text-base font-extrabold text-slate-950">
            Proof of Delivery Submitted
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
            Your POD documentation has been received and is undergoing CargoExpress Operations verification.
          </p>
          <button
            type="button"
            onClick={() => onRefreshTrip()}
            className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800 transition cursor-pointer shadow-xs"
          >
            <RotateCw size={14} />
            <span>Check Verification Status</span>
          </button>
        </div>
      )}

      {/* STAGE D: Trip Completed */}
      {isCompleted && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 shadow-xs space-y-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-950">Delivery Completed</h3>
            <p className="text-xs text-slate-600 mt-1">
              Trip handover verified and completed successfully. Driver payable amount has been credited to your settlement balance.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      )}
      {/* Pickup OTP Verification Modal */}
      {pickupOtpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Pickup OTP Verification</h3>
                  <p className="text-[11px] text-slate-500">Ask sender for the 6-digit code</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickupOtpModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleVerifyPickupOtp} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Pickup OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pickupOtpInput}
                  onChange={(e) => setPickupOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-center tracking-[0.3em] font-black text-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              {pickupOtpError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{pickupOtpError}</span>
                </div>
              )}

              {pickupOtpSuccessMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{pickupOtpSuccessMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifyingPickupOtp || pickupOtpInput.trim().length !== 6}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {verifyingPickupOtp ? <RotateCw size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                <span>{verifyingPickupOtp ? "Verifying..." : "Verify & Start Transit"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverActiveOrderScreen;
