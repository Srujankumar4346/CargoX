import React, { useState } from 'react';
import {
  Bell,
  Star,
  ChevronRight,
  TrendingUp,
  MapPin,
  Compass,
  ArrowRight,
  CheckCircle2,
  Gift,
  FileText,
  Clock,
  Sparkles,
  Award,
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import NotificationDropdown from './NotificationDropdown';

interface DriverHomeDashboardProps {
  driverName?: string;
  driverAvatar?: string;
  rating?: number;
  completedTripsCount?: number;
  isOnDuty: boolean;
  onToggleDuty: () => void;
  todayEarnings?: number;
  todayOrdersCount?: number;
  acceptanceRate?: string;
  activeTrip: any | null;
  onNavigateToTab: (tab: 'orders' | 'earnings' | 'documents' | 'more' | 'active-order') => void;
  onOpenProfileDrawer: () => void;
  gpsCoords?: { lat: number; lng: number } | null;
}

export const DriverHomeDashboard: React.FC<DriverHomeDashboardProps> = ({
  driverName = 'Assigned Driver',
  driverAvatar,
  rating = 5.0,
  completedTripsCount = 0,
  isOnDuty,
  onToggleDuty,
  todayEarnings = 0,
  todayOrdersCount = 0,
  acceptanceRate = '100%',
  activeTrip,
  onNavigateToTab,
  onOpenProfileDrawer,
  gpsCoords,
}) => {
  const mapCenter: [number, number] = gpsCoords
    ? [gpsCoords.lat, gpsCoords.lng]
    : activeTrip?.current_lat && activeTrip?.current_lng
    ? [activeTrip.current_lat, activeTrip.current_lng]
    : [17.4447, 78.3783]; // Default Hyderabad / Tech hub coordinates

  return (
    <div className="w-full max-w-md mx-auto pb-24 px-4 pt-3 flex flex-col gap-4 text-slate-900 bg-white min-h-screen">
      {/* 1. Header (Driver Avatar, Name, Rating, Notifications) */}
      <div className="flex items-center justify-between pt-1">
        <div
          onClick={onOpenProfileDrawer}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 group-hover:border-emerald-500 transition shadow-xs shrink-0">
            {driverAvatar ? (
              <img
                src={driverAvatar}
                alt={driverName}
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src="/images/driver-avatar.png"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
                alt="Driver"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-extrabold text-slate-950 tracking-tight leading-tight group-hover:text-emerald-700 transition">
              {driverName}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mt-0.5">
              <span className="font-bold text-slate-800">{rating.toFixed(1)}</span>
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <span>({completedTripsCount} trips)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationDropdown userType="DRIVER" userId={0} />
        </div>
      </div>

      {/* 2. Status Card (OFF DUTY vs ON DUTY) */}
      {isOnDuty ? (
        // ON DUTY GREEN CARD
        <div className="w-full rounded-2xl bg-[#E8F8F0] border border-emerald-200/80 p-4 flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-base font-extrabold text-slate-950">You're Online</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">You can now receive orders</p>
          </div>

          <button
            type="button"
            onClick={onToggleDuty}
            className="flex items-center gap-2 py-2 px-3.5 rounded-full bg-[#10B981] text-white font-extrabold text-xs uppercase tracking-wider shadow-sm hover:bg-emerald-600 active:scale-95 transition cursor-pointer"
          >
            <span>ON DUTY</span>
            <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            </div>
          </button>
        </div>
      ) : (
        // OFF DUTY PINK/RED CARD
        <div className="w-full rounded-2xl bg-[#FDE8E8] border border-rose-200/80 p-4 flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-base font-extrabold text-slate-950">You're Offline</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">Go on duty to receive orders</p>
          </div>

          <button
            type="button"
            onClick={onToggleDuty}
            className="flex items-center gap-2 py-2 px-3.5 rounded-full bg-slate-300 text-slate-700 font-extrabold text-xs uppercase tracking-wider shadow-sm hover:bg-slate-400 active:scale-95 transition cursor-pointer"
          >
            <span>OFF DUTY</span>
            <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            </div>
          </button>
        </div>
      )}

      {/* 3. KPI Cards: Today Earnings, Today Orders, Acceptance Rate */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 flex flex-col items-center text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400">Today Earnings</span>
          <span className="text-lg font-black text-slate-950 mt-1">
            ₹{todayEarnings.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 flex flex-col items-center text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400">Today Orders</span>
          <span className="text-lg font-black text-slate-950 mt-1">
            {todayOrdersCount}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 flex flex-col items-center text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400">Acceptance Rate</span>
          <span className="text-lg font-black text-slate-950 mt-1">
            {isOnDuty ? acceptanceRate : '--%'}
          </span>
        </div>
      </div>

      {/* 4. On Duty Live Map / Order Alert (Screen 3 Reference) */}
      {isOnDuty && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Live Map</h3>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              GPS Active
            </span>
          </div>

          <div className="relative h-48 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm z-0">
            <MapContainer
              center={mapCenter}
              zoom={13}
              scrollWheelZoom={false}
              zoomControl={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://osm.org">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CircleMarker
                center={mapCenter}
                radius={8}
                pathOptions={{
                  color: '#2563EB',
                  fillColor: '#3B82F6',
                  fillOpacity: 1,
                  weight: 3,
                }}
              />
            </MapContainer>

            {/* Recenter button overlay */}
            <div className="absolute top-2.5 right-2.5 z-[400]">
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-700 hover:text-black transition"
                onClick={() => {}}
                aria-label="Recenter"
              >
                <Compass size={16} />
              </button>
            </div>
          </div>

          {/* Active Trip Banner or Nearby Alert */}
          {activeTrip ? (
            <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  <MapPin size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-blue-900">
                    Active Trip #{activeTrip.request_number || 'ASSIGNED'}
                  </span>
                  <span className="text-[11px] text-slate-600 truncate max-w-[180px]">
                    {activeTrip.destination_address || 'In Transit'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab('active-order')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
              >
                View
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-slate-200 p-3.5 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <MapPin size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">New order nearby!</span>
                  <span className="text-[11px] text-slate-500">2.3 km away • Pickup in 5 mins</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab('orders')}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition"
              >
                View
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. Quick Actions (All Orders, Earnings, Incentives, Vehicle) */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-3">
          {/* All Orders */}
          <button
            type="button"
            onClick={() => onNavigateToTab('orders')}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-500 group-hover:scale-105 group-hover:bg-amber-100 flex items-center justify-center transition shadow-xs">
              <Clock size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-black">
              All Orders
            </span>
          </button>

          {/* Earnings */}
          <button
            type="button"
            onClick={() => onNavigateToTab('earnings')}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-500 group-hover:scale-105 group-hover:bg-amber-100 flex items-center justify-center transition shadow-xs">
              <TrendingUp size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-black">
              Earnings
            </span>
          </button>

          {/* Incentives */}
          <button
            type="button"
            onClick={() => onNavigateToTab('more')}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-500 group-hover:scale-105 group-hover:bg-emerald-100 flex items-center justify-center transition shadow-xs">
              <Gift size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-black">
              Incentives
            </span>
          </button>

          {/* Vehicle */}
          <button
            type="button"
            onClick={() => onNavigateToTab('documents')}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-500 group-hover:scale-105 group-hover:bg-blue-100 flex items-center justify-center transition shadow-xs">
              <FileText size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-black">
              Vehicle
            </span>
          </button>
        </div>
      </div>

      {/* 6. Promotional Card / Incentive Callout */}
      <div
        onClick={() => onNavigateToTab('more')}
        className="w-full rounded-2xl bg-[#EFF6FF] border border-blue-100 p-4 flex items-center justify-between cursor-pointer hover:bg-blue-100/60 transition shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              Complete more trips
            </span>
            <span className="text-[11px] text-slate-500">earn higher incentives!</span>
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-400" />
      </div>
    </div>
  );
};

export default DriverHomeDashboard;
