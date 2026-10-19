import React from 'react';
import { X, CheckCircle2, AlertCircle, Info, Sparkles, ChevronRight } from 'lucide-react';

export interface InAppModalData {
  title: string;
  subtitle?: string;
  badge?: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
}

interface InAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: InAppModalData | null;
}

export const InAppModal: React.FC<InAppModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 select-none sm:rounded-[32px] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-fade-in sm:rounded-[32px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-[340px] bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 z-10 flex flex-col gap-4 animate-scale-in">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
        >
          <X size={16} />
        </button>

        {/* Icon & Badge */}
        <div className="flex items-center gap-3">
          {data.icon ? (
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
              {data.icon}
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles size={22} />
            </div>
          )}
          <div className="flex flex-col">
            {data.badge && (
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 w-fit mb-0.5">
                {data.badge}
              </span>
            )}
            <h3 className="text-base font-black text-slate-950 tracking-tight leading-snug">
              {data.title}
            </h3>
            {data.subtitle && (
              <span className="text-xs text-slate-400 font-medium">
                {data.subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="text-xs text-slate-600 leading-relaxed bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
          {data.content}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => {
            if (data.onAction) {
              data.onAction();
            } else {
              onClose();
            }
          }}
          className="w-full py-3 px-4 rounded-xl bg-slate-950 hover:bg-black active:scale-[0.98] text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
        >
          <span>{data.actionText || 'Understood'}</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default InAppModal;
