import React, { useState, useMemo } from 'react';
import { FleetVehicleTelemetry } from './types';
import {
  Bus,
  Search,
  Filter,
  Zap,
  Fuel,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  Gauge,
  Navigation,
  Sparkles,
  PlusCircle,
} from 'lucide-react';

interface FleetTableProps {
  fleet: FleetVehicleTelemetry[];
  onTrackBusOnMap?: (bus: FleetVehicleTelemetry) => void;
  onRefresh?: () => void;
  onAddNewBus?: () => void;
}

export const AdminFleetTable: React.FC<FleetTableProps> = ({
  fleet,
  onTrackBusOnMap,
  onRefresh,
  onAddNewBus,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fuelFilter, setFuelFilter] = useState<string>('all');

  const filteredFleet = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return fleet.filter((bus) => {
      // Search filter: Strictly match bus number / fleet code (e.g. 103-X, 31-Z)
      const matchesSearch = !term || bus.fleet_number.toLowerCase().includes(term);

      // Status filter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'delayed' && bus.status === 'DELAYED') ||
        (statusFilter === 'running' && bus.status === 'RUNNING') ||
        (statusFilter === 'in_depot' && bus.status === 'IN_DEPOT');

      // Fuel filter
      const matchesFuel =
        fuelFilter === 'all' ||
        (fuelFilter === 'electric' && (bus.has_ac || bus.fuel_type.toLowerCase() === 'electric')) ||
        (fuelFilter === 'cng' && bus.fuel_type.toLowerCase().includes('cng'));

      return matchesSearch && matchesStatus && matchesFuel;
    });
  }, [fleet, searchTerm, statusFilter, fuelFilter]);

  return (
    <div className="admin-fleet-table-card">
      <div className="table-header-row">
        <div className="table-title-group">
          <div className="chart-icon-box dark-blue-box">
            <Bus size={18} />
          </div>
          <div>
            <h4 className="chart-heading">Live Fleet Dispatch & Telemetry Matrix</h4>
            <p className="chart-subheading">
              Monitoring All Active Transit Units, Battery SoC, Speed & Daily Round Cycles
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="live-stream-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '4px 10px', borderRadius: '20px', color: '#047857', fontSize: '0.74rem', fontWeight: 700 }}>
            <span className="live-dot pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
            <span>LIVE GPS STREAMING (3s Auto-Poll)</span>
          </div>
          <button
            type="button"
            className="admin-btn-action secondary-btn"
            onClick={onRefresh}
            title="Refresh telemetry"
          >
            <RotateCw size={14} />
            <span>Refresh Fleet</span>
          </button>

          {onAddNewBus && (
            <button
              type="button"
              className="admin-btn-action primary-btn"
              onClick={onAddNewBus}
              title="Add New Bus to Fleet"
              style={{ background: '#2563EB', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <PlusCircle size={14} />
              <span>+ Add Bus</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="table-controls-bar">
        <div className="search-input-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="admin-search-field"
            placeholder="Search by Bus # (e.g. 103-X, 31-Z)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
            >
              ×
            </button>
          )}
        </div>

        <div className="filter-dropdowns-row">
          <div className="filter-chip-group">
            <span className="filter-chip-label">Status:</span>
            <select
              className="admin-select-dropdown"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses ({fleet.length})</option>
              <option value="running">On Road Running</option>
              <option value="delayed">Delayed (&gt;5 min)</option>
              <option value="in_depot">In Depot Standby</option>
            </select>
          </div>

          <div className="filter-chip-group">
            <span className="filter-chip-label">Powertrain:</span>
            <select
              className="admin-select-dropdown"
              value={fuelFilter}
              onChange={(e) => setFuelFilter(e.target.value)}
            >
              <option value="all">All Powertrains</option>
              <option value="electric">Electric (EV) AC</option>
              <option value="cng">CNG Standard</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-responsive-wrapper">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Fleet Unit</th>
              <th>Assigned Corridor</th>
              <th>Action</th>
              <th>Speed & Telemetry</th>
              <th>Battery / Fuel Tank</th>
            </tr>
          </thead>
          <tbody>
            {filteredFleet.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-table-cell">
                  <div className="empty-message-box">
                    <Bus size={32} className="text-muted" />
                    <p>No fleet units found matching your filter criteria.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFleet.map((bus) => {
                const isEV = bus.has_ac || bus.fuel_type.toLowerCase() === 'electric';

                return (
                  <tr key={bus.fleet_number} className="fleet-table-row">
                    {/* Fleet Unit */}
                    <td>
                      <div className="fleet-cell-group">
                        <div className="fleet-badge-pill">
                          <Bus size={14} />
                          <span>{bus.fleet_number}</span>
                        </div>
                        <div className="fleet-sub-details">
                          <span className="bus-reg">{bus.registration_number}</span>
                          <span className="bus-model-tag">
                            {isEV ? (
                              <span className="ev-tag">
                                <Zap size={10} /> EV AC
                              </span>
                            ) : (
                              <span className="cng-tag">
                                <Fuel size={10} /> CNG
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Assigned Corridor */}
                    <td>
                      <div className="assigned-route-cell">
                        <span className="route-main-text font-bold">{bus.assigned_route}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span className="depot-tag" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                            {bus.depot_name || 'Central Depot'}
                          </span>
                          <span className="capacity-sub" style={{ fontSize: '0.7rem' }}>
                            {bus.seated_capacity} Pax
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Action (Column 3) */}
                    <td>
                      <button
                        type="button"
                        className="track-map-btn"
                        onClick={() => onTrackBusOnMap?.(bus)}
                        title="Locate unit on map"
                      >
                        <Navigation size={13} />
                        <span>Track</span>
                      </button>
                    </td>

                    {/* Speed & Telemetry */}
                    <td>
                      <div className="telemetry-cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {bus.movement_status === 'MOVING' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
                              MOVING
                            </span>
                          ) : bus.movement_status === 'STOPPED' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}></span>
                              AT STAND
                            </span>
                          ) : bus.movement_status === 'TERMINAL' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
                              ⟳ TURNAROUND
                            </span>
                          ) : bus.movement_status === 'DELAYED' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
                              ▲ DELAYED
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
                              DEPOT
                            </span>
                          )}
                          <div className="speed-val font-bold" style={{ fontSize: '0.78rem', color: '#0F172A', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Gauge size={12} className="text-muted" />
                            <span>{bus.speed_kmh} km/h</span>
                          </div>
                        </div>

                        {/* Live Location / Stand ETA */}
                        <div style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 600, marginTop: '3px' }}>
                          {bus.live_location_label || (bus.current_latitude ? `${bus.current_latitude.toFixed(4)}, ${bus.current_longitude?.toFixed(4)}` : 'Depot Bay')}
                        </div>

                        {bus.current_latitude && bus.current_longitude && (
                          <div className="coords-sub" style={{ fontSize: '0.65rem', color: '#94A3B8' }}>
                            GPS: {bus.current_latitude.toFixed(4)}, {bus.current_longitude.toFixed(4)}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Battery / Fuel Tank */}
                    <td>
                      <div className="fuel-cell">
                        <div className="fuel-badge-row">
                          {isEV ? (
                            <span className="fuel-pill ev-pill">
                              <Zap size={12} />
                              <span>{bus.battery_or_fuel}</span>
                            </span>
                          ) : (
                            <span className="fuel-pill cng-pill">
                              <Fuel size={12} />
                              <span>{bus.battery_or_fuel}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer-summary">
        <span>Showing {filteredFleet.length} of {fleet.length} total active units</span>
        <span className="telemetry-sync-time">AMTS Control Room • AMC Central Transit Network</span>
      </div>
    </div>
  );
};
