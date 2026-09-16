import { useState, useEffect, useRef } from "react";

interface AddressAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export default function AddressAutocomplete({ label, value, onChange, placeholder }: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    // Close suggestions when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }
      
      // We only fetch if the query is different from the currently selected value
      // to avoid refetching when the user selects a suggestion.
      if (query === value) return;

      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`);
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error("Failed to fetch address suggestions", error);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [query, value]);

  const handleSelect = (suggestion: any) => {
    const addressName = suggestion.display_name;
    setQuery(addressName);
    onChange(addressName);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-[var(--text-secondary)]">{label}</label>
      <input 
        type="text" 
        required 
        value={query} 
        onChange={e => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setShowSuggestions(true);
        }} 
        onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
        className="input-field mt-1" 
        placeholder={placeholder} 
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-20 w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <li 
              key={suggestion.place_id} 
              onClick={() => handleSelect(suggestion)}
              className="px-4 py-2 hover:bg-[var(--bg-secondary)] cursor-pointer text-sm text-[var(--text-primary)] border-b border-[var(--border-color)] last:border-b-0"
            >
              {suggestion.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
