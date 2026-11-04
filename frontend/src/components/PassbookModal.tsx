import React, { useState } from 'react';
import {
  X,
  Ticket,
  Crown,
  Bus,
  Calendar,
  Eye,
  Trash2,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowRight,
  AlertCircle,
  Navigation,
  User,
  Users,
} from 'lucide-react';
import { BookedTicket, ActiveBus, AuthUser } from '../types';
import { getStoredTickets, deleteTicket, isTicketExpired, syncTicketExpiration } from '../utils/ticketStorage';

interface PassbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTicket: (ticket: BookedTicket) => void;
  onTrackOnMap?: (ticket: BookedTicket) => void;
  onDeleteTicket?: (ticketNumber: string) => void;
  buses?: ActiveBus[];
  currentUser?: AuthUser | null;
}

export const PassbookModal: React.FC<PassbookModalProps> = ({
  isOpen,
  onClose,
  onSelectTicket,
  onTrackOnMap,
  onDeleteTicket,
  buses = [],
  currentUser = null,
}) => {
  const [tickets, setTickets] = useState<BookedTicket[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'primary' | 'copassenger'>('all');

  React.useEffect(() => {
    if (isOpen) {
      // Sync expiration against live buses for this specific user
      const refreshed = syncTicketExpiration(buses, currentUser);
      setTickets(refreshed);
    }
  }, [isOpen, buses, currentUser]);

  if (!isOpen) return null;

  const handleDelete = async (ticketNum: string) => {
    setTickets((prev) => prev.filter((t) => t.ticket_number !== ticketNum));
    onDeleteTicket?.(ticketNum);
    await deleteTicket(ticketNum, currentUser);
  };

  const hasCoPassengers = tickets.some((t) => t.passenger?.is_copassenger);
  const primaryTickets = tickets.filter((t) => !t.passenger?.is_copassenger);
  const coPassengerTickets = tickets.filter((t) => t.passenger?.is_copassenger);

  const displayedTickets =
    activeTab === 'primary'
      ? primaryTickets
      : activeTab === 'copassenger'
      ? coPassengerTickets
      : tickets;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="passbook-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-left">
            <div className="header-icon-badge">
              <Ticket size={20} className="text-red" />
            </div>
            <div>
              <h3 className="modal-title">My Tickets & AMTS Passes</h3>
              <p className="modal-subtitle">ડિજિટલ પાસબુક • Saved E-Tickets for Today</p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close passbook">
            <X size={18} />
          </button>
        </div>

        {/* Tab switchers if co-passengers exist */}
        {hasCoPassengers && (
          <div className="passbook-tabs-bar">
            <button
              type="button"
              className={`passbook-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <span>All Tickets</span>
              <span className="tab-count-badge">{tickets.length}</span>
            </button>
            <button
              type="button"
              className={`passbook-tab-btn ${activeTab === 'primary' ? 'active' : ''}`}
              onClick={() => setActiveTab('primary')}
            >
              <span>My Ticket</span>
              <span className="tab-count-badge">{primaryTickets.length}</span>
            </button>
            <button
              type="button"
              className={`passbook-tab-btn ${activeTab === 'copassenger' ? 'active' : ''}`}
              onClick={() => setActiveTab('copassenger')}
            >
              <span>Co-Passengers</span>
              <span className="tab-count-badge">{coPassengerTickets.length}</span>
            </button>
          </div>
        )}

        <div className="passbook-body">
          {displayedTickets.length === 0 ? (
            <div className="passbook-empty">
              <Ticket size={48} className="text-muted" />
              <h4>No Tickets in this view</h4>
              <p>You haven't booked any tickets in this category yet.</p>
            </div>
          ) : (
            <div className="passbook-list">
              {displayedTickets.map((t) => {
                const isGolden = t.ticket_type === 'golden_pass';
                const isExpired = isTicketExpired(t, buses);
                const isCoPassenger = Boolean(t.passenger?.is_copassenger);

                return (
                  <div
                    key={t.ticket_number}
                    className={`passbook-item-card ${isGolden ? 'golden-pass-item' : ''} ${
                      isExpired ? 'expired-pass-item' : ''
                    }`}
                  >
                    <div className="item-card-header">
                      <div className="item-title-badge">
                        {isGolden ? (
                          <div className="golden-tag">
                            <Crown size={14} />
                            <span>AMTS GOLDEN TICKET (ALL-DAY PASS)</span>
                          </div>
                        ) : (
                          <div className="local-tag">
                            <Bus size={14} />
                            <span>Route {t.trip.route_code} • Bus {t.trip.fleet_number}</span>
                          </div>
                        )}
                      </div>

                      <div className="item-header-right">
                        {isExpired ? (
                          <span className="pass-status-pill-expired">EXPIRED</span>
                        ) : (
                          <span className="pass-status-pill-active">ACTIVE</span>
                        )}
                        <span className="item-fare-badge">₹{t.fare?.amount_rupees ?? 0}</span>
                      </div>
                    </div>

                    <div className="item-card-body">
                      <div className="passenger-title-row">
                        <div className="item-passenger">
                          <strong>{t.passenger?.name || 'Passenger'}</strong> ({t.passenger?.age || ''} Yrs • {t.passenger?.gender || ''})
                        </div>
                        <span className={`pass-role-badge ${isCoPassenger ? 'role-copassenger' : 'role-primary'}`}>
                          {isCoPassenger ? <Users size={12} /> : <User size={12} />}
                          <span>{isCoPassenger ? 'Co-Passenger' : 'My Pass'}</span>
                        </span>
                      </div>

                      {isGolden ? (
                        <div className="golden-details-container">
                          <div className="golden-benefit-row">
                            <CheckCircle2 size={14} className="text-emerald" />
                            <span>
                              {isExpired
                                ? `Validity ended on ${t.validity?.valid_date || ''} at 23:59:59`
                                : 'Valid for unlimited rides on ANY AMTS bus in Ahmedabad today'}
                            </span>
                          </div>
                          {!isExpired && (
                            <div className="golden-allbus-tag">
                              🌟 Citywide Pass: Board any AMTS route (0₹ fare). Valid until 23:59:59.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="item-trip-row">
                          <span className="stand-name">{t.trip?.boarding_stop?.name || 'Boarding'}</span>
                          <ArrowRight size={13} className="text-muted" />
                          <span className="stand-name">{t.trip?.exit_stop?.name || 'Destination'}</span>
                          <span className="stand-count">({t.trip?.stops_count || 0} Stands)</span>
                        </div>
                      )}

                      <div className="item-meta-footer">
                        <span className="item-ticket-code font-mono">{t.ticket_number}</span>
                        <span className="item-date">
                          {isExpired ? 'Journey Completed' : `Valid Date: ${t.validity?.valid_date || ''}`}
                        </span>
                      </div>
                    </div>

                    <div className="item-card-actions">
                      {!isExpired && !isGolden && onTrackOnMap && (
                        <button
                          type="button"
                          className="btn-track-pass"
                          onClick={() => {
                            onTrackOnMap(t);
                          }}
                          title="Track bus live on map"
                        >
                          <Navigation size={13} />
                          <span>Track Bus Live</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-view-pass"
                        onClick={() => {
                          onSelectTicket(t);
                        }}
                      >
                        <Eye size={14} />
                        <span>View E-Ticket & QR</span>
                      </button>

                      {/* Allow deleting expired or test tickets */}
                      <button
                        type="button"
                        className="btn-delete-pass"
                        onClick={() => handleDelete(t.ticket_number)}
                        title={isExpired ? "Delete expired ticket" : "Remove ticket"}
                      >
                        <Trash2 size={14} />
                        <span>Delete{isExpired ? '' : ' (Test)'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
