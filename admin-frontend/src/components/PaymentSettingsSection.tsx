import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "../services/api";

export default function PaymentSettingsSection() {
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api.getPaymentSettings()
      .then((settings) => {
        if (mounted) setUpiId(settings.cargox_upi_id || "");
      })
      .catch(() => {
        if (mounted) setError("Unable to load the saved CargoX UPI ID.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const settings = await api.updatePaymentSettings(upiId);
      setUpiId(settings.cargox_upi_id || "");
      setMessage(settings.cargox_upi_id ? "CargoX UPI ID saved." : "UPI payments disabled until an ID is configured.");
    } catch {
      setError("Unable to save the CargoX UPI ID.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold text-white">Payment receiving account</h2>
        <p className="mt-1 text-xs text-slate-500">This UPI ID is used to generate customer invoice QR codes.</p>
      </div>
      <button onClick={save} disabled={loading || saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">
        <Save size={15} />{saving ? "Saving..." : "Save UPI ID"}
      </button>
    </div>
    <label className="mt-4 block text-sm font-medium text-slate-300">
      CargoX UPI ID
      <input value={upiId} onChange={(event) => { setUpiId(event.target.value); setMessage(""); }} disabled={loading || saving} placeholder="name@bank" className="settings-input mt-2" />
    </label>
    {message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
  </section>;
}
