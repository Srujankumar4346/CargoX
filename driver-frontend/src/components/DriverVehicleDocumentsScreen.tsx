import React from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, FileText, Shield, FileCheck, Award, CreditCard } from 'lucide-react';

interface DriverVehicleDocumentsScreenProps {
  onBack: () => void;
  vehicleRegistration?: string;
}

export const DriverVehicleDocumentsScreen: React.FC<DriverVehicleDocumentsScreenProps> = ({
  onBack,
  vehicleRegistration = 'MH 12 QX 4901',
}) => {
  const documents = [
    {
      id: 'rc',
      title: 'Registration Certificate (RC)',
      validity: 'Valid till 12 Jan 2027',
      status: 'Valid',
      icon: FileText,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'insurance',
      title: 'Insurance',
      validity: 'Valid till 05 Mar 2027',
      status: 'Valid',
      icon: Shield,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'fitness',
      title: 'Fitness Certificate',
      validity: 'Valid till 21 Aug 2027',
      status: 'Valid',
      icon: FileCheck,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'puc',
      title: 'PUC Certificate',
      validity: 'Valid till 11 Nov 2026',
      status: 'Valid',
      icon: Award,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'dl',
      title: 'Driving License',
      validity: 'Valid till 18 Jun 2032',
      status: 'Valid',
      icon: CreditCard,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="w-full max-w-md mx-auto pb-24 px-4 pt-3 flex flex-col gap-4 text-slate-900 bg-white min-h-screen">
      {/* 1. Header (Back button, Vehicle Documents title) */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 -ml-1 text-slate-800 hover:text-black transition cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft size={22} className="stroke-[2.5]" />
        </button>
        <h1 className="text-xl font-black text-slate-950 tracking-tight">Vehicle Documents</h1>
      </div>

      {/* 2. Top Summary Banner: All documents are valid */}
      <div className="rounded-2xl bg-[#E8F8F0] border border-emerald-200/80 p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 size={18} />
          </div>
          <span className="text-sm font-extrabold text-slate-900">All documents are valid</span>
        </div>
        <ChevronRight size={18} className="text-slate-400" />
      </div>

      {/* 3. Document Cards List (Screen 9 Reference) */}
      <div className="space-y-3">
        {documents.map((doc) => {
          const Icon = doc.icon;
          return (
            <div
              key={doc.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between hover:border-slate-300 transition"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl ${doc.bgColor} ${doc.iconColor} flex items-center justify-center shrink-0 shadow-2xs`}
                >
                  <Icon size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 leading-tight">
                    {doc.title}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">{doc.validity}</span>
                </div>
              </div>

              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                {doc.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DriverVehicleDocumentsScreen;
