import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  Bus,
  Crown,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  ShieldCheck,
  User,
  Users,
  Trash2,
  Share2,
  Navigation,
  AlertCircle,
  CreditCard,
  Repeat,
} from 'lucide-react';
import { BookedTicket, ActiveBus } from '../types';
import { QRCodeSVG } from '../utils/qrCode';
import { isTicketExpired } from '../utils/ticketStorage';
import { downloadTicketPDF } from '../utils/ticketPdfGenerator';

interface TicketModalProps {
  ticket: BookedTicket | null;
  allActiveTickets?: BookedTicket[];
  isOpen: boolean;
  onClose: () => void;
  onTrackOnMap?: (ticket: BookedTicket) => void;
  onDeleteTicket?: (ticketNumber: string) => void;
  buses?: ActiveBus[];
  isExpired?: boolean;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  ticket,
  allActiveTickets = [],
  isOpen,
  onClose,
  onTrackOnMap,
  onDeleteTicket,
  buses,
  isExpired: isExpiredProp,
}) => {
  const [selectedTicketNumber, setSelectedTicketNumber] = useState<string | null>(null);
  const [liveSecondsStr, setLiveSecondsStr] = useState<string>('');
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Instantly sync when a new or different ticket is passed into the modal
  const prevTicketNumRef = useRef(ticket?.ticket_number);
  if (ticket?.ticket_number && ticket.ticket_number !== prevTicketNumRef.current) {
    prevTicketNumRef.current = ticket.ticket_number;
    setSelectedTicketNumber(ticket.ticket_number);
  }

  // Also sync via effect for background updates
  useEffect(() => {
    if (ticket?.ticket_number) {
      setSelectedTicketNumber(ticket.ticket_number);
    }
  }, [ticket?.ticket_number]);

  const currentTicket = useMemo(() => {
    if (ticket && (!selectedTicketNumber || selectedTicketNumber === ticket.ticket_number)) {
      return ticket;
    }
    if (selectedTicketNumber && allActiveTickets.length > 0) {
      const matched = allActiveTickets.find((t) => t.ticket_number === selectedTicketNumber);
      if (matched) return matched;
    }
    return ticket;
  }, [ticket, selectedTicketNumber, allActiveTickets]);

  // Live anti-fraud ticking security seal
  useEffect(() => {
    const updateLiveClock = () => {
      const now = new Date();
      setLiveSecondsStr(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateLiveClock();
    const timer = setInterval(updateLiveClock, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen || !currentTicket) return null;

  const isGolden = currentTicket.ticket_type === 'golden_pass';
  const isConnected = currentTicket.ticket_type === 'connected';
  const isExpired = isExpiredProp ?? isTicketExpired(currentTicket, buses);

  // Calculate formatted Boarding Time & Arrival Time safely
  const rawBase = currentTicket.issued_at ? new Date(currentTicket.issued_at) : new Date();
  const baseDate = isNaN(rawBase.getTime()) ? new Date() : rawBase;
  const boardingDate = new Date(baseDate.getTime() + 2 * 60000);
  const journeyMins = currentTicket.trip?.estimated_journey_minutes || 15;
  const arrivalDate = new Date(boardingDate.getTime() + journeyMins * 60000);

  const boardingTimeStr = !isNaN(boardingDate.getTime())
    ? boardingDate.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '10:00 AM';

  const arrivalTimeStr = !isNaN(arrivalDate.getTime())
    ? arrivalDate.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '10:15 AM';

  const handlePrint = async () => {
    try {
      // 1. Download official PDF to store directly in user's mobile device (Downloads folder)
      await downloadTicketPDF(currentTicket);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);

      // 2. If on desktop, also trigger browser print dialog after initiating download
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768;
      if (!isMobile) {
        setTimeout(() => {
          window.print();
        }, 600);
      }
    } catch (err) {
      console.error('Failed to generate PDF, falling back to window.print():', err);
      window.print();
    }
  };

  return (
    <div className="modal-backdrop ticket-modal-backdrop" onClick={onClose}>
      <div className={`ticket-modal-card ${isGolden ? 'golden-theme' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Header Action Bar (Not printed) */}
        <div className="ticket-modal-top-bar no-print">
          <div className="top-bar-title">
            <ShieldCheck size={16} className="text-emerald" />
            <span>Official AMTS Digital Transit Pass</span>
          </div>
          <div className="top-bar-actions">
            <button
              type="button"
              className={`ticket-action-btn ${downloadSuccess ? 'btn-download-success' : ''}`}
              onClick={handlePrint}
              title="Print or Save PDF to Mobile Device"
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 size={15} className="text-emerald" />
                  <span>PDF Saved!</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>Save PDF / Print</span>
                </>
              )}
            </button>
            <button
              type="button"
              className="ticket-close-btn"
              onClick={onClose}
              title="Close Ticket"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Passenger Switcher for Multiple Passes */}
        {allActiveTickets.length > 1 && (
          <div className="ticket-passenger-switch-bar no-print">
            <span className="switch-label">
              <Users size={14} className="text-amber" />
              <span>Active Passes ({allActiveTickets.length}):</span>
            </span>
            <div className="switch-chips">
              {allActiveTickets.map((t) => {
                const isSelected = t.ticket_number === currentTicket.ticket_number;
                return (
                  <button
                    key={t.ticket_number}
                    type="button"
                    className={`passenger-switch-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedTicketNumber(t.ticket_number)}
                  >
                    {t.passenger?.is_copassenger ? <Users size={12} /> : <User size={12} />}
                    <span>{t.passenger?.name || 'Passenger'} ({t.passenger?.gender || ''})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PRINTABLE TICKET BODY */}
        <div className="printable-ticket-wrapper" id="amts-printable-ticket">
          {/* Ticket Header */}
          <div className={`ticket-header ${isGolden ? 'ticket-golden-header' : ''}`}>
            <div className="ticket-brand-row">
              <div className="ticket-brand-logo">
                <Bus size={24} className="brand-bus-icon" />
              </div>
              <div className="ticket-brand-text">
                <div className="brand-primary">અમદાવાદ મ્યુનિસિપલ ટ્રાન્સપોર્ટ સર્વિસ (AMTS)</div>
                <div className="brand-secondary">AHMEDABAD MUNICIPAL TRANSPORT SERVICE</div>
              </div>
            </div>

            <div className="ticket-title-pill">
              {isGolden ? (
                <div className="golden-pass-header-tag">
                  <Crown size={16} />
                  <span>AMTS GOLDEN TICKET • ઓલ-ડે બસ પાસ</span>
                </div>
              ) : isConnected ? (
                <div className="connected-pass-header-tag">
                  <Repeat size={14} />
                  <span>AMTS CONNECTED MULTI-BUS E-TICKET • કનેક્ટિંગ ટિકિટ</span>
                </div>
              ) : (
                <div className="local-pass-header-tag">
                  <Bus size={14} />
                  <span>AMTS SINGLE JOURNEY E-TICKET • ઈ-ટિકિટ</span>
                </div>
              )}
            </div>

            {/* Anti-Fraud Live Animated Security Bar */}
            <div className={`ticket-security-live-bar ${isExpired ? 'bar-expired' : ''}`}>
              <div className={`security-pulse-dot ${isExpired ? 'dot-expired' : ''}`}></div>
              <span className="security-text">
                {isExpired ? 'EXPIRED TICKET / JOURNEY COMPLETED' : 'VERIFIED DIGITAL TICKET'}
              </span>
              <span className="security-time-live">
                <Clock size={12} />
                <span>IST {liveSecondsStr}</span>
              </span>
            </div>
          </div>

          {/* Big Bold Red EXPIRED Stamp */}
          {isExpired && (
            <div className="ticket-big-expired-stamp-container">
              <div className="big-red-expired-badge">EXPIRED</div>
            </div>
          )}

          {/* Ticket Body Content */}
          <div className="ticket-body">
            {/* Top row: Ticket Number & QR Code */}
            <div className="ticket-qr-section">
              <div className="ticket-qr-box">
                <QRCodeSVG
                  value={`AMTS:${currentTicket.ticket_number || ''}:${currentTicket.ticket_hash || ''}:${currentTicket.passenger?.name || ''}:${currentTicket.fare?.amount_rupees ?? 0}`}
                  size={150}
                />
                <span className="qr-scan-label">Scan by AMTS Conductor</span>
              </div>

              <div className="ticket-main-meta">
                <div className="ticket-number-label">Ticket Number / ટિકિટ નંબર:</div>
                <div className="ticket-number-value font-mono">{currentTicket.ticket_number}</div>

                <div className="fare-big-display">
                  <span className="fare-curr">₹</span>
                  <span className="fare-amt">{currentTicket.fare?.amount_rupees ?? 0}</span>
                  <span className="fare-status-tag">PAID ONLINE</span>
                </div>

                <div className="ticket-issue-date">
                  <Calendar size={13} />
                  <span>Valid Date: <strong>{currentTicket.validity?.valid_date || ''}</strong></span>
                </div>

                {isGolden ? (
                  <div className="golden-validity-badge">
                    <Crown size={14} />
                    <span>Works ALL DAY on ALL AMTS Buses until 23:59:59</span>
                  </div>
                ) : isConnected ? (
                  <div className="connected-legs-assigned-badge">
                    <Repeat size={13} />
                    <span>Connecting Journey: <strong>{currentTicket.connected_legs?.length || 2} Bus Transfers</strong></span>
                  </div>
                ) : (
                  <div className="bus-fleet-assigned-badge">
                    <Bus size={13} />
                    <span>Assigned to <strong>Bus {currentTicket.trip?.fleet_number || 'AMTS Fleet'}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Perforated Divider line */}
            <div className="ticket-perforated-divider">
              <span className="cut-circle cut-left"></span>
              <span className="cut-line"></span>
              <span className="cut-circle cut-right"></span>
            </div>

            {/* Route & Stop Details */}
            <div className="ticket-trip-details">
              {isGolden ? (
                <div className="golden-all-network-card">
                  <div className="golden-card-tag">
                    <Crown size={15} className="text-amber" />
                    <strong>Citywide Unlimited Transit Pass</strong>
                  </div>
                  <p className="golden-card-desc">
                    Valid for unlimited rides across all AMTS routes & fleet buses in Ahmedabad today. Present this digital pass or QR code to the conductor upon request.
                  </p>
                </div>
              ) : isConnected && currentTicket.connected_legs && currentTicket.connected_legs.length > 0 ? (
                <div className="connected-ticket-timeline-wrapper">
                  <div className="connected-trip-header">
                    <span className="connected-trip-title">
                      Connecting Journey: {currentTicket.trip?.boarding_stop?.name || 'Origin'} ──▶ {currentTicket.trip?.exit_stop?.name || 'Destination'}
                    </span>
                    <span className="connected-trip-sub">
                      Total {currentTicket.trip?.stops_count || 0} Stands • {currentTicket.connected_legs?.length || 0} Buses
                    </span>
                  </div>

                  <div className="connected-ticket-legs-flow">
                    {currentTicket.connected_legs?.map((leg, idx) => (
                      <React.Fragment key={idx}>
                        <div className="connected-ticket-leg-card">
                          <div className="connected-ticket-leg-top">
                            <span
                              className="connected-leg-num-tag"
                              style={{ background: idx === 0 ? '#2563EB' : idx === 1 ? '#8B5CF6' : '#0D9488' }}
                            >
                              LEG {leg.leg_number}
                            </span>
                            <span className="connected-leg-route-name">
                              Route {leg.route_code}: {leg.direction_name || leg.route_name}
                            </span>
                            <span className="connected-leg-fare font-mono">₹{leg.fare_rupees}</span>
                          </div>
                          <div className="connected-ticket-leg-stands">
                            <span className="leg-stand from">🚏 {leg.from_stop}</span>
                            <span className="leg-stand-arrow">──({leg.stops_count} stands)──▶</span>
                            <span className="leg-stand to">🏁 {leg.to_stop}</span>
                          </div>
                        </div>

                        {idx < (currentTicket.connected_legs?.length || 0) - 1 && (
                          <div className="connected-ticket-transfer-node">
                            <div className="transfer-node-icon">🔄</div>
                            <div className="transfer-node-text">
                              <strong>Transfer Hub #{idx + 1}:</strong> {currentTicket.transfer_hubs?.[idx]?.name || leg.to_stop}
                              <span className="transfer-switch-hint"> (Switch to Route {currentTicket.connected_legs?.[idx + 1]?.route_code || ''})</span>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="connected-ticket-conductor-note">
                    ✓ Valid for all transfer legs today. Conductor scan applies across the full connected itinerary.
                  </div>
                </div>
              ) : (
                <>
                  <div className="trip-route-line">
                    <span className="route-badge">Route {currentTicket.trip?.route_code || 'Transit'}</span>
                    <span className="route-name-text">{currentTicket.trip?.direction_name || ''}</span>
                  </div>

                  <div className="trip-stands-flow">
                    <div className="stand-flow-point boarding">
                      <div className="stand-badge-dot origin-dot">
                        <MapPin size={12} />
                      </div>
                      <div className="stand-flow-info">
                        <div className="stand-kind">BOARDING STAND (ચડવાનું સ્ટેશન)</div>
                        <div className="stand-name">
                          Stand #{currentTicket.trip?.boarding_stop?.sequence || 1}: {currentTicket.trip?.boarding_stop?.name || 'Boarding Stand'}
                        </div>
                      </div>
                    </div>

                    <div className="stand-flow-connector">
                      <div className="connector-line"></div>
                      <div className="connector-badge">
                        <ArrowRight size={13} />
                        <span>{currentTicket.trip?.stops_count || 0} Stands (~{currentTicket.trip?.estimated_journey_minutes || 15} Mins)</span>
                      </div>
                      <div className="connector-line"></div>
                    </div>

                    <div className="stand-flow-point exit">
                      <div className="stand-badge-dot dest-dot">
                        <MapPin size={12} />
                      </div>
                      <div className="stand-flow-info">
                        <div className="stand-kind">DESTINATION STAND (ઉતરવાનું સ્ટેશન)</div>
                        <div className="stand-name">
                          Stand #{currentTicket.trip?.exit_stop?.sequence || 1}: {currentTicket.trip?.exit_stop?.name || 'Destination Stand'}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Passenger & Schedule Times Grid (Clean & Formal) */}
            <div className="ticket-passenger-details">
              <div className="passenger-row">
                <div className="passenger-cell">
                  <span className="cell-label">Passenger Name:</span>
                  <span className="cell-val font-bold">
                    {currentTicket.passenger?.name || 'Passenger'}
                    {currentTicket.passenger?.is_copassenger && ' (Co-Passenger)'}
                  </span>
                </div>
                <div className="passenger-cell">
                  <span className="cell-label">Age & Gender:</span>
                  <span className="cell-val">
                    {currentTicket.passenger?.age || ''} Yrs • {currentTicket.passenger?.gender || ''}
                  </span>
                </div>
                <div className="passenger-cell">
                  <span className="cell-label">Boarding Time:</span>
                  <span className="cell-val font-bold text-primary">{boardingTimeStr}</span>
                </div>
                <div className="passenger-cell">
                  <span className="cell-label">Arrival Time:</span>
                  <span className="cell-val font-bold text-emerald">{arrivalTimeStr}</span>
                </div>
                <div className="passenger-cell">
                  <span className="cell-label">Payment Mode:</span>
                  <span className="cell-val font-semibold text-emerald">
                    {currentTicket.fare?.payment_method || 'Verified Online Pay'}
                  </span>
                </div>
                <div className="passenger-cell">
                  <span className="cell-label">Transaction ID:</span>
                  <span className="cell-val font-mono text-slate-600">
                    {currentTicket.fare?.transaction_id || `TXN-AMTS-${currentTicket.ticket_hash || ''}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions (Bottom) */}
        <div className="ticket-modal-bottom-actions no-print">
          {/* User Rule: "also ticket is expire remove track bus live to boarding stand option." */}
          {!isExpired && !isGolden && !isConnected && onTrackOnMap ? (
            <button
              type="button"
              className="btn-track-live-blue"
              onClick={() => {
                onTrackOnMap(currentTicket);
                onClose();
              }}
            >
              <Navigation size={16} />
              <span>Track Bus Live to Boarding Stand (Blue Route)</span>
            </button>
          ) : isExpired && !isGolden ? (
            <div className="expired-tracking-disabled-note">
              <AlertCircle size={14} className="text-amber" />
              <span>Tracking disabled: Ticket is expired / route completed</span>
            </div>
          ) : null}

          {/* Delete Option for Testing / Removal */}
          {onDeleteTicket && (
            <button
              type="button"
              className="btn-delete-pass modal-delete-btn"
              onClick={() => {
                onDeleteTicket(currentTicket.ticket_number);
                onClose();
              }}
              title={isExpired ? "Delete expired ticket" : "Remove ticket"}
            >
              <Trash2 size={14} />
              <span>Delete{isExpired ? '' : ' (Test)'}</span>
            </button>
          )}

          <button
            type="button"
            className={`btn-download-pdf-primary ${downloadSuccess ? 'downloaded' : ''}`}
            onClick={handlePrint}
            title="Download Official AMTS PDF Ticket to your phone or computer"
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 size={16} />
                <span>Ticket PDF Saved to Device!</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Save Ticket as PDF</span>
              </>
            )}
          </button>

          <button type="button" className="btn-close-ticket" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
