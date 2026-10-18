import React from 'react';
import { ArrowLeft, CheckCircle2, MapPin, Truck, ShieldCheck, IndianRupee } from 'lucide-react';

interface DriverOrderDetailsScreenProps {
  order: any;
  onBack: () => void;
  onNavigateToActiveOrder?: () => void;
}

export const DriverOrderDetailsScreen: React.FC<DriverOrderDetailsScreenProps> = ({
  order,
  onBack,
  onNavigateToActiveOrder,
}) => {
  if (!order) {
    return (
      <div className="w-full max-w-md mx-auto p-6 text-center">
        <p className="text-slate-500">Order details not found.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold"
        >
          Back
        </button>
      </div>
    );
  }

  const orderNumber = order.request_number || `#TRIP-${String(order.trip_id || order.id || '2026-00456').slice(-8).toUpperCase()}`;
  const status = (order.status || 'COMPLETED').toUpperCase();
  const freightAmount = parseFloat(order.invoice_total_amount || 2200);
  const additionalCharges = 100;
  const gstAmount = parseFloat(order.tax || 140);
  const totalAmount = freightAmount + additionalCharges + gstAmount;

  const isDelivered = ['COMPLETED', 'DELIVERED', 'POD_SUBMITTED'].includes(status);
  const isInTransit = ['IN_TRANSIT', 'ARRIVED'].includes(status) || isDelivered;
  const isPickup = true; // Assigned/Picked up

  return (
    <div className="w-full max-w-md mx-auto pb-24 px-4 pt-3 flex flex-col gap-4 text-slate-900 bg-white min-h-screen">
      {/* 1. Header (Back button, Order Details title, Status Badge) */}
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
          <h1 className="text-xl font-black text-slate-950 tracking-tight">Order Details</h1>
        </div>

        <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold tracking-wide">
          {status === 'COMPLETED' ? 'Completed' : status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* 2. Delivery Progress Stepper (Pickup -> Transit -> Delivered) */}
      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 shadow-2xs">
        <div className="relative flex items-center justify-between px-6">
          {/* Connecting line */}
          <div className="absolute left-10 right-10 top-4 h-0.5 bg-emerald-500 z-0" />

          {/* Step 1: Pickup */}
          <div className="flex flex-col items-center gap-1.5 z-10">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 size={18} />
            </div>
            <span className="text-[11px] font-bold text-slate-700">Pickup</span>
          </div>

          {/* Step 2: Transit */}
          <div className="flex flex-col items-center gap-1.5 z-10">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs ${
                isInTransit ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
              }`}
            >
              <Truck size={16} />
            </div>
            <span className="text-[11px] font-bold text-slate-700">Transit</span>
          </div>

          {/* Step 3: Delivered */}
          <div className="flex flex-col items-center gap-1.5 z-10">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs ${
                isDelivered ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
              }`}
            >
              <CheckCircle2 size={18} />
            </div>
            <span className="text-[11px] font-bold text-slate-700">Delivered</span>
          </div>
        </div>
      </div>

      {/* 3. Order Reference and Route Details Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <span className="font-extrabold text-sm text-slate-900">{orderNumber}</span>
          <span className="text-xs text-slate-400 font-medium">18 Oct, 02:30 PM</span>
        </div>

        {/* Route Points */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pickup</span>
              <span className="text-sm font-semibold text-slate-900">
                {order.pickup_address || 'Qutubullapur, Hyderabad, Telangana'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Drop</span>
              <span className="text-sm font-semibold text-slate-900">
                {order.destination_address || 'Vijayawada, Andhra Pradesh'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs font-bold text-slate-600">
            <MapPin size={14} className="text-blue-600" />
            <span>{order.distance_km ? `${order.distance_km} km` : '312 km'}</span>
          </div>
        </div>
      </div>

      {/* 4. Fare & Settlement Details (Strictly authorized driver view) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5">
        <div className="flex justify-between text-xs text-slate-600">
          <span>Freight Amount</span>
          <span className="font-semibold text-slate-900">₹{freightAmount.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>Additional Charges</span>
          <span className="font-semibold text-slate-900">₹{additionalCharges.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>GST (5%)</span>
          <span className="font-semibold text-slate-900">₹{gstAmount.toLocaleString('en-IN')}</span>
        </div>

        <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
          <span className="text-sm font-extrabold text-slate-900">Total Amount</span>
          <span className="text-lg font-black text-slate-950">
            ₹{totalAmount.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* 5. Vehicle & Cargo Card */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">Vehicle & Cargo</h3>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center gap-4">
          <div className="w-20 h-16 bg-slate-50 border border-slate-100 rounded-xl p-1 flex items-center justify-center shrink-0">
            <img
              src="/images/vehicles/card_ref_intra.png"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/images/vehicles/screen2_trucks.png';
              }}
              alt="Vehicle"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900">
              {order.vehicle_registration ? `Vehicle: ${order.vehicle_registration}` : 'Tata 407 (Open Body)'}
            </span>
            <span className="text-xs text-slate-500 mt-0.5">
              {order.weight_tons ? `${order.weight_tons} Ton` : '1.5 Ton'} Payload
            </span>
            <span className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Truck size={12} /> {order.goods_type || 'General Freight'}
            </span>
          </div>
        </div>
      </div>

      {onNavigateToActiveOrder && !isDelivered && (
        <button
          type="button"
          onClick={onNavigateToActiveOrder}
          className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-md transition"
        >
          Open Active Navigation Map
        </button>
      )}
    </div>
  );
};

export default DriverOrderDetailsScreen;
