import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, X, Calculator, Info } from "lucide-react";
import StructuredAddressForm, { type AddressData } from "./StructuredAddressForm";
import { api } from "../services/api";

type BookingData = {
  pickup_company: string; pickup_address: string; pickup_lat: string; pickup_lng: string; pickup_contact: string; pickup_phone: string;
  drop_company: string; drop_address: string; drop_lat: string; drop_lng: string; drop_contact: string; drop_phone: string;
  cargo: string; description: string; special_instructions: string; weight: string; distance: string;
};

type Props = {
  data: BookingData;
  setData: (data: BookingData) => void;
  step: number;
  setStep: (step: number) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
  isEdit: boolean;
  submittedBooking: any;
  onBookAnother: () => void;
};

const update = (data: BookingData, patch: Partial<BookingData>) => ({ ...data, ...patch });

export default function BookingFlow({ data, setData, step, setStep, onSubmit, onClose, isEdit, submittedBooking, onBookAnother }: Props) {
  const [error, setError] = useState("");
  const [estimate, setEstimate] = useState<{ distance_km: number; customer_rate_per_km: number; estimated_total: number } | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  useEffect(() => {
    const distNum = parseFloat(data.distance);
    if (!isNaN(distNum) && distNum > 0) {
      let isMounted = true;
      setLoadingEstimate(true);
      api.getPricingEstimate(distNum)
        .then((res) => {
          if (isMounted) {
            setEstimate({
              distance_km: Number(res.distance_km),
              customer_rate_per_km: Number(res.customer_rate_per_km),
              estimated_total: Number(res.estimated_total),
            });
          }
        })
        .catch(() => {
          if (isMounted) setEstimate(null);
        })
        .finally(() => {
          if (isMounted) setLoadingEstimate(false);
        });
      return () => { isMounted = false; };
    } else {
      setEstimate(null);
    }
  }, [data.distance]);

  if (submittedBooking) {
    return (
      <section className="rounded-2xl border border-emerald-400/20 bg-slate-900 p-8 text-center shadow-xl">
        <CheckCircle2 className="mx-auto text-emerald-400" size={42} />
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Transport request submitted</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Your request was submitted successfully.</h2>
        <p className="mt-4 text-sm text-slate-400">Request number</p>
        <p className="mt-1 font-mono text-lg font-bold text-blue-300">{submittedBooking.request_number || "Pending assignment"}</p>
        <p className="mx-auto mt-4 max-w-lg text-xs text-slate-500">
          CargoX will review your request and provide the official quotation and dispatch details.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300">
            View my bookings
          </button>
          <button onClick={onBookAnother} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
            Book another
          </button>
        </div>
      </section>
    );
  }

  const set = (patch: Partial<BookingData>) => setData(update(data, patch));

  const next = () => {
    setError("");
    if (step === 1) {
      if (!data.pickup_address || !data.drop_address) {
        return setError("Add both pickup and drop addresses before continuing.");
      }
    }
    if (step === 2) {
      if (!data.cargo.trim()) {
        return setError("Cargo type is required.");
      }
      const weightNum = parseFloat(data.weight);
      if (isNaN(weightNum) || weightNum <= 0) {
        return setError("A valid cargo weight greater than 0 tons is required.");
      }
      const distNum = parseFloat(data.distance);
      if (isNaN(distNum) || distNum <= 0) {
        return setError("A valid transport distance greater than 0 km is required.");
      }
    }
    setStep(step + 1);
  };

  return (
    <section className="rounded-2xl border border-blue-500/20 bg-slate-900 p-5 shadow-xl sm:p-7">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-400">{isEdit ? "Update request" : "New request"}</p>
          <h2 className="mt-1 text-2xl font-bold text-white">{isEdit ? "Edit booking" : "Book Transport"}</h2>
          <p className="mt-1 text-sm text-slate-500">Create a new transport request in a few simple steps.</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        {["Trip Details", "Additional Information", "Review & Submit"].map((label, index) => (
          <button
            key={label}
            onClick={() => index + 1 < step && setStep(index + 1)}
            className={`border-b-2 px-2 pb-3 text-left text-xs font-bold ${
              step === index + 1
                ? "border-blue-400 text-blue-300"
                : step > index + 1
                ? "border-emerald-400 text-emerald-300"
                : "border-slate-800 text-slate-600"
            }`}
          >
            <span className="mr-1">{index + 1}.</span>{label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}

      {step === 1 && (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
                <MapPin size={15} />Pickup location
              </p>
              <StructuredAddressForm
                title="Pickup address"
                onChange={(value: AddressData) => set(update(data, { pickup_company: value.company, pickup_address: value.address }))}
              />
              <input
                value={data.pickup_contact}
                onChange={(event) => set({ pickup_contact: event.target.value })}
                placeholder="Contact person (optional)"
                className="customer-input mt-3"
              />
              <input
                value={data.pickup_phone}
                onChange={(event) => set({ pickup_phone: event.target.value })}
                placeholder="Contact phone (optional)"
                className="customer-input mt-3"
              />
            </div>
            <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-300">
                <MapPin size={15} />Drop location
              </p>
              <StructuredAddressForm
                title="Drop address"
                onChange={(value: AddressData) => set(update(data, { drop_company: value.company, drop_address: value.address }))}
              />
              <input
                value={data.drop_contact}
                onChange={(event) => set({ drop_contact: event.target.value })}
                placeholder="Contact person (optional)"
                className="customer-input mt-3"
              />
              <input
                value={data.drop_phone}
                onChange={(event) => set({ drop_phone: event.target.value })}
                placeholder="Contact phone (optional)"
                className="customer-input mt-3"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={next} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500">
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-400">
              Cargo type *
              <input
                value={data.cargo}
                onChange={(event) => set({ cargo: event.target.value })}
                className="customer-input mt-2"
                placeholder="e.g. Plastics, Machinery"
                required
              />
            </label>
            <label className="text-xs font-semibold text-slate-400">
              Cargo weight (tons) *
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={data.weight}
                onChange={(event) => set({ weight: event.target.value })}
                className="customer-input mt-2"
                placeholder="e.g. 1"
                required
              />
            </label>
            <label className="text-xs font-semibold text-slate-400">
              Distance (km) *
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={data.distance}
                onChange={(event) => set({ distance: event.target.value })}
                className="customer-input mt-2"
                placeholder="e.g. 10"
                required
              />
            </label>
          </div>

          {/* Backend Estimated Delivery Charge Section */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-blue-400" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-300">Estimated Delivery Charge</p>
                  <p className="text-[11px] text-blue-200/70">
                    {estimate
                      ? `${estimate.distance_km} km × ₹${estimate.customer_rate_per_km.toFixed(2)}/km`
                      : "Enter a valid distance to calculate the estimate."}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {loadingEstimate ? (
                  <span className="text-xs text-blue-300 animate-pulse">Calculating...</span>
                ) : estimate ? (
                  <div>
                    <span className="text-xs text-slate-400 block">Estimated total</span>
                    <strong className="text-xl font-bold text-white">
                      ₹{estimate.estimated_total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 italic">—</span>
                )}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 flex items-center gap-1 border-t border-blue-500/20 pt-2">
              <Info size={11} className="shrink-0 text-blue-400" />
              *Final price is confirmed by CargoX after request review. Estimate is informational and does not finalize the quotation.
            </p>
          </div>

          <label className="block text-xs font-semibold text-slate-400">
            Cargo description (optional)
            <textarea
              maxLength={500}
              value={data.description}
              onChange={(event) => set({ description: event.target.value })}
              className="customer-input mt-2 min-h-24"
              placeholder="Describe the cargo..."
            />
            <span className="mt-1 block text-right text-[10px] text-slate-600">{data.description.length}/500</span>
          </label>

          <label className="block text-xs font-semibold text-slate-400">
            Special instructions (optional)
            <textarea
              maxLength={500}
              value={data.special_instructions}
              onChange={(event) => set({ special_instructions: event.target.value })}
              className="customer-input mt-2 min-h-24"
              placeholder="Fragile items, loading instructions, access restrictions..."
            />
            <span className="mt-1 block text-right text-[10px] text-slate-600">{data.special_instructions.length}/500</span>
          </label>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300">
              <ArrowLeft size={16} />Back
            </button>
            <button onClick={next} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500">
              Review request <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Trip Details</p>
              <p className="text-sm text-slate-300">
                <b className="text-white">Pickup:</b> {data.pickup_company ? `${data.pickup_company} (${data.pickup_address})` : data.pickup_address || "—"}
              </p>
              <p className="text-sm text-slate-300">
                <b className="text-white">Drop:</b> {data.drop_company ? `${data.drop_company} (${data.drop_address})` : data.drop_address || "—"}
              </p>
              <p className="text-sm text-slate-300">
                <b className="text-white">Cargo:</b> {data.cargo || "—"} · {data.weight || "—"} tons
              </p>
              <p className="text-sm text-slate-300">
                <b className="text-white">Distance:</b> {data.distance || "—"} km
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Additional Information</p>
              <p className="text-sm text-slate-300">
                <b className="text-white">Description:</b> {data.description || "None"}
              </p>
              <p className="text-sm text-slate-300">
                <b className="text-white">Instructions:</b> {data.special_instructions || "None"}
              </p>
              <p className="text-sm text-slate-300">
                <b className="text-white">Contacts:</b> {data.pickup_contact || "—"} / {data.drop_contact || "—"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-300">Estimated Delivery Charge</p>
              <p className="text-xs text-blue-200/70 mt-0.5">
                {estimate ? `${estimate.distance_km} km × ₹${estimate.customer_rate_per_km.toFixed(2)}/km` : `${data.distance} km`}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Final price is confirmed by CargoX after review.</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-400 block">Estimated Charge</span>
              <strong className="text-2xl font-bold text-white">
                {estimate
                  ? `₹${estimate.estimated_total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "Pending Calculation"}
              </strong>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300">
              <ArrowLeft size={16} />Back
            </button>
            <button onClick={onSubmit} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500">
              Confirm booking request
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

