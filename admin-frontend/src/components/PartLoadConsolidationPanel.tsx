import { useState, useMemo, useEffect } from 'react';
import {
  Layers, Truck, ArrowRight, CheckCircle, AlertCircle,
  Package, Send, RotateCw, MapPin, Search,
  Navigation, Eye, X, Sparkles, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';

interface Booking {
  id: string;
  request_number: string;
  status: string;
  goods_type: string;
  goods_description?: string | null;
  weight_tons: number;
  pickup_company_name: string;
  pickup_address: string;
  destination_company_name: string;
  destination_address: string;
  distance_km?: number | null;
  customer_booked_price?: number | null;
  booked_price?: number | null;
  final_price?: number | null;
  estimated_price?: number | null;
  quotation?: {
    customer_total_charge?: number;
    base_fare?: number;
    distance_charge?: number;
  } | null;
  load_type?: string;
  package_count?: number | null;
  created_at: string;
}

interface Vehicle {
  id: string;
  registration_number: string;
  type: string;
  capacity_tons: number | string;
  status: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
}

interface SmartGroup {
  group_id: string;
  corridor_name: string;
  request_ids: string[];
  request_numbers: string[];
  shipment_count: number;
  combined_weight_kg: number;
  suggested_vehicle: string;
  suggested_capacity_kg: number;
  utilization_pct: number;
  route_compatibility: string;
  delivery_window_status: string;
  estimated_detour_km: number;
  reasons: string[];
}

interface RouteStop {
  stop_sequence: number;
  stop_type: 'PICKUP' | 'DROP';
  request_id: string;
  request_number: string;
  company_name: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  cargo_weight_kg: number;
  goods_type: string;
}

interface RoutePreviewData {
  stops: RouteStop[];
  total_stops: number;
  total_payload_kg: number;
  vehicle_capacity_kg?: number | null;
  utilization_pct?: number | null;
  is_overloaded: boolean;
  estimated_distance_km: number;
  estimated_duration_minutes: number;
  route_order_valid: boolean;
}

interface PartLoadConsolidationPanelProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
  onDispatchSuccess: () => Promise<void>;
}

export default function PartLoadConsolidationPanel({
  bookings,
  vehicles,
  drivers,
  onDispatchSuccess,
}: PartLoadConsolidationPanelProps) {
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [commissionPercentage, setCommissionPercentage] = useState<number>(15);
  const [isDispatching, setIsDispatching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Smart suggestions state
  const [smartGroups, setSmartGroups] = useState<SmartGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState<boolean>(false);

  // Filtering and search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [corridorFilter, setCorridorFilter] = useState<string>('ALL');
  const [weightFilter, setWeightFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('PAYLOAD_DESC');

  // Route preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [routePreview, setRoutePreview] = useState<RoutePreviewData | null>(null);

  // Load Smart Groups from Backend
  const loadSmartGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const data = await api.getSmartConsolidationGroups();
      setSmartGroups(data.groups || []);
    } catch (err: any) {
      console.error('Failed to load smart consolidation groups:', err);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  useEffect(() => {
    loadSmartGroups();
  }, [bookings]);

  // Eligible Part Load requests (strictly load_type === 'PART_LOAD' or eligible unassigned LTL)
  const eligibleRequests = useMemo(() => {
    return bookings.filter((b) => {
      // Exclude terminal/dispatched statuses
      const isEligibleStatus = ['SUBMITTED', 'ACCEPTED', 'QUOTED', 'UNDER_REVIEW'].includes(b.status);
      if (!isEligibleStatus) return false;

      // Exclude full-truck explicitly
      if (b.load_type === 'FULL_TRUCK') return false;

      // Match explicit PART_LOAD or unassigned eligible LTL
      const isExplicitPartLoad = b.load_type === 'PART_LOAD';
      const isDescribedPartLoad = (b.goods_description || '').toLowerCase().includes('part load') ||
        (b.goods_description || '').toLowerCase().includes('shared') ||
        (Number(b.weight_tons || 0) <= 2.5);

      return isExplicitPartLoad || isDescribedPartLoad;
    });
  }, [bookings]);

  // Extract unique corridors / cities for filter dropdown
  const availableCorridors = useMemo(() => {
    const set = new Set<string>();
    eligibleRequests.forEach((req) => {
      const p = (req.pickup_address || '').split(',')[0].trim();
      const d = (req.destination_address || '').split(',')[0].trim();
      if (p && d) {
        set.add(`${p} → ${d}`);
      }
    });
    return Array.from(set);
  }, [eligibleRequests]);

  // Filtered & Sorted Requests
  const filteredRequests = useMemo(() => {
    let result = [...eligibleRequests];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.request_number.toLowerCase().includes(q) ||
          b.pickup_company_name?.toLowerCase().includes(q) ||
          b.destination_company_name?.toLowerCase().includes(q) ||
          b.pickup_address?.toLowerCase().includes(q) ||
          b.destination_address?.toLowerCase().includes(q) ||
          b.goods_type?.toLowerCase().includes(q)
      );
    }

    // Corridor Filter
    if (corridorFilter !== 'ALL') {
      result = result.filter((b) => {
        const p = (b.pickup_address || '').split(',')[0].trim();
        const d = (b.destination_address || '').split(',')[0].trim();
        return `${p} → ${d}` === corridorFilter;
      });
    }

    // Weight Filter
    if (weightFilter === 'LIGHT') {
      // < 500 kg (0.5 tons)
      result = result.filter((b) => Number(b.weight_tons || 0) * 1000 < 500);
    } else if (weightFilter === 'MEDIUM') {
      // 500 - 1500 kg
      result = result.filter((b) => {
        const kg = Number(b.weight_tons || 0) * 1000;
        return kg >= 500 && kg <= 1500;
      });
    } else if (weightFilter === 'HEAVY') {
      // > 1500 kg
      result = result.filter((b) => Number(b.weight_tons || 0) * 1000 > 1500);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'PAYLOAD_DESC') {
        return Number(b.weight_tons || 0) - Number(a.weight_tons || 0);
      }
      if (sortBy === 'PAYLOAD_ASC') {
        return Number(a.weight_tons || 0) - Number(b.weight_tons || 0);
      }
      if (sortBy === 'DATE_EARLIEST') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'FARE_DESC') {
        const fareA = Number(a.quotation?.customer_total_charge ?? a.final_price ?? a.customer_booked_price ?? 0);
        const fareB = Number(b.quotation?.customer_total_charge ?? b.final_price ?? b.customer_booked_price ?? 0);
        return fareB - fareA;
      }
      return 0;
    });

    return result;
  }, [eligibleRequests, searchQuery, corridorFilter, weightFilter, sortBy]);

  // Available vehicles and drivers
  const availableVehicles = useMemo(() => {
    return vehicles.filter((v) => v.status === 'AVAILABLE');
  }, [vehicles]);

  const availableDrivers = useMemo(() => {
    return drivers.filter((d) => d.status === 'AVAILABLE');
  }, [drivers]);

  // Selected bookings
  const selectedBookings = useMemo(() => {
    return bookings.filter((b) => selectedRequestIds.includes(b.id));
  }, [bookings, selectedRequestIds]);

  // Aggregate weight
  const totalWeightKg = useMemo(() => {
    return selectedBookings.reduce((sum, b) => sum + Math.round(Number(b.weight_tons || 0) * 1000), 0);
  }, [selectedBookings]);

  // Selected vehicle capacity
  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === selectedVehicleId);
  }, [vehicles, selectedVehicleId]);

  const vehicleCapacityKg = selectedVehicle ? Math.round(Number(selectedVehicle.capacity_tons || 0) * 1000) : 0;
  const remainingCapacityKg = vehicleCapacityKg - totalWeightKg;
  const utilizationPercentage = vehicleCapacityKg > 0 ? Math.min(100, Math.round((totalWeightKg / vehicleCapacityKg) * 100)) : 0;
  const isOverweight = remainingCapacityKg < 0;

  // Toggle selection
  const toggleSelectRequest = (id: string) => {
    setSelectedRequestIds((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
    );
    setErrorMessage(null);
  };

  const handleSelectAllFiltered = () => {
    if (selectedRequestIds.length === filteredRequests.length && filteredRequests.length > 0) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(filteredRequests.map((r) => r.id));
    }
  };

  const handleSelectGroup = (group: SmartGroup) => {
    setSelectedRequestIds(group.request_ids);
    setErrorMessage(null);
    setSuccessMessage(`Selected Smart Group: ${group.corridor_name} (${group.shipment_count} shipments)`);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setCorridorFilter('ALL');
    setWeightFilter('ALL');
    setSortBy('PAYLOAD_DESC');
  };

  // Trigger OSRM Route Preview
  const handleOpenRoutePreview = async () => {
    if (selectedRequestIds.length === 0) {
      setErrorMessage('Please select at least 1 Part Load shipment to preview the consolidated route.');
      return;
    }

    setPreviewLoading(true);
    setPreviewModalOpen(true);
    setErrorMessage(null);

    try {
      const data = await api.previewConsolidatedRoute({
        request_ids: selectedRequestIds,
        vehicle_id: selectedVehicleId || undefined,
      });
      setRoutePreview(data);
    } catch (err: any) {
      console.error('Failed to preview consolidated route:', err);
      setErrorMessage(err?.message || 'Failed to calculate road route');
      setPreviewModalOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Dispatch consolidated requests
  const handleConsolidateAndDispatch = async () => {
    if (selectedRequestIds.length === 0) {
      setErrorMessage('Please select at least 1 Part Load request to consolidate.');
      return;
    }
    if (!selectedVehicleId) {
      setErrorMessage('Please select an available fleet vehicle.');
      return;
    }
    if (!selectedDriverId) {
      setErrorMessage('Please select an eligible driver.');
      return;
    }
    if (isOverweight) {
      setErrorMessage(`Vehicle capacity exceeded by ${Math.abs(remainingCapacityKg)} kg. Remove shipments or pick a larger truck.`);
      return;
    }

    setIsDispatching(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await api.dispatchConsolidatedTrips({
        request_ids: selectedRequestIds,
        vehicle_id: selectedVehicleId,
        driver_id: selectedDriverId,
        commission_percentage: Number(commissionPercentage),
      });

      setSuccessMessage(
        `Consolidated Trip #${result.trip_number || 'CREATED'} dispatched successfully with ${result.request_count || selectedRequestIds.length} customer shipments!`
      );
      setSelectedRequestIds([]);
      setSelectedVehicleId('');
      setSelectedDriverId('');
      await onDispatchSuccess();
      loadSmartGroups();
    } catch (err: any) {
      let msg = err?.message || 'Failed to dispatch consolidated trip';
      try {
        const parsed = JSON.parse(msg.replace(/^Error:\s*/, ''));
        if (parsed.detail) msg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
      } catch (_) {}
      setErrorMessage(msg);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-[#172554] via-[#1e1b4b] to-[#0f172a] rounded-2xl border border-blue-500/30 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Layers size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">Smart Part Load (LTL) Consolidation</h2>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold">
                  Corridor & Route AI
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Combine compatible Less-than-Truckload orders into shared vehicle trips. Preserves individual customer bookings, quotations, independent tracking, and per-shipment OTP delivery.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadSmartGroups}
              disabled={isLoadingGroups}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
              title="Refresh smart grouping suggestions"
            >
              <RotateCw size={13} className={isLoadingGroups ? 'animate-spin' : ''} />
              <span>Refresh Groups</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Available Vehicles:</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs">
                {availableVehicles.length}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-2">Drivers:</span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 font-mono font-bold text-xs">
                {availableDrivers.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-rose-400" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle size={16} className="shrink-0 text-emerald-400" />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      {/* SECTION 1: SMART GROUP SUGGESTIONS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-400" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Smart Group Suggestions
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold">
              {smartGroups.length} suggested
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Automatically grouped by corridor alignment, geographic proximity, and payload compatibility
          </span>
        </div>

        {isLoadingGroups ? (
          <div className="p-8 text-center rounded-xl border border-slate-800 bg-[#0d162d]/40 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RotateCw size={14} className="animate-spin text-purple-400" />
            <span>Analyzing Part Load corridors and computing optimal trip consolidations...</span>
          </div>
        ) : smartGroups.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-slate-800 bg-[#0d162d]/40 text-slate-500 text-xs">
            No smart corridor clusters detected yet. When 2+ compatible shipments along shared routes arrive, automated recommendations appear here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {smartGroups.map((grp) => {
              const isSelected =
                grp.request_ids.length > 0 &&
                grp.request_ids.every((id) => selectedRequestIds.includes(id));

              return (
                <div
                  key={grp.group_id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-purple-950/40 border-purple-500 shadow-lg ring-1 ring-purple-500/50'
                      : 'bg-[#0f172a]/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-black text-white">
                        <MapPin size={14} className="text-purple-400 shrink-0" />
                        <span className="truncate">{grp.corridor_name}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0">
                        {grp.route_compatibility}
                      </span>
                    </div>

                    {/* Metric Badges */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Combined Payload</span>
                        <span className="text-white font-mono font-bold">{grp.combined_weight_kg} kg</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Shipments</span>
                        <span className="text-purple-300 font-mono font-bold">{grp.shipment_count} Orders</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Suggested Vehicle</span>
                        <span className="text-slate-200 font-semibold truncate block">{grp.suggested_vehicle}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Est. Utilization</span>
                        <span className="text-amber-300 font-mono font-bold">{grp.utilization_pct}%</span>
                      </div>
                    </div>

                    {/* Detour and Reasons */}
                    <div className="text-[11px] text-slate-400 space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <span>Avg Detour:</span>
                        <span className="font-mono text-slate-200 font-semibold">{grp.estimated_detour_km} km</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Time Windows:</span>
                        <span className="text-emerald-400 font-semibold text-[10px]">{grp.delivery_window_status}</span>
                      </div>
                    </div>

                    {grp.reasons && grp.reasons.length > 0 && (
                      <div className="text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 space-y-0.5">
                        {grp.reasons.slice(0, 2).map((r, i) => (
                          <div key={i} className="flex items-center gap-1 truncate">
                            <span className="w-1 h-1 rounded-full bg-purple-400"></span>
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handleSelectGroup(grp)}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      <CheckCircle size={14} />
                      <span>{isSelected ? 'Group Selected' : 'Review & Select Group'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: FILTERING AND SEARCH TOOLBAR */}
      <div className="bg-[#111c38]/80 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Bar */}
          <div className="relative md:col-span-1">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference, company, cargo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0d162d] border border-slate-700 text-xs text-white placeholder-slate-500 focus:border-purple-500 outline-none"
            />
          </div>

          {/* Corridor Filter */}
          <div>
            <select
              value={corridorFilter}
              onChange={(e) => setCorridorFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0d162d] border border-slate-700 text-xs text-white focus:border-purple-500 outline-none"
            >
              <option value="ALL">All Corridors & Areas</option>
              {availableCorridors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Weight Band Filter */}
          <div>
            <select
              value={weightFilter}
              onChange={(e) => setWeightFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0d162d] border border-slate-700 text-xs text-white focus:border-purple-500 outline-none"
            >
              <option value="ALL">All Weight Bands</option>
              <option value="LIGHT">Light (&lt; 500 kg)</option>
              <option value="MEDIUM">Medium (500 - 1,500 kg)</option>
              <option value="HEAVY">Heavy (&gt; 1,500 kg)</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0d162d] border border-slate-700 text-xs text-white focus:border-purple-500 outline-none"
            >
              <option value="PAYLOAD_DESC">Sort: Highest Payload</option>
              <option value="PAYLOAD_ASC">Sort: Lowest Payload</option>
              <option value="DATE_EARLIEST">Sort: Earliest Booking</option>
              <option value="FARE_DESC">Sort: Highest Value</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips & Clear */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 flex-wrap text-slate-400">
            <span>Showing <strong className="text-white font-mono">{filteredRequests.length}</strong> of {eligibleRequests.length} eligible shipments</span>
            {(searchQuery || corridorFilter !== 'ALL' || weightFilter !== 'ALL') && (
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                Filtered
              </span>
            )}
          </div>

          {(searchQuery || corridorFilter !== 'ALL' || weightFilter !== 'ALL') && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <X size={12} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Consolidation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Eligible Shipments Selection (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={18} className="text-blue-400" />
              <h3 className="text-base font-extrabold text-white">Eligible Part Load Shipments</h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold font-mono">
                {filteredRequests.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {selectedRequestIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenRoutePreview}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <Navigation size={13} />
                  <span>Preview Route ({selectedRequestIds.length})</span>
                </button>
              )}

              {filteredRequests.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 transition cursor-pointer"
                >
                  {selectedRequestIds.length === filteredRequests.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-800 bg-[#0d162d]/60">
              <Package size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-400">No matching Part Load shipments</p>
              <p className="text-xs text-slate-600 mt-1">
                Try adjusting your search query, corridor, or weight filter to reveal bookings.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredRequests.map((req) => {
                const isSelected = selectedRequestIds.includes(req.id);
                const weightKg = Math.round(Number(req.weight_tons || 0) * 1000);
                const fare = Number(
                  req.quotation?.customer_total_charge ??
                  req.final_price ??
                  req.estimated_price ??
                  req.customer_booked_price ??
                  req.booked_price ??
                  (req.distance_km ? Math.round(Number(req.distance_km) * 15 + 350) : 500)
                );

                return (
                  <div
                    key={req.id}
                    onClick={() => toggleSelectRequest(req.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      isSelected
                        ? 'bg-purple-950/30 border-purple-500 shadow-md ring-1 ring-purple-500/50'
                        : 'bg-[#0f172a]/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent onClick
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-800 border-slate-700 cursor-pointer"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-black text-white">{req.request_number}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                            {req.status}
                          </span>
                          <span className="text-xs font-extrabold text-purple-400 font-mono">
                            {weightKg} kg
                          </span>
                          {req.load_type === 'PART_LOAD' && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[9px] font-bold">
                              LTL
                            </span>
                          )}
                        </div>

                        {/* Origin -> Destination */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 truncate">
                          <span className="font-semibold text-slate-200">{req.pickup_company_name || req.pickup_address}</span>
                          <ArrowRight size={12} className="text-slate-500 shrink-0" />
                          <span className="font-semibold text-slate-200">{req.destination_company_name || req.destination_address}</span>
                        </div>

                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Cargo: {req.goods_type} • {req.goods_description || 'Standard packaged cargo'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-white font-mono block">
                        ₹{fare.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400">Customer Quote</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Fleet Allocation & Live Capacity Preview (1/3 width) */}
        <div className="space-y-4">
          <div className="bg-[#111c38] border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <Truck size={18} className="text-purple-400" />
              <h3 className="text-sm font-bold text-white">Trip Allocation & Capacity</h3>
            </div>

            {/* Vehicle Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Select Fleet Vehicle
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-[#0d162d] text-white text-xs font-semibold focus:border-purple-500 outline-none"
              >
                <option value="">-- Choose Available Vehicle --</option>
                {availableVehicles.map((veh) => {
                  const capKg = Math.round(Number(veh.capacity_tons || 0) * 1000);
                  const isCapable = totalWeightKg === 0 || capKg >= totalWeightKg;
                  return (
                    <option key={veh.id} value={veh.id} disabled={!isCapable && totalWeightKg > 0}>
                      {veh.registration_number} ({veh.type} - {capKg} kg){!isCapable ? ' [Insufficient Capacity]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Driver Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Select Assigned Driver
              </label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-[#0d162d] text-white text-xs font-semibold focus:border-purple-500 outline-none"
              >
                <option value="">-- Choose Available Driver --</option>
                {availableDrivers.map((drv) => (
                  <option key={drv.id} value={drv.id}>
                    {drv.name} ({drv.phone})
                  </option>
                ))}
              </select>
            </div>

            {/* Commission % */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  CargoX Service Fee (%)
                </label>
                <span className="text-xs font-mono font-bold text-purple-300">{commissionPercentage}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="1"
                value={commissionPercentage}
                onChange={(e) => setCommissionPercentage(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* Live Utilization Meter */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Selected Payload:</span>
                <span className="text-white font-mono font-bold">{totalWeightKg} kg</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Vehicle Capacity:</span>
                <span className="text-white font-mono font-bold">{vehicleCapacityKg} kg</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    isOverweight ? 'bg-rose-500' : utilizationPercentage > 85 ? 'bg-amber-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${Math.min(100, utilizationPercentage)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] pt-1">
                <span className="text-slate-400">Utilization: {utilizationPercentage}%</span>
                <span className={`font-mono font-bold ${isOverweight ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isOverweight ? `Overload: +${Math.abs(remainingCapacityKg)} kg` : `Remaining: ${remainingCapacityKg} kg`}
                </span>
              </div>
            </div>

            {/* Route Preview Button if items selected */}
            {selectedRequestIds.length > 0 && (
              <button
                type="button"
                onClick={handleOpenRoutePreview}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Eye size={14} />
                <span>Preview Ordered Stops & Detour</span>
              </button>
            )}

            {/* Dispatch Action Button */}
            <button
              type="button"
              disabled={
                isDispatching ||
                selectedRequestIds.length === 0 ||
                !selectedVehicleId ||
                !selectedDriverId ||
                isOverweight
              }
              onClick={handleConsolidateAndDispatch}
              className="w-full py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {isDispatching ? (
                <>
                  <RotateCw size={15} className="animate-spin" />
                  <span>Consolidating & Dispatching...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Consolidate & Dispatch ({selectedRequestIds.length} Shipments)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: CONSOLIDATED ROUTE PREVIEW MODAL */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111c38] border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Navigation size={18} className="text-purple-400" />
                <h3 className="text-sm font-bold text-white">Consolidated Road Route & Stop Sequence</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {previewLoading ? (
                <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RotateCw size={16} className="animate-spin text-purple-400" />
                  <span>Querying CargoX OSRM Routing Engine for optimal stop sequence...</span>
                </div>
              ) : routePreview ? (
                <>
                  {/* Summary Bar */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-[#0d162d] border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Total Stops</span>
                      <span className="text-sm font-mono font-bold text-white">{routePreview.total_stops}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0d162d] border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Road Distance</span>
                      <span className="text-sm font-mono font-bold text-blue-300">{routePreview.estimated_distance_km} km</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0d162d] border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Est. Drive Time</span>
                      <span className="text-sm font-mono font-bold text-amber-300">~{routePreview.estimated_duration_minutes} min</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0d162d] border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Total Weight</span>
                      <span className="text-sm font-mono font-bold text-purple-300">{routePreview.total_payload_kg} kg</span>
                    </div>
                  </div>

                  {routePreview.is_overloaded && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle size={16} className="shrink-0 text-rose-400" />
                      <span>Warning: Selected cargo exceeds assigned vehicle capacity. Dispatch will be blocked.</span>
                    </div>
                  )}

                  {/* Stop Sequence Timeline */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Proposed Sequence (Pickups First &rarr; Dropoffs)</span>
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <ShieldCheck size={12} /> Validated Order
                      </span>
                    </div>

                    <div className="space-y-2">
                      {routePreview.stops.map((stop, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-[#0d162d] border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-black text-xs ${
                                stop.stop_type === 'PICKUP'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {stop.stop_sequence}
                            </span>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{stop.company_name}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    stop.stop_type === 'PICKUP' ? 'bg-blue-900/60 text-blue-300' : 'bg-emerald-900/60 text-emerald-300'
                                  }`}
                                >
                                  {stop.stop_type}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">{stop.request_number}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-md">{stop.address}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-semibold text-purple-300">{stop.cargo_weight_kg} kg</span>
                            <span className="block text-[10px] text-slate-500">{stop.goods_type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-900/60">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
