import React, { useState } from 'react';
import { ServiceAlertItem } from './types';
import {
  Radio,
  Send,
  Trash2,
  CheckCircle2,
  Plus,
  ShieldAlert,
  Clock,
  X,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface AlertsDispatcherProps {
  alerts: ServiceAlertItem[];
  availableRoutes: { code: string; name: string }[];
  onRefreshAlerts?: () => void;
}

export const AdminAlertsDispatcher: React.FC<AlertsDispatcherProps> = ({
  alerts = [],
  availableRoutes = [],
  onRefreshAlerts,
}) => {
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('warning');
  const [effect, setEffect] = useState<string>('DETOUR');
  const [selectedRouteCodes, setSelectedRouteCodes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleToggleRoute = (code: string) => {
    setSelectedRouteCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/alerts/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          severity,
          effect,
          affected_routes: selectedRouteCodes,
        }),
      });

      if (res.ok) {
        setSuccessMessage('Service advisory broadcast successfully to public live portal!');
        setTitle('');
        setDescription('');
        setSelectedRouteCodes([]);
        setShowCreateModal(false);
        onRefreshAlerts?.();
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err) {
      console.error('Failed to broadcast alert:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/v1/alerts/?id=${alertId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onRefreshAlerts?.();
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  return (
    <div className="alerts-dispatcher-card">
      <div className="table-header-row">
        <div className="table-title-group">
          <div className="chart-icon-box red-box">
            <Radio size={18} />
          </div>
          <div>
            <h4 className="chart-heading">Public Service Advisories & Dispatch Broadcasts</h4>
            <p className="chart-subheading">
              Manage Road Work Detours, Heavy Rain Notices & Route Diversions in Real-Time
            </p>
          </div>
        </div>

        <button
          type="button"
          className="admin-btn-action primary-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={15} />
          <span>Broadcast New Advisory</span>
        </button>
      </div>

      {successMessage && (
        <div className="alert-success-banner" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 600 }}>
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Alerts List */}
      <div className="alerts-list-grid">
        {!alerts || alerts.length === 0 ? (
          <div className="no-alerts-placeholder">
            <CheckCircle2 size={40} className="text-emerald" />
            <h5 style={{ margin: '6px 0 2px 0', fontSize: '1rem', fontWeight: 700, color: '#1E293B' }}>
              All AMTS Corridors Operating Normally
            </h5>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>
              No active service disruptions, diversions or emergency detours broadcast at this time.
            </p>
          </div>
        ) : (
          alerts.map((alert) => {
            const rawSev = String(alert.severity || alert.severity_level || 'warning').toLowerCase();
            const isCrit = rawSev === 'critical' || rawSev === 'severe';
            const isWarn = rawSev === 'warning';
            const sevClass = isCrit ? 'severity-critical' : isWarn ? 'severity-warning' : 'severity-info';
            const sevLabel = isCrit ? 'CRITICAL' : isWarn ? 'WARNING' : 'INFO';
            const alertTitle = alert.title || alert.header_text || 'Service Advisory';
            const alertDesc = alert.description || alert.description_text || 'Active transit advisory in effect.';
            const alertEffect = alert.effect || 'DETOUR';
            const startTime = alert.starts_at || alert.active_period_start;
            const timeStr = startTime
              ? new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Active';

            const routesList: string[] = Array.isArray(alert.affected_routes)
              ? alert.affected_routes.map((r: any) =>
                  typeof r === 'string' ? r : (r.route_code || r.public_code || String(r))
                )
              : [];

            return (
              <div
                key={alert.id}
                className={`alert-broadcast-item ${sevClass}`}
              >
                <div className="alert-content-col">
                  <div className="alert-title-row">
                    {isCrit ? (
                      <AlertTriangle size={18} className="text-red" />
                    ) : isWarn ? (
                      <AlertTriangle size={18} className="text-amber" />
                    ) : (
                      <Info size={18} className="text-blue" />
                    )}
                    <h5 className="alert-title">{alertTitle}</h5>
                    <span className="alert-severity-pill">{sevLabel}</span>
                    <span className="effect-tag" style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>
                      {alertEffect}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#64748B', marginLeft: 'auto' }}>
                      <Clock size={12} />
                      <span>{timeStr}</span>
                    </span>
                  </div>

                  <p className="alert-desc">{alertDesc}</p>

                  {routesList.length > 0 && (
                    <div className="alert-routes-list">
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                        Affected Corridors:
                      </span>
                      {routesList.map((code, idx) => (
                        <span key={idx} className="route-chip">
                          Route {code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="alert-resolve-btn"
                  onClick={() => handleResolveAlert(alert.id)}
                  title="Resolve and clear advisory from public live portal"
                >
                  <Trash2 size={13} />
                  <span>Resolve Alert</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Broadcast New Alert */}
      {showCreateModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={22} className="text-red" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                    Broadcast Public Service Advisory
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B' }}>
                    Instantly displays notice across passenger live map and station displays
                  </p>
                </div>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '20px' }}
                onClick={() => setShowCreateModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAlert}>
              <div className="admin-modal-body">
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Advisory Headline / Title *
                  </label>
                  <input
                    type="text"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '0.82rem', outline: 'none' }}
                    placeholder="e.g. Route 31 & 34 Diverted via Subhash Bridge due to Metro Work"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Detailed Instructions for Passengers
                  </label>
                  <textarea
                    rows={3}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '0.82rem', outline: 'none', resize: 'vertical' }}
                    placeholder="Explain detour stops, expected delay duration, or temporary pickup stands..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  ></textarea>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Severity Level
                    </label>
                    <select
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '0.8rem', background: '#FFFFFF' }}
                      value={severity}
                      onChange={(e: any) => setSeverity(e.target.value)}
                    >
                      <option value="warning">Warning (Medium Delay / Detour)</option>
                      <option value="critical">Critical (Road Block / Emergency)</option>
                      <option value="info">Informational (Festival / Extra Bus)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Transit Effect
                    </label>
                    <select
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '0.8rem', background: '#FFFFFF' }}
                      value={effect}
                      onChange={(e) => setEffect(e.target.value)}
                    >
                      <option value="DETOUR">Detour / Route Diverted</option>
                      <option value="DELAY">Traffic Delay Notice</option>
                      <option value="STOP_CLOSED">Specific Stand Closed</option>
                      <option value="NO_SERVICE">Temporary Service Suspension</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Select Affected Corridors ({selectedRouteCodes.length} selected)
                  </label>
                  <div className="routes-checkbox-grid">
                    {availableRoutes.map((r) => {
                      const isChecked = selectedRouteCodes.includes(r.code);
                      return (
                        <label
                          key={r.code}
                          className="route-checkbox-item"
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: isChecked ? '#FEF2F2' : '#FFFFFF',
                            border: `1px solid ${isChecked ? '#DC2626' : '#E2E8F0'}`,
                            color: isChecked ? '#B91C1C' : '#334155',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleRoute(r.code)}
                          />
                          <span>Route {r.code}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-action-btn secondary-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="admin-action-btn primary"
                  style={{ opacity: isSubmitting || !title.trim() ? 0.6 : 1 }}
                >
                  <Send size={14} />
                  <span>{isSubmitting ? 'Publishing...' : 'Broadcast to Passengers'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
