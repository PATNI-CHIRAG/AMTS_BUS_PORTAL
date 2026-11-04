import React, { useState, useEffect, useMemo } from 'react';
import {
  Bus,
  PlusCircle,
  Route as RouteIcon,
  Building2,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Search,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Check,
  RotateCcw,
  ShieldCheck,
  Layers,
  MapPin,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface DepotMeta {
  id: string;
  name: string;
  code: string;
  zone: string;
  manager_name: string;
  ev_charging_bays: number;
  maintenance_bays: number;
  total_parking_capacity: number;
}

interface RouteMeta {
  id: string;
  public_code: string;
  long_name: string;
  short_name?: string;
  route_color: string;
  description?: string;
}

interface VehicleTypeMeta {
  id: string;
  name: string;
  fuel_type: string;
  has_ac: boolean;
  seated_capacity: number;
  standing_capacity: number;
}

interface StopMeta {
  id: string;
  name: string;
  name_gu: string;
  stop_code: string;
}

interface RecentVehicleItem {
  id: string;
  fleet_number: string;
  registration_number: string;
  model: string;
  fuel_type: string;
  has_ac: boolean;
  seated_capacity: number;
  depot_name: string;
  route_code: string;
  status: string;
  created_at: string;
}

interface RecentRouteItem {
  id: string;
  public_code: string;
  long_name: string;
  route_color: string;
  total_stops: number;
  created_at: string;
}

interface AdminAssetManagerProps {
  onRouteCreated?: (publicCode: string) => void;
  onBusCreated?: (fleetNumber: string) => void;
  onNavigateToFleet?: () => void;
  onNavigateToCorridors?: () => void;
}

const PRESET_COLORS = [
  { hex: 'E11D48', label: 'AMTS Crimson' },
  { hex: '2563EB', label: 'Riverfront Blue' },
  { hex: '059669', label: 'Green EV' },
  { hex: 'D97706', label: 'Heritage Amber' },
  { hex: '7C3AED', label: 'Metro Purple' },
  { hex: '0D9488', label: 'BRTS Teal' },
  { hex: 'EA580C', label: 'Express Sunset' },
  { hex: '1D3557', label: 'Civil Navy' },
];

export const AdminAssetManager: React.FC<AdminAssetManagerProps> = ({
  onRouteCreated,
  onBusCreated,
  onNavigateToFleet,
  onNavigateToCorridors,
}) => {
  const [activeTab, setActiveTab] = useState<'bus' | 'route' | 'stop' | 'catalog'>('bus');

  // Metadata from backend
  const [depots, setDepots] = useState<DepotMeta[]>([]);
  const [routes, setRoutes] = useState<RouteMeta[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeMeta[]>([]);
  const [allStops, setAllStops] = useState<StopMeta[]>([]);
  const [recentVehicles, setRecentVehicles] = useState<RecentVehicleItem[]>([]);
  const [recentRoutes, setRecentRoutes] = useState<RecentRouteItem[]>([]);
  const [loadingMeta, setLoadingMeta] = useState<boolean>(true);
  const [totalRoutesCount, setTotalRoutesCount] = useState<number>(14);
  const [totalVehiclesCount, setTotalVehiclesCount] = useState<number>(31);
  const [totalStopsCount, setTotalStopsCount] = useState<number>(536);

  // Status feedback
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Form State: Add Bus
  const [busFleetNumber, setBusFleetNumber] = useState<string>('');
  const [busRegNumber, setBusRegNumber] = useState<string>('');
  const [busFuelType, setBusFuelType] = useState<'electric' | 'cng' | 'diesel'>('electric');
  const [busHasAc, setBusHasAc] = useState<boolean>(true);
  const [busModel, setBusModel] = useState<string>('Tata Ultra Electric AC 9/9m');
  const [busSeatedCapacity, setBusSeatedCapacity] = useState<number>(34);
  const [busDepotId, setBusDepotId] = useState<string>('');
  const [busRouteCode, setBusRouteCode] = useState<string>('');
  const [busOperationalStatus, setBusOperationalStatus] = useState<'active' | 'maintenance'>('active');

  // Form State: Add Route
  const [routePublicCode, setRoutePublicCode] = useState<string>('');
  const [routeLongName, setRouteLongName] = useState<string>('');
  const [routeDescription, setRouteDescription] = useState<string>('');
  const [routeColor, setRouteColor] = useState<string>('E11D48');
  const [routeDir0Name, setRouteDir0Name] = useState<string>('');
  const [routeDir1Name, setRouteDir1Name] = useState<string>('');
  const [selectedStops, setSelectedStops] = useState<StopMeta[]>([]);
  const [stopSearchQuery, setStopSearchQuery] = useState<string>('');
  const [routeDepotId, setRouteDepotId] = useState<string>('');

  // Form State: Add Stop
  const [stopName, setStopName] = useState<string>('');
  const [stopNameGu, setStopNameGu] = useState<string>('');
  const [stopCode, setStopCode] = useState<string>('');
  const [stopDescription, setStopDescription] = useState<string>('');
  const [stopLatitude, setStopLatitude] = useState<string>('23.0225');
  const [stopLongitude, setStopLongitude] = useState<string>('72.5714');
  const [stopWheelchair, setStopWheelchair] = useState<number>(1);

  // Fetch metadata
  const fetchMeta = async () => {
    try {
      setLoadingMeta(true);
      const res = await fetch('/api/v1/admin/manage/meta/');
      const data = await res.json();
      if (data.success) {
        setDepots(data.depots || []);
        setRoutes(data.routes || []);
        setVehicleTypes(data.vehicle_types || []);
        setAllStops(data.stops || []);
        setRecentVehicles(data.recent_vehicles || []);
        setRecentRoutes(data.recent_routes || []);
        setTotalRoutesCount(data.total_routes || 14);
        setTotalVehiclesCount(data.total_vehicles || 31);
        setTotalStopsCount(data.total_stops || data.stops?.length || 536);

        if (data.depots && data.depots.length > 0 && !busDepotId) {
          setBusDepotId(data.depots[0].id);
          setRouteDepotId(data.depots[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load asset manager metadata:', err);
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  // Filtered stops for route stop selector
  const filteredStops = useMemo(() => {
    const q = stopSearchQuery.trim().toLowerCase();
    if (!q) return allStops.slice(0, 15);
    return allStops
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.name_gu.includes(q) ||
          s.stop_code.toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [allStops, stopSearchQuery]);

  // Handle auto-suggest direction names when stops change
  useEffect(() => {
    if (selectedStops.length >= 2) {
      const origin = selectedStops[0].name;
      const dest = selectedStops[selectedStops.length - 1].name;
      if (!routeDir0Name || routeDir0Name.includes('to')) {
        setRouteDir0Name(`${origin} to ${dest}`);
      }
      if (!routeDir1Name || routeDir1Name.includes('to')) {
        setRouteDir1Name(`${dest} to ${origin}`);
      }
      if (!routeLongName) {
        setRouteLongName(`${origin} to ${dest}`);
      }
    }
  }, [selectedStops]);

  // Add stop to route sequence
  const handleAddStopToSequence = (stop: StopMeta) => {
    setSelectedStops((prev) => [...prev, stop]);
  };

  // Remove stop from sequence
  const handleRemoveStopFromSequence = (index: number) => {
    setSelectedStops((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Move stop up in sequence
  const handleMoveStopUp = (index: number) => {
    if (index === 0) return;
    setSelectedStops((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Move stop down in sequence
  const handleMoveStopDown = (index: number) => {
    if (index >= selectedStops.length - 1) return;
    setSelectedStops((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Quick preset template for route stops
  const handleLoadPopularTemplate = () => {
    const templateNames = [
      'Paldi',
      'Ellisbridge',
      'Lal Darwaja',
      'Kalupur Terminus',
      'Civil Hospital',
      'Meghaninagar',
    ];
    const matched: StopMeta[] = [];
    for (const name of templateNames) {
      const s = allStops.find((st) => st.name.toLowerCase().includes(name.toLowerCase()));
      if (s && !matched.some((m) => m.id === s.id)) {
        matched.push(s);
      }
    }
    if (matched.length >= 2) {
      setSelectedStops(matched);
      setRoutePublicCode('204');
      setRouteLongName(`${matched[0].name} to ${matched[matched.length - 1].name} Express`);
      setRouteDescription('Arterial connectivity corridor via Heritage Riverfront');
    }
  };

  // Submit Add Bus
  const handleCreateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSuccessBanner(null);

    const fleet = busFleetNumber.trim().toUpperCase();
    const reg = busRegNumber.trim().toUpperCase();

    if (!fleet) {
      setErrorBanner('Please enter a Fleet Number (e.g., 104-X or 204-A).');
      return;
    }
    if (!reg) {
      setErrorBanner('Please enter an official Gujarat RTO Registration Plate (e.g., GJ-01-CZ-2041).');
      return;
    }

    try {
      setSubmitLoading(true);
      const res = await fetch('/api/v1/admin/fleet/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fleet_number: fleet,
          registration_number: reg,
          fuel_type: busFuelType,
          has_ac: busHasAc,
          bus_model: busModel,
          seated_capacity: Number(busSeatedCapacity),
          depot_id: busDepotId || undefined,
          route_code: busRouteCode || undefined,
          operational_status: busOperationalStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register bus. Please try again.');
      }

      setSuccessBanner(data.message || `Bus ${fleet} registered successfully!`);
      // Reset form
      setBusFleetNumber('');
      setBusRegNumber('');
      fetchMeta();
      if (onBusCreated) onBusCreated(fleet);
    } catch (err: any) {
      setErrorBanner(err.message || 'Error creating bus.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Submit Add Route
  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSuccessBanner(null);

    const code = routePublicCode.trim().toUpperCase();
    const name = routeLongName.trim();

    if (!code) {
      setErrorBanner('Please provide a Route Public Code (e.g., 204 or 104).');
      return;
    }
    if (!name) {
      setErrorBanner('Please enter a Route Corridor Name.');
      return;
    }
    if (selectedStops.length < 2) {
      setErrorBanner('A route corridor must have at least 2 stands (Origin and Destination).');
      return;
    }

    try {
      setSubmitLoading(true);
      const res = await fetch('/api/v1/admin/routes/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_code: code,
          long_name: name,
          description: routeDescription.trim(),
          route_color: routeColor.replace('#', '').toUpperCase(),
          direction_0_name: routeDir0Name.trim(),
          direction_1_name: routeDir1Name.trim(),
          stop_ids: selectedStops.map((s) => s.id),
          depot_id: routeDepotId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create route. Please try again.');
      }

      setSuccessBanner(data.message || `Route ${code} created successfully!`);
      // Reset form
      setRoutePublicCode('');
      setRouteLongName('');
      setRouteDescription('');
      setSelectedStops([]);
      fetchMeta();
      if (onRouteCreated) onRouteCreated(code);
    } catch (err: any) {
      setErrorBanner(err.message || 'Error creating route corridor.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Submit Handler: Add Stop
  const handleCreateStop = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSuccessBanner(null);

    const name = stopName.trim();
    if (!name) {
      setErrorBanner('Stop name (English) is required.');
      return;
    }

    const lat = parseFloat(stopLatitude);
    const lng = parseFloat(stopLongitude);
    if (isNaN(lat) || isNaN(lng)) {
      setErrorBanner('Valid numerical Latitude and Longitude are required.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch('/api/v1/admin/stops/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          name_gu: stopNameGu.trim(),
          stop_code: stopCode.trim().toUpperCase(),
          description: stopDescription.trim(),
          latitude: lat,
          longitude: lng,
          wheelchair_boarding: stopWheelchair,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create stop. Please try again.');
      }

      setSuccessBanner(data.message || `Stop "${name}" successfully registered in AMTS network!`);
      setStopName('');
      setStopNameGu('');
      setStopCode('');
      setStopDescription('');
      setStopLatitude('23.0225');
      setStopLongitude('72.5714');
      fetchMeta();
    } catch (err: any) {
      setErrorBanner(err.message || 'Error registering bus stand.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="admin-page-flow asset-manager-root">
      {/* =====================================================================
          HEADER HERO BANNER
          ===================================================================== */}
      <div className="admin-view-header asset-manager-header">
        <div className="view-title-group">
          <div className="view-badge">
            <ShieldCheck size={14} className="text-emerald" />
            <span>AMTS TRANSIT NETWORK OPERATIONS</span>
          </div>
          <h2 className="view-heading">Fleet & Route Management</h2>
          <p className="view-description">
            Register new buses into the fleet, create bidirectional route corridors, and add official bus stands across the AMTS network.
          </p>
        </div>

        <div className="view-kpi-summary-group">
          <div className="view-kpi-chip">
            <span className="kpi-chip-label">Active Corridors</span>
            <span className="kpi-chip-val font-extrabold text-blue">{totalRoutesCount}</span>
          </div>
          <div className="view-kpi-chip">
            <span className="kpi-chip-label">Total Fleet Buses</span>
            <span className="kpi-chip-val font-extrabold text-emerald">{totalVehiclesCount}</span>
          </div>
          <div className="view-kpi-chip">
            <span className="kpi-chip-label">AMTS Stands / Stops</span>
            <span className="kpi-chip-val font-extrabold text-purple" style={{ color: '#7C3AED' }}>{totalStopsCount}</span>
          </div>
          <div className="view-kpi-chip">
            <span className="kpi-chip-label">Operational Depots</span>
            <span className="kpi-chip-val font-extrabold text-slate">{depots.length || 4}</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          ALERT FEEDBACK BANNER
          ===================================================================== */}
      {successBanner && (
        <div
          className="admin-alert-banner success"
          style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            padding: '14px 18px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={20} className="text-emerald" />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#047857',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {errorBanner && (
        <div
          className="admin-alert-banner error"
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            padding: '14px 18px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} className="text-red" />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#B91C1C',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* =====================================================================
          TOP NAVIGATION TABS
          ===================================================================== */}
      <div className="asset-tabs-bar" style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'bus' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('bus');
            setErrorBanner(null);
            setSuccessBanner(null);
          }}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: activeTab === 'bus' ? '2px solid #2563EB' : '1px solid #E2E8F0',
            background: activeTab === 'bus' ? '#EFF6FF' : '#FFFFFF',
            color: activeTab === 'bus' ? '#1D4ED8' : '#475569',
            fontWeight: 800,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
          }}
        >
          <Bus size={16} />
          <span>Register New Bus (Fleet Vehicle)</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'route' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('route');
            setErrorBanner(null);
            setSuccessBanner(null);
          }}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: activeTab === 'route' ? '2px solid #E11D48' : '1px solid #E2E8F0',
            background: activeTab === 'route' ? '#FFF1F2' : '#FFFFFF',
            color: activeTab === 'route' ? '#BE123C' : '#475569',
            fontWeight: 800,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
          }}
        >
          <RouteIcon size={16} />
          <span>Create New Route Corridor</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'stop' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('stop');
            setErrorBanner(null);
            setSuccessBanner(null);
          }}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: activeTab === 'stop' ? '2px solid #7C3AED' : '1px solid #E2E8F0',
            background: activeTab === 'stop' ? '#F5F3FF' : '#FFFFFF',
            color: activeTab === 'stop' ? '#6D28D9' : '#475569',
            fontWeight: 800,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
          }}
        >
          <MapPin size={16} />
          <span>Add New Stand / Station</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('catalog');
            setErrorBanner(null);
            setSuccessBanner(null);
          }}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: activeTab === 'catalog' ? '2px solid #059669' : '1px solid #E2E8F0',
            background: activeTab === 'catalog' ? '#ECFDF5' : '#FFFFFF',
            color: activeTab === 'catalog' ? '#047857' : '#475569',
            fontWeight: 800,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
          }}
        >
          <Layers size={16} />
          <span>Fleet & Corridor Catalog ({recentVehicles.length + recentRoutes.length})</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: REGISTER NEW BUS (FLEET VEHICLE)
          ===================================================================== */}
      {activeTab === 'bus' && (
        <div className="asset-form-card" style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Induct New Bus to AMTS Fleet
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '4px 0 0 0' }}>
                Assign fleet identifier, RTO registration plate, fuel technology, air-conditioning, and depot allocation.
              </p>
            </div>
            {onNavigateToFleet && (
              <button
                type="button"
                className="admin-btn-action secondary-btn"
                onClick={onNavigateToFleet}
                style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              >
                <span>View Fleet Dispatch Matrix</span>
                <ExternalLink size={13} />
              </button>
            )}
          </div>

          <form onSubmit={handleCreateBus}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              {/* Fleet Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Fleet Number <span style={{ color: '#E11D48' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 104-A or 204-X"
                  value={busFleetNumber}
                  onChange={(e) => setBusFleetNumber(e.target.value.toUpperCase())}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '4px' }}>
                  Format: [Route Number]-[Letter Suffix] (e.g., 103-X, 50-Y)
                </span>
              </div>

              {/* Registration Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Gujarat RTO Registration Plate <span style={{ color: '#E11D48' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. GJ-01-CZ-2041"
                  value={busRegNumber}
                  onChange={(e) => setBusRegNumber(e.target.value.toUpperCase())}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '4px' }}>
                  Official registration plate issued by Ahmedabad RTO
                </span>
              </div>

              {/* Assigned Depot */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Assigned Maintenance Depot <span style={{ color: '#E11D48' }}>*</span>
                </label>
                <select
                  value={busDepotId}
                  onChange={(e) => setBusDepotId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    background: '#FFFFFF',
                    boxSizing: 'border-box',
                  }}
                >
                  {depots.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code}) - {d.zone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned Route Corridor */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Assigned Route Corridor (Optional)
                </label>
                <select
                  value={busRouteCode}
                  onChange={(e) => setBusRouteCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    background: '#FFFFFF',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">-- Unassigned (Depot Standby / Workshop Reserve) --</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.public_code}>
                      Route {r.public_code} — {r.long_name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '4px' }}>
                  Assigning a route will immediately deploy this bus on-road in live telemetry
                </span>
              </div>
            </div>

            {/* Fuel & Technology Selection */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Propulsion & Clean Technology
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {/* Electric */}
                <div
                  onClick={() => setBusFuelType('electric')}
                  style={{
                    border: busFuelType === 'electric' ? '2px solid #059669' : '1px solid #E2E8F0',
                    background: busFuelType === 'electric' ? '#ECFDF5' : '#FAFAFA',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
                    <Zap size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#065F46' }}>Clean Electric (EV)</div>
                    <div style={{ fontSize: '0.68rem', color: '#047857' }}>Zero Emission • 255 kWh Battery</div>
                  </div>
                </div>

                {/* CNG */}
                <div
                  onClick={() => setBusFuelType('cng')}
                  style={{
                    border: busFuelType === 'cng' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                    background: busFuelType === 'cng' ? '#EFF6FF' : '#FAFAFA',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
                    <Bus size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E40AF' }}>CNG Clean Fuel</div>
                    <div style={{ fontSize: '0.68rem', color: '#1D4ED8' }}>Eco Gas • Low Particulate</div>
                  </div>
                </div>

                {/* Diesel */}
                <div
                  onClick={() => setBusFuelType('diesel')}
                  style={{
                    border: busFuelType === 'diesel' ? '2px solid #D97706' : '1px solid #E2E8F0',
                    background: busFuelType === 'diesel' ? '#FFFBEB' : '#FAFAFA',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
                    <Building2 size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400E' }}>Euro-VI Diesel</div>
                    <div style={{ fontSize: '0.68rem', color: '#B45309' }}>Heavy Duty Commercial</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Climate & Seating Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              {/* AC / Non-AC */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Climate Control (Air Conditioning)
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setBusHasAc(true)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: busHasAc ? '2px solid #2563EB' : '1px solid #CBD5E1',
                      background: busHasAc ? '#EFF6FF' : '#FFFFFF',
                      color: busHasAc ? '#1E40AF' : '#475569',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    ❄️ AC Bus
                  </button>
                  <button
                    type="button"
                    onClick={() => setBusHasAc(false)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: !busHasAc ? '2px solid #64748B' : '1px solid #CBD5E1',
                      background: !busHasAc ? '#F1F5F9' : '#FFFFFF',
                      color: !busHasAc ? '#0F172A' : '#475569',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    Non-AC Standard
                  </button>
                </div>
              </div>

              {/* Seating Capacity */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Seating Capacity (Pax)
                </label>
                <select
                  value={busSeatedCapacity}
                  onChange={(e) => setBusSeatedCapacity(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    background: '#FFFFFF',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value={30}>30 Seater (Mini Urban EV)</option>
                  <option value={34}>34 Seater (Standard AMTS)</option>
                  <option value={40}>40 Seater (Large Capacity)</option>
                  <option value={44}>44 Seater (BRTS Feeder)</option>
                </select>
              </div>

              {/* Operational Status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Initial Operational State
                </label>
                <select
                  value={busOperationalStatus}
                  onChange={(e) => setBusOperationalStatus(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    background: '#FFFFFF',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="active">● Active (On-Road Commercial Dispatch)</option>
                  <option value="maintenance">■ Standby / In Depot (Workshop)</option>
                </select>
              </div>
            </div>

            {/* Live Preview Card */}
            <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '14px 18px', marginBottom: '24px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '8px' }}>
                Live Fleet Badge Preview
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, padding: '3px 8px', borderRadius: '5px', fontSize: '0.75rem' }}>
                  {busFleetNumber || 'FLEET-NO'}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                  {busRegNumber || 'GJ-01-XX-0000'}
                </span>
                <span style={{
                  background: busFuelType === 'electric' ? '#ECFDF5' : '#EFF6FF',
                  color: busFuelType === 'electric' ? '#065F46' : '#1E40AF',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                }}>
                  {busFuelType.toUpperCase()} {busHasAc ? '• AC' : '• Non-AC'} ({busSeatedCapacity} Pax)
                </span>
                <span style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', color: '#334155', fontWeight: 700 }}>
                  🏛️ {depots.find((d) => d.id === busDepotId)?.name || 'Depot'}
                </span>
                <span style={{
                  background: busOperationalStatus === 'active' ? '#ECFDF5' : '#F1F5F9',
                  color: busOperationalStatus === 'active' ? '#047857' : '#475569',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}>
                  {busOperationalStatus === 'active' ? '● Active On-Road' : '■ Depot Standby'}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={submitLoading}
                className="admin-btn-action primary-btn"
                style={{
                  background: '#2563EB',
                  color: '#FFFFFF',
                  padding: '10px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: submitLoading ? 'wait' : 'pointer',
                }}
              >
                <PlusCircle size={16} />
                <span>{submitLoading ? 'Registering Bus...' : 'Register Bus to AMTS Fleet'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setBusFleetNumber('');
                  setBusRegNumber('');
                  setErrorBanner(null);
                  setSuccessBanner(null);
                }}
                className="admin-btn-action secondary-btn"
                style={{ fontSize: '0.8rem', padding: '9px 16px' }}
              >
                <span>Reset Form</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          TAB 2: CREATE NEW ROUTE CORRIDOR
          ===================================================================== */}
      {activeTab === 'route' && (
        <div className="asset-form-card" style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Design New AMTS Route Corridor
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '4px 0 0 0' }}>
                Define public route code, corridor color branding, and pick sequential stands to generate bidirectional GIS polylines.
              </p>
            </div>
            {onNavigateToCorridors && (
              <button
                type="button"
                className="admin-btn-action secondary-btn"
                onClick={onNavigateToCorridors}
                style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              >
                <span>View Corridors Rankings</span>
                <ExternalLink size={13} />
              </button>
            )}
          </div>

          <form onSubmit={handleCreateRoute}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '22px' }}>
              {/* Route Code */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Route Public Code <span style={{ color: '#E11D48' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span
                    style={{
                      background: `#${routeColor}`,
                      color: '#FFFFFF',
                      fontWeight: 800,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      minWidth: '50px',
                      textAlign: 'center',
                    }}
                  >
                    {routePublicCode || '###'}
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. 204 or 104"
                    value={routePublicCode}
                    onChange={(e) => setRoutePublicCode(e.target.value.toUpperCase())}
                    required
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '4px' }}>
                  Corridor public route number displayed on bus electronic headsigns
                </span>
              </div>

              {/* Corridor Long Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Corridor Long Name <span style={{ color: '#E11D48' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paldi to ISKCON Cross Roads via Satellite"
                  value={routeLongName}
                  onChange={(e) => setRouteLongName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '4px' }}>
                  Official corridor terminus description
                </span>
              </div>

              {/* Primary Depot */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Allocated Primary Depot
                </label>
                <select
                  value={routeDepotId}
                  onChange={(e) => setRouteDepotId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    background: '#FFFFFF',
                    boxSizing: 'border-box',
                  }}
                >
                  {depots.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Route Color Branding */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Corridor Color Branding
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setRouteColor(c.hex)}
                    title={c.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: routeColor === c.hex ? '2px solid #0F172A' : '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: `#${c.hex}`,
                        display: 'inline-block',
                      }}
                    ></span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>{c.label}</span>
                    {routeColor === c.hex && <Check size={12} className="text-slate" />}
                  </button>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Custom: #</span>
                  <input
                    type="text"
                    maxLength={6}
                    value={routeColor}
                    onChange={(e) => setRouteColor(e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase())}
                    style={{
                      width: '70px',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bidirectional Headsigns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Outbound Direction 0 (UP Headsign)
                </label>
                <input
                  type="text"
                  placeholder="e.g. To ISKCON Cross Roads"
                  value={routeDir0Name}
                  onChange={(e) => setRouteDir0Name(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Return Direction 1 (DOWN Headsign)
                </label>
                <input
                  type="text"
                  placeholder="e.g. To Paldi"
                  value={routeDir1Name}
                  onChange={(e) => setRouteDir1Name(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* =================================================================
                INTERACTIVE STOP SEQUENCE BUILDER
                ================================================================= */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px', marginBottom: '24px', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={16} className="text-red" />
                    <span>Corridor Stands Sequence Builder ({selectedStops.length} Stands Selected)</span>
                  </h4>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                    First stand is the Origin; last stand is the Destination. Inbound return direction will be auto-inverted.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLoadPopularTemplate}
                  className="admin-btn-action secondary-btn"
                  style={{ fontSize: '0.72rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Sparkles size={13} className="text-amber" />
                  <span>Load Sample Major Stands Template</span>
                </button>
              </div>

              {/* Stop Search & Selection Bar */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search from 536 AMTS stops (English or Gujarati)..."
                    value={stopSearchQuery}
                    onChange={(e) => setStopSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.8rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Filtered Stop Chips to Add */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  CLICK TO ADD STAND TO SEQUENCE:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '110px', overflowY: 'auto' }}>
                  {filteredStops.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleAddStopToSequence(s)}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#1E293B',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title={`Add ${s.name} (${s.name_gu}) to route`}
                    >
                      <span>+ {s.name}</span>
                      {s.name_gu && <span style={{ color: '#64748B', fontSize: '0.65rem' }}>({s.name_gu})</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Selected Sequence */}
              {selectedStops.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 16px', background: '#FFFFFF', borderRadius: '8px', border: '1px dashed #CBD5E1', color: '#64748B', fontSize: '0.78rem' }}>
                  No stands selected yet. Click any stand above or click "Load Sample Major Stands Template" to start.
                </div>
              ) : (
                <div style={{ background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedStops.map((s, idx) => {
                      const isOrigin = idx === 0;
                      const isDest = idx === selectedStops.length - 1;
                      return (
                        <div
                          key={`${s.id}-${idx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 12px',
                            background: isOrigin ? '#EFF6FF' : isDest ? '#FEF2F2' : '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: isOrigin ? '#2563EB' : isDest ? '#DC2626' : '#64748B',
                                color: '#FFFFFF',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span style={{ fontWeight: 700, color: '#0F172A' }}>{s.name}</span>
                            {s.name_gu && <span style={{ color: '#64748B', fontSize: '0.7rem' }}>({s.name_gu})</span>}
                            {isOrigin && (
                              <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>
                                🏁 ORIGIN
                              </span>
                            )}
                            {isDest && (
                              <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>
                                🎯 DESTINATION
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleMoveStopUp(idx)}
                              disabled={idx === 0}
                              style={{
                                background: '#FFFFFF',
                                border: '1px solid #CBD5E1',
                                borderRadius: '4px',
                                padding: '2px 5px',
                                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                opacity: idx === 0 ? 0.3 : 1,
                              }}
                              title="Move Up"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStopDown(idx)}
                              disabled={idx === selectedStops.length - 1}
                              style={{
                                background: '#FFFFFF',
                                border: '1px solid #CBD5E1',
                                borderRadius: '4px',
                                padding: '2px 5px',
                                cursor: idx === selectedStops.length - 1 ? 'not-allowed' : 'pointer',
                                opacity: idx === selectedStops.length - 1 ? 0.3 : 1,
                              }}
                              title="Move Down"
                            >
                              <ChevronDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStopFromSequence(idx)}
                              style={{
                                background: '#FEE2E2',
                                border: '1px solid #FECACA',
                                color: '#B91C1C',
                                borderRadius: '4px',
                                padding: '2px 5px',
                                cursor: 'pointer',
                              }}
                              title="Remove Stand"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={submitLoading}
                className="admin-btn-action primary-btn"
                style={{
                  background: '#E11D48',
                  color: '#FFFFFF',
                  padding: '10px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: submitLoading ? 'wait' : 'pointer',
                }}
              >
                <RouteIcon size={16} />
                <span>{submitLoading ? 'Creating Route Corridor...' : 'Create & Publish Route Corridor'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedStops([]);
                  setRoutePublicCode('');
                  setRouteLongName('');
                  setErrorBanner(null);
                  setSuccessBanner(null);
                }}
                className="admin-btn-action secondary-btn"
                style={{ fontSize: '0.8rem', padding: '9px 16px' }}
              >
                <span>Clear Builder</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          TAB 3: ADD NEW STAND / STATION (STOP)
          ===================================================================== */}
      {activeTab === 'stop' && (
        <div className="asset-form-card" style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} style={{ color: '#7C3AED' }} />
                <span>Register New AMTS Bus Stand / Terminal Station</span>
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '4px 0 0 0' }}>
                Add official transit stand with English & Gujarati names, unique stop code, exact GPS latitude/longitude, and barrier-free wheelchair accessibility.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateStop}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              {/* Stand Name (English) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Stand / Stop Name (English) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gift City Terminal, Iskcon Cross Road"
                  value={stopName}
                  onChange={(e) => setStopName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Stand Name (Gujarati) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Stand Name (ગુજરાતી નામ)
                </label>
                <input
                  type="text"
                  placeholder="દા.ત. ગિફ્ટ સિટી ટર્મિનલ, ઇસ્કોન ચાર રસ્તા"
                  value={stopNameGu}
                  onChange={(e) => setStopNameGu(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Stop Code */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Unique Stop Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. GIFT-01, ISK-02 (optional)"
                  value={stopCode}
                  onChange={(e) => setStopCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                    textTransform: 'uppercase',
                  }}
                />
              </div>

              {/* Landmark / Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Landmark / Corridor Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near BRTS Interchange, Grand Mercure"
                  value={stopDescription}
                  onChange={(e) => setStopDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Latitude */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  GPS Latitude (22.0 – 24.0) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.00001"
                  placeholder="e.g. 23.0225"
                  value={stopLatitude}
                  onChange={(e) => setStopLatitude(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Longitude */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  GPS Longitude (71.5 – 73.5) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.00001"
                  placeholder="e.g. 72.5714"
                  value={stopLongitude}
                  onChange={(e) => setStopLongitude(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Quick Coordinate Presets */}
            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, marginRight: '8px' }}>
                Quick Presets:
              </span>
              <button
                type="button"
                onClick={() => { setStopLatitude('23.0242'); setStopLongitude('72.5802'); }}
                style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F8FAFC', cursor: 'pointer', marginRight: '6px' }}
              >
                Lal Darwaja (23.0242, 72.5802)
              </button>
              <button
                type="button"
                onClick={() => { setStopLatitude('23.0298'); setStopLongitude('72.6012'); }}
                style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F8FAFC', cursor: 'pointer', marginRight: '6px' }}
              >
                Kalupur Railway Stn (23.0298, 72.6012)
              </button>
              <button
                type="button"
                onClick={() => { setStopLatitude('23.0585'); setStopLongitude('72.5714'); }}
                style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F8FAFC', cursor: 'pointer', marginRight: '6px' }}
              >
                Vadaj Terminal (23.0585, 72.5714)
              </button>
              <button
                type="button"
                onClick={() => { setStopLatitude('23.1601'); setStopLongitude('72.6845'); }}
                style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F8FAFC', cursor: 'pointer' }}
              >
                GIFT City (23.1601, 72.6845)
              </button>
            </div>

            {/* Accessibility & Wheelchair Boarding */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Barrier-Free Accessibility (Divyangjan / Wheelchair Friendly)
              </label>
              <div style={{ display: 'flex', gap: '12px', maxWidth: '420px' }}>
                <button
                  type="button"
                  onClick={() => setStopWheelchair(1)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: stopWheelchair === 1 ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                    background: stopWheelchair === 1 ? '#F5F3FF' : '#FFFFFF',
                    color: stopWheelchair === 1 ? '#6D28D9' : '#475569',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  ♿ Wheelchair Accessible
                </button>
                <button
                  type="button"
                  onClick={() => setStopWheelchair(0)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: stopWheelchair === 0 ? '2px solid #64748B' : '1px solid #CBD5E1',
                    background: stopWheelchair === 0 ? '#F1F5F9' : '#FFFFFF',
                    color: stopWheelchair === 0 ? '#0F172A' : '#475569',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  Standard Kerbside Stand
                </button>
              </div>
            </div>

            {/* Live Stand Badge Preview */}
            <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '14px 18px', marginBottom: '24px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '8px' }}>
                Live Stand Preview
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ background: '#7C3AED', color: '#FFFFFF', fontWeight: 800, padding: '3px 8px', borderRadius: '5px', fontSize: '0.75rem' }}>
                  {stopCode || 'STAND-CODE'}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A' }}>
                  {stopName || 'Stand Name'}
                </span>
                {stopNameGu && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>
                    ({stopNameGu})
                  </span>
                )}
                <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                  GPS: {stopLatitude}, {stopLongitude}
                </span>
                <span style={{
                  background: stopWheelchair === 1 ? '#ECFDF5' : '#F1F5F9',
                  color: stopWheelchair === 1 ? '#047857' : '#64748B',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}>
                  {stopWheelchair === 1 ? '♿ Accessible' : 'Standard'}
                </span>
              </div>
            </div>

            {/* Submit & Reset Buttons */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={submitLoading}
                className="admin-btn-action primary-btn"
                style={{
                  background: '#7C3AED',
                  borderColor: '#6D28D9',
                  color: '#FFFFFF',
                  padding: '10px 22px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: submitLoading ? 'wait' : 'pointer',
                }}
              >
                <PlusCircle size={16} />
                <span>{submitLoading ? 'Registering Stand...' : 'Register Stand in AMTS Network'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStopName('');
                  setStopNameGu('');
                  setStopCode('');
                  setStopDescription('');
                  setStopLatitude('23.0225');
                  setStopLongitude('72.5714');
                  setErrorBanner(null);
                  setSuccessBanner(null);
                }}
                className="admin-btn-action secondary-btn"
                style={{ fontSize: '0.8rem', padding: '9px 16px' }}
              >
                <span>Reset Form</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          TAB 4: FLEET & CORRIDOR CATALOG
          ===================================================================== */}
      {activeTab === 'catalog' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
          {/* Recently Added Buses */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bus size={18} className="text-blue" />
                <span>Recent Fleet Buses ({recentVehicles.length})</span>
              </h3>
              {onNavigateToFleet && (
                <button
                  type="button"
                  onClick={onNavigateToFleet}
                  style={{ background: 'none', border: 'none', color: '#2563EB', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  View All {totalVehiclesCount} Buses ➔
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentVehicles.map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #F1F5F9',
                    background: '#F8FAFC',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                        {v.fleet_number}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1E293B' }}>{v.registration_number}</span>
                      <span style={{
                        background: v.fuel_type === 'electric' ? '#ECFDF5' : '#EFF6FF',
                        color: v.fuel_type === 'electric' ? '#065F46' : '#1E40AF',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                      }}>
                        {v.fuel_type.toUpperCase()} {v.has_ac ? 'AC' : 'STD'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '3px' }}>
                      {v.depot_name} • Route {v.route_code} • {v.seated_capacity} Seats
                    </div>
                  </div>

                  <span style={{
                    background: v.status === 'active' ? '#ECFDF5' : '#FEF2F2',
                    color: v.status === 'active' ? '#047857' : '#B91C1C',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                  }}>
                    {v.status === 'active' ? '● On-Road' : '■ Standby'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Route Corridors */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RouteIcon size={18} className="text-red" />
                <span>Active Route Corridors ({routes.length})</span>
              </h3>
              {onNavigateToCorridors && (
                <button
                  type="button"
                  onClick={onNavigateToCorridors}
                  style={{ background: 'none', border: 'none', color: '#E11D48', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  View Performance ➔
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto' }}>
              {routes.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #F1F5F9',
                    background: '#F8FAFC',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        backgroundColor: `#${r.route_color}`,
                        color: '#FFFFFF',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                      }}
                    >
                      {r.public_code}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1E293B' }}>{r.long_name}</div>
                      {r.description && <div style={{ fontSize: '0.68rem', color: '#64748B' }}>{r.description}</div>}
                    </div>
                  </div>

                  <span style={{ background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, color: '#475569' }}>
                    Bidirectional
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
