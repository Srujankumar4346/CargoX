import React, { useState } from 'react';
import {
  ArrowLeft,
  Headphones,
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  HelpCircle,
  Phone,
  ChevronRight,
  X,
  Send,
  CheckCircle2,
} from 'lucide-react';

interface DriverHelpSupportScreenProps {
  onBack: () => void;
}

export const DriverHelpSupportScreen: React.FC<DriverHelpSupportScreenProps> = ({ onBack }) => {
  const [modalType, setModalType] = useState<string | null>(null);
  const [issueText, setIssueText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const supportCards = [
    {
      id: 'contact',
      title: 'Contact Support',
      description: 'Get help from our team',
      icon: Headphones,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      action: () => (window.location.href = 'tel:18002660000'),
    },
    {
      id: 'report',
      title: 'Report an Issue',
      description: 'Facing a problem? Let us know',
      icon: AlertTriangle,
      iconColor: 'text-rose-500',
      bgColor: 'bg-rose-50',
      action: () => {
        setModalType('report');
        setSubmitted(false);
      },
    },
    {
      id: 'accident',
      title: 'Accident Assistance',
      description: '24×7 emergency support',
      icon: ShieldAlert,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      action: () => (window.location.href = 'tel:18002660000'),
    },
    {
      id: 'guide',
      title: 'App Guide',
      description: 'Learn how to use the app',
      icon: BookOpen,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      action: () => setModalType('guide'),
    },
    {
      id: 'faqs',
      title: 'FAQs',
      description: 'Common questions and answers',
      icon: HelpCircle,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      action: () => setModalType('faqs'),
    },
  ];

  return (
    <div className="w-full max-w-md mx-auto pb-24 px-4 pt-3 flex flex-col justify-between text-slate-900 bg-white min-h-screen">
      <div className="flex flex-col gap-4">
        {/* 1. Header (Back button, Help & Support title) */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 text-slate-800 hover:text-black transition cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft size={22} className="stroke-[2.5]" />
          </button>
          <h1 className="text-xl font-black text-slate-950 tracking-tight">Help & Support</h1>
        </div>

        {/* 2. Support Category Cards List (Screen 10 Reference) */}
        <div className="space-y-3">
          {supportCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={card.action}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between hover:border-slate-300 transition cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl ${card.bgColor} ${card.iconColor} flex items-center justify-center shrink-0 shadow-2xs`}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900 leading-tight">
                      {card.title}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">{card.description}</span>
                  </div>
                </div>

                <ChevronRight size={18} className="text-slate-400" />
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Bottom Call Support Large Button */}
      <div className="pt-6">
        <button
          type="button"
          onClick={() => (window.location.href = 'tel:18002660000')}
          className="w-full py-4 px-6 rounded-2xl bg-[#EFF6FF] hover:bg-blue-100/70 border border-blue-200 text-blue-600 font-extrabold text-sm shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Phone size={18} />
          <span>Call Support</span>
        </button>
      </div>

      {/* Modal for Report an Issue */}
      {modalType === 'report' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900">Report an Issue</h3>
              <button
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {submitted ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
                <p className="font-bold text-sm text-slate-900">Issue Submitted</p>
                <p className="text-xs text-slate-500">
                  Ticket #CX-{Math.floor(10000 + Math.random() * 90000)} generated. Operations
                  team will contact you.
                </p>
                <button
                  onClick={() => setModalType(null)}
                  className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold w-full"
                >
                  Close
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!issueText.trim()) return;
                  setSubmitted(true);
                }}
                className="space-y-4"
              >
                <textarea
                  rows={4}
                  required
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value)}
                  placeholder="Describe vehicle, customer, or route issue..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:border-blue-500 focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  <Send size={15} /> Submit Report
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal for FAQs / Guide */}
      {(modalType === 'faqs' || modalType === 'guide') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {modalType === 'faqs' ? 'Driver FAQs' : 'App Guide'}
              </h3>
              <button
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="text-xs text-slate-600 space-y-3 max-h-60 overflow-y-auto">
              <div>
                <p className="font-bold text-slate-900">How do I receive trips?</p>
                <p>Toggle your status to ON DUTY. Once online, dispatch will assign eligible linehaul orders.</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">How is delivery verified?</p>
                <p>Upon arriving at destination, enter the 6-digit receiver OTP and upload physical POD receiver name.</p>
              </div>
            </div>
            <button
              onClick={() => setModalType(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverHelpSupportScreen;
