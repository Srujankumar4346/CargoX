import React from 'react';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  ShieldCheck,
  Truck,
  Award,
  Calendar,
  MapPin,
  Star,
  CheckCircle2,
  Clock,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { useClerk, useUser, UserButton } from '@clerk/react';
import CargoExpressLogo from './CargoExpressLogo';

interface DriverProfileScreenProps {
  onBack: () => void;
  driverName?: string;
  driverAvatar?: string;
  driverEmail?: string;
  driverPhone?: string;
  rating?: number;
  completedTripsCount?: number;
  isOnDuty: boolean;
  vehicleModel?: string;
  vehicleNumber?: string;
  licenseNumber?: string;
  onNavigateToDocuments?: () => void;
  onNavigateToEarnings?: () => void;
  onNavigateToSupport?: () => void;
}

export const DriverProfileScreen: React.FC<DriverProfileScreenProps> = ({
  onBack,
  driverName = 'Ramesh Kumar',
  driverAvatar,
  driverEmail = 'driver@cargoexpress.in',
  driverPhone = '+91 98765 43210',
  rating = 4.8,
  completedTripsCount = 120,
  isOnDuty,
  vehicleModel = 'Tata 407 (1.5 Ton)',
  vehicleNumber = 'TS 08 UB 4521',
  licenseNumber = 'DL-0420180092415',
  onNavigateToDocuments,
  onNavigateToEarnings,
  onNavigateToSupport,
}) => {
  const { signOut } = useClerk();
  const { isSignedIn } = useUser();

  const handleSignOut = async () => {
    localStorage.removeItem('access_token');
    try {
      if (signOut) await signOut();
    } catch (_) {}
    window.location.href = '/login';
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-[#F8FAFC] pb-24 text-slate-900 flex flex-col">
      {/* Header with Emerald background consistent with brand */}
      <div className="bg-[#10B981] text-white p-4 pt-4 shadow-md rounded-b-2xl">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-extrabold tracking-tight">Driver Profile</h1>
          <div className="w-10 flex items-center justify-center">
            {isSignedIn && <UserButton />}
          </div>
        </div>

        {/* Profile Info Summary */}
        <div className="flex items-center gap-4 pt-1 pb-3">
          <div className="relative w-18 h-18 rounded-full bg-white/20 p-1 shrink-0 shadow-inner">
            {driverAvatar ? (
              <img
                src={driverAvatar}
                alt={driverName}
                className="w-full h-full rounded-full object-cover bg-white"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-extrabold text-2xl">
                {driverName?.[0] || 'D'}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-700 border-2 border-white flex items-center justify-center">
              <ShieldCheck size={12} className="text-white" />
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-tight truncate text-white">
                {driverName}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-100 font-semibold mt-0.5">
              <span className="font-bold">{rating.toFixed(1)}</span>
              <Star size={12} className="fill-white text-white" />
              <span className="opacity-90">({completedTripsCount} verified trips)</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-bold text-white w-fit">
              <span className={`w-2 h-2 rounded-full ${isOnDuty ? 'bg-emerald-300 animate-pulse' : 'bg-rose-300'}`} />
              <span>{isOnDuty ? 'On Duty · Online' : 'Off Duty · Offline'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Details */}
      <div className="p-4 space-y-4 flex-1">
        {/* Admin Controlled Notice */}
        <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
          <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Authoritative Driver Profile:</span> Profile photo and credentials are authenticated and managed by CargoX Fleet Admins. To update your profile photo, contact your fleet administrator.
          </div>
        </div>

        {/* Contact & Identity Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Account & Identity
          </h3>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Mail size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400 font-medium">Registered Email</p>
              <p className="text-xs font-bold text-slate-900 truncate">{driverEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Phone size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400 font-medium">Registered Phone</p>
              <p className="text-xs font-bold text-slate-900">{driverPhone}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400 font-medium">Driving License</p>
              <p className="text-xs font-bold text-slate-900">{licenseNumber}</p>
            </div>
          </div>
        </div>

        {/* Assigned Vehicle Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Assigned Fleet Vehicle
            </h3>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Verified
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Truck size={20} className="text-slate-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-slate-900">{vehicleModel}</p>
              <p className="text-xs font-bold text-slate-500">{vehicleNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-2.5">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Fleet Type</p>
              <p className="text-xs font-extrabold text-slate-800 mt-0.5">Commercial Goods</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Max Payload</p>
              <p className="text-xs font-extrabold text-slate-800 mt-0.5">1,500 kg (1.5 T)</p>
            </div>
          </div>
        </div>

        {/* Quick Profile Shortcuts */}
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs divide-y divide-slate-100">
          {onNavigateToDocuments && (
            <button
              type="button"
              onClick={onNavigateToDocuments}
              className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer text-left"
            >
              <span className="text-xs font-bold text-slate-800">View Compliance & Vehicle Documents</span>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          )}

          {onNavigateToEarnings && (
            <button
              type="button"
              onClick={onNavigateToEarnings}
              className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer text-left"
            >
              <span className="text-xs font-bold text-slate-800">View Payout History & Statements</span>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          )}

          {onNavigateToSupport && (
            <button
              type="button"
              onClick={onNavigateToSupport}
              className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer text-left"
            >
              <span className="text-xs font-bold text-slate-800">Help & Support Center</span>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          )}
        </div>

        {/* Sign Out Action */}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full py-3 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
        >
          <LogOut size={16} />
          <span>Sign Out from CargoExpress</span>
        </button>
      </div>
    </div>
  );
};

export default DriverProfileScreen;
