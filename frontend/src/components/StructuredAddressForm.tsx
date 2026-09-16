import React, { useState, useEffect } from "react";
import AddressAutocomplete from "./AddressAutocomplete";

export interface AddressData {
  company: string;
  landmark: string;
  mandal: string;
  district: string;
  state: string;
  lat: number | "";
  lng: number | "";
  formattedString: string;
}

interface Props {
  title: string;
  onChange: (data: AddressData) => void;
}

export default function StructuredAddressForm({ title, onChange }: Props) {
  const [data, setData] = useState<AddressData>({
    company: "",
    landmark: "",
    mandal: "",
    district: "",
    state: "",
    lat: "",
    lng: "",
    formattedString: ""
  });

  // Calculate formatted string whenever fields change
  useEffect(() => {
    const parts = [
      data.company,
      data.landmark,
      data.mandal,
      data.district,
      data.state
    ].filter(p => p.trim() !== "");
    
    let formatted = parts.join(", ");
    if (data.lat !== "" && data.lng !== "") {
      formatted += `\nGoogle Maps: https://www.google.com/maps?q=${data.lat},${data.lng}`;
    }
    
    onChange({ ...data, formattedString: formatted });
  }, [data.company, data.landmark, data.mandal, data.district, data.state, data.lat, data.lng]);

  const handleChange = (field: keyof AddressData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleAutocompleteSelect = (selectedPlace: any) => {
    // If using Nominatim, it passes back the place name. 
    // We can't perfectly parse address details into mandal/district without full API response,
    // so we'll just set it as landmark for now if we use the simple component.
    // However, if we change the AddressAutocomplete to pass the whole object, we can extract lat/lon!
  };

  return (
    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)] mb-4 shadow-sm">
      <h4 className="text-lg font-bold text-[var(--text-primary)] mb-3">{title}</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">Company Name</label>
          <input type="text" value={data.company} onChange={e => handleChange("company", e.target.value)} className="input-field mt-1 text-sm" placeholder="e.g. Acme Corp" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">Nearby Landmark</label>
          <input type="text" value={data.landmark} onChange={e => handleChange("landmark", e.target.value)} className="input-field mt-1 text-sm" placeholder="e.g. Opp. City Mall" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">Mandal</label>
          <input type="text" value={data.mandal} onChange={e => handleChange("mandal", e.target.value)} className="input-field mt-1 text-sm" placeholder="e.g. Vijayawada Urban" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">District & State</label>
          <input type="text" value={data.district} onChange={e => handleChange("district", e.target.value)} className="input-field mt-1 text-sm" placeholder="e.g. NTR District, AP" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-[var(--bg-primary)] p-3 rounded border border-[var(--border-color)]">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">Latitude</label>
          <input type="number" step="any" value={data.lat} onChange={e => handleChange("lat", e.target.value)} className="input-field mt-1 text-sm font-mono" placeholder="e.g. 16.5062" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">Longitude</label>
          <input type="number" step="any" value={data.lng} onChange={e => handleChange("lng", e.target.value)} className="input-field mt-1 text-sm font-mono" placeholder="e.g. 80.6480" />
        </div>
      </div>

      {(data.lat !== "" && data.lng !== "") && (
        <div className="mt-3">
          <a href={`https://www.google.com/maps?q=${data.lat},${data.lng}`} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            Google Maps Link
          </a>
        </div>
      )}
    </div>
  );
}
