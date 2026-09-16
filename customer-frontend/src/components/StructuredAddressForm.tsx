import { useState, useEffect } from "react";

export interface AddressData {
  company: string;
  address: string;
  formattedString: string;
}

interface Props {
  title: string;
  onChange: (data: AddressData) => void;
}

export default function StructuredAddressForm({ title, onChange }: Props) {
  const [data, setData] = useState<AddressData>({
    company: "",
    address: "",
    formattedString: ""
  });

  // Calculate formatted string whenever fields change
  useEffect(() => {
    const parts = [
      data.company,
      data.address
    ].filter(p => p.trim() !== "");
    
    const formatted = parts.join(", ");
    
    onChange({ ...data, formattedString: formatted });
  }, [data.company, data.address]);

  const handleChange = (field: keyof AddressData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
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
          <label className="block text-xs font-medium text-[var(--text-secondary)]">Location Address</label>
          <input type="text" value={data.address} onChange={e => handleChange("address", e.target.value)} className="input-field mt-1 text-sm" placeholder="e.g. 123 Main St, City" />
        </div>
      </div>
    </div>
  );
}
