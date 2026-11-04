import React from 'react';
import { X, Radio, AlertTriangle, Info, Clock, CheckCircle2 } from 'lucide-react';
import { ServiceAlertItem } from './AdminDashboard/types';

interface ServiceAdvisoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: ServiceAlertItem[];
}

export const ServiceAdvisoriesModal: React.FC<ServiceAdvisoriesModalProps> = ({
  isOpen,
  onClose,
  alerts = [],
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="booking-modal-card"
        style={{ maxWidth: '600px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="header-left">
            <div className="bus-fleet-pill" style={{ background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A' }}>
              <Radio size={16} />
              <span>AMTS Live Notices</span>
            </div>
            <div>
              <h4 className="modal-title">Service Advisories & Detours</h4>
              <p className="modal-subtitle">સર્વિસ એડવાઈઝરી • Real-Time Route Diversions & Road Work Updates</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', maxHeight: '70vh', overflowY: 'auto' }}>
          {alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748B' }}>
              <CheckCircle2 size={40} className="text-emerald" style={{ margin: '0 auto 10px' }} />
              <h5 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
                All Corridors Running Normally
              </h5>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>
                There are currently no active detours, diversions or service suspensions reported across Ahmedabad.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {alerts.map((alert) => {
                const rawSev = String(alert.severity || alert.severity_level || 'warning').toLowerCase();
                const isCrit = rawSev === 'critical' || rawSev === 'severe';
                const isWarn = rawSev === 'warning';
                const sevColor = isCrit ? '#DC2626' : isWarn ? '#D97706' : '#2563EB';
                const sevBg = isCrit ? '#FEF2F2' : isWarn ? '#FFFBEB' : '#EFF6FF';
                const alertTitle = alert.title || alert.header_text || 'Service Advisory';
                const alertDesc = alert.description || alert.description_text || 'Active transit advisory in effect.';
                const alertEffect = alert.effect || 'DETOUR';
                const startTime = alert.starts_at || alert.active_period_start;
                const timeStr = startTime
                  ? new Date(startTime).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Active Today';

                const routesList: string[] = Array.isArray(alert.affected_routes)
                  ? alert.affected_routes.map((r: any) =>
                      typeof r === 'string' ? r : (r.route_code || r.public_code || String(r))
                    )
                  : [];

                return (
                  <div
                    key={alert.id}
                    style={{
                      borderLeft: `5px solid ${sevColor}`,
                      background: sevBg,
                      borderRadius: '10px',
                      padding: '14px 16px',
                      border: `1px solid ${isCrit ? '#FECACA' : isWarn ? '#FDE68A' : '#BFDBFE'}`,
                      borderLeftWidth: '5px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      {isCrit ? (
                        <AlertTriangle size={18} style={{ color: sevColor, flexShrink: 0 }} />
                      ) : isWarn ? (
                        <AlertTriangle size={18} style={{ color: sevColor, flexShrink: 0 }} />
                      ) : (
                        <Info size={18} style={{ color: sevColor, flexShrink: 0 }} />
                      )}
                      <h5 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#0F172A', flex: 1 }}>
                        {alertTitle}
                      </h5>
                      <span
                        style={{
                          background: sevColor,
                          color: '#FFFFFF',
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {alertEffect}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#334155', lineHeight: 1.45 }}>
                      {alertDesc}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '8px' }}>
                      {routesList.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>
                            Affected:
                          </span>
                          {routesList.map((c, i) => (
                            <span
                              key={i}
                              style={{
                                background: '#FFFFFF',
                                border: '1px solid #CBD5E1',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                color: '#0F172A',
                              }}
                            >
                              Route {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span></span>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#64748B' }}>
                        <Clock size={11} />
                        <span>Since {timeStr}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid #E2E8F0', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
            style={{ width: 'auto', minWidth: '120px' }}
          >
            Close Notice
          </button>
        </div>
      </div>
    </div>
  );
};
