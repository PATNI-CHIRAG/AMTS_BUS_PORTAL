import React, { useState } from 'react';
import {
  Bus,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Warehouse,
  Ticket,
  Crown,
  Sparkles,
  X,
} from 'lucide-react';
import { ActiveBus, RoutePatternDetail, TurnaroundEvent, BookedTicket } from '../types';
import { formatMinutesSeconds } from '../engine/scheduleEngine';
import { getActiveBookedTicketCountForBus } from '../utils/ticketStorage';

interface LiveBusTrackerProps {
  pattern: RoutePatternDetail | null;
  activeBuses: ActiveBus[];
  allBuses?: ActiveBus[];
  selectedBus: ActiveBus | null;
  onSelectBus: (bus: ActiveBus) => void;
  onToggleDirection: () => void;
  turnaroundEvents?: TurnaroundEvent[];
  simSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  isPaused?: boolean;
  onTogglePause?: () => void;
  onTriggerInstantArrival?: (bus: ActiveBus) => void;
  onFastForwardReadyToGo?: (bus: ActiveBus) => void;
  onBookTicket?: (bus: ActiveBus) => void;
  activeGoldenPass?: BookedTicket | null;
  activeGoldenPasses?: BookedTicket[];
  onShowPass?: (ticket: BookedTicket) => void;
  onCloseRoute?: () => void;
}

export const LiveBusTracker: React.FC<LiveBusTrackerProps> = ({
  pattern,
  activeBuses,
  allBuses = [],
  selectedBus,
  onSelectBus,
  onToggleDirection,
  turnaroundEvents,
  onBookTicket,
  activeGoldenPass,
  activeGoldenPasses = [],
  onShowPass,
  onCloseRoute,
}) => {
  const [showTerminalSection, setShowTerminalSection] = useState<boolean>(true);

  if (!pattern) {
    return (
      <div className="tracker-empty">
        <Bus size={36} className="text-muted" />
        <p className="empty-title">Select a bus direction above</p>
        <p className="empty-subtitle">Search a bus number like 31, 103, or 40 to view live buses</p>
      </div>
    );
  }

  const isUp = pattern.direction_id === 0;
  const oppositeTag = isUp ? 'DOWN' : 'UP';
  const totalStops = pattern.stops.length || 1;

  // USER RULE:
  // "show only running bus between the route , not coute which bus is standing on start or end station."
  // A bus is running between the route if it has departed the origin and is between intermediate stands (either moving or in 10s stand dwell)
  const isRunningBetweenRoute = (bus: ActiveBus) => {
    if (bus.lifecycle_status === 'MOVING') {
      return true;
    }
    // Stopped at intermediate stand (10s dwell)
    if (bus.current_stop_index > 0 && bus.current_stop_index < totalStops - 1) {
      return true;
    }
    return false;
  };

  const runningBuses = activeBuses.filter((b) => isRunningBetweenRoute(b));
  const standingAtTerminalBuses = activeBuses.filter((b) => !isRunningBetweenRoute(b));

  return (
    <div className="tracker-panel">
      {/* Route Direction Title Card */}
      <div className="direction-header-card">
        <div className="header-top-row">
          <div className="active-route-badge">
            <span className="badge-code">Route {pattern.route_code}</span>
            <span className={`direction-badge ${isUp ? 'up' : 'down'}`}>
              {isUp ? `${pattern.route_code}-UP` : `${pattern.route_code}-DOWN`}
            </span>
          </div>

          {/* Action buttons on header */}
          <div className="header-top-actions">
            <button
              type="button"
              className="switch-direction-btn"
              onClick={onToggleDirection}
              title={`Switch to ${pattern.route_code}-${oppositeTag}`}
            >
              <RotateCw size={14} />
              <span>Switch to {oppositeTag}</span>
            </button>

            {onCloseRoute && (
              <button
                type="button"
                className="close-route-tracker-btn"
                onClick={onCloseRoute}
                title="Close route and return to search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="active-corridor-name">
          <span className="corridor-origin">{pattern.stops[0]?.name || 'Origin'}</span>
          <span className="corridor-arrow">➔</span>
          <span className="corridor-dest">{pattern.stops[pattern.stops.length - 1]?.name || 'Destination'}</span>
        </div>

        {/* User Rule: "show only running bus between the route , not coute which bus is standing on start or end station." */}
        <div className="corridor-meta-chips">
          <span className="meta-chip">{pattern.stops.length} Total Stands</span>
          <span className="meta-chip active-chip">
            <span className="pulse-green-dot"></span>
            <strong>{runningBuses.length} Running on this direction</strong>
          </span>
          {standingAtTerminalBuses.length > 0 && (
            <span className="meta-chip terminal-dwell-chip" title="Parked at start/end terminal in 30m turnaround dwell">
              <Warehouse size={12} />
              {standingAtTerminalBuses.length} Standing at Terminal
            </span>
          )}
        </div>
      </div>

      {/* Cross-Bus Golden Ticket Active Notice */}
      {activeGoldenPass && (
        <div className="active-golden-pass-corridor-banner">
          <div className="banner-left">
            <Crown size={16} className="text-amber" />
            <div className="banner-text">
              <strong>AMTS Golden Ticket Active</strong>
              <span>Unlimited rides on all buses today for <strong>{activeGoldenPass.passenger.name}</strong></span>
            </div>
          </div>
          {onShowPass && (
            <button
              type="button"
              className="banner-pass-btn"
              onClick={() => onShowPass(activeGoldenPass)}
            >
              Show Pass
            </button>
          )}
        </div>
      )}

      {/* SECTION 1: RUNNING BUSES BETWEEN THE ROUTE */}
      <div className="active-buses-container">
        <div className="buses-list-header">
          <span className="running-header-text">
            🟢 Buses Running Between Stands ({runningBuses.length})
          </span>
          <span className="live-tag">ON ROUTE</span>
        </div>

        {runningBuses.length === 0 ? (
          <div className="no-buses-notice">
            <AlertTriangle size={20} className="text-amber" />
            <p>No buses currently on the road between stands. All fleet vehicles are stationed at terminal turnaround or operating on {pattern.route_code}-{oppositeTag}.</p>
            <button
              type="button"
              className="inline-switch-btn"
              onClick={onToggleDirection}
            >
              Check {pattern.route_code}-{oppositeTag} ➔
            </button>
          </div>
        ) : (
          <div className="bus-cards-list">
            {runningBuses.map((bus) => {
              const isMoving = bus.lifecycle_status === 'MOVING';
              const isStandStopped = bus.lifecycle_status === 'STOPPED_AT_ORIGIN';
              const isSelected = selectedBus?.fleet_number === bus.fleet_number;

              return (
                <div
                  key={bus.fleet_number}
                  className={`bus-tracking-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectBus(bus)}
                >
                  <div className="bus-card-top">
                    <div className="fleet-badge-group">
                      <div className={`bus-number-chip ${isStandStopped ? 'red-chip' : 'green-chip'}`}>
                        <Bus size={15} />
                        <span>{bus.fleet_number}</span>
                      </div>
                      <span className="bus-model-text">{bus.bus_model}</span>
                    </div>

                    {/* Color-Coded Status Pill (User Rule) */}
                    <div
                      className={`lifecycle-status-pill ${
                        isStandStopped ? 'pill-red' : 'pill-green'
                      }`}
                    >
                      <span className={`status-dot ${isStandStopped ? 'dot-red' : 'dot-green'}`}></span>
                      <span>
                        {isStandStopped
                          ? `STOPPED AT STAND (${bus.dwell_countdown_secs && bus.dwell_countdown_secs >= 60 ? formatMinutesSeconds(bus.dwell_countdown_secs) : `${bus.dwell_countdown_secs || 10}S`})`
                          : `MOVING (${bus.speed_kmh} km/h)`}
                      </span>
                    </div>
                  </div>

                  {/* Route Progress Bar */}
                  <div className="bus-progress-section">
                    <div className="progress-labels">
                      <span className="progress-current">
                        Stand {bus.current_stop_index + 1} of {pattern.stops.length}
                      </span>
                      <span className="progress-speed">
                        {isStandStopped ? '0 km/h (10s Dwell)' : `${bus.speed_kmh} km/h (In Transit)`}
                      </span>
                    </div>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${isStandStopped ? 'fill-red' : 'fill-green'}`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(((bus.current_stop_index + bus.progress_ratio) / pattern.stops.length) * 100)
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Status & Booked Tickets Info Box */}
                  {(() => {
                    const busScope = allBuses && allBuses.length > 0 ? allBuses : activeBuses;
                    const bookedCount = getActiveBookedTicketCountForBus(bus.fleet_number, busScope);
                    return (
                      <div className="bus-card-meta-grid">
                        <div className="meta-row-top">
                          <span className="meta-cell-label">Current Stand / Approach:</span>
                          <span className={`meta-cell-value ${isStandStopped ? 'text-red font-bold' : 'text-emerald font-bold'}`}>
                            {bus.next_stop_name || 'In Transit'}
                          </span>
                        </div>

                        <div className="meta-row-bottom">
                          <div className="meta-cell">
                            <span className="meta-cell-label">AC / Seating:</span>
                            <span className="meta-cell-value">
                              {bus.has_ac ? '❄️ AC (30 seats)' : 'CNG (34 seats)'}
                            </span>
                          </div>
                          <div className="meta-cell">
                            <span className="meta-cell-label">Booked Tickets:</span>
                            <span className={`meta-cell-value ${bookedCount > 0 ? 'text-emerald font-bold' : 'text-slate-600 font-bold'}`}>
                              {bookedCount > 0 ? `🎟️ ${bookedCount} Booked` : '0 Booked'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action buttons */}
                  <div className="card-footer-actions">
                    {onBookTicket && (
                      <button
                        type="button"
                        className="book-ticket-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookTicket(bus);
                        }}
                      >
                        <Ticket size={14} />
                        <span>Book E-Ticket</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: BUSES STANDING AT START OR END STATION (NOT COUNTED AS RUNNING) */}
      {standingAtTerminalBuses.length > 0 && (
        <div className="terminal-standing-section">
          <button
            type="button"
            className="terminal-section-toggle"
            onClick={() => setShowTerminalSection((prev) => !prev)}
          >
            <div className="toggle-left">
              <Warehouse size={15} className="text-amber" />
              <span className="toggle-title">
                Standing at Station ({standingAtTerminalBuses.length})
              </span>
              <span className="not-running-tag">Not Running on Route</span>
            </div>
            {showTerminalSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showTerminalSection && (
            <div className="terminal-buses-list">
              {standingAtTerminalBuses.map((bus) => {
                const isReadyToGo = bus.lifecycle_status === 'READY_TO_DEPART';
                const isSelected = selectedBus?.fleet_number === bus.fleet_number;

                return (
                  <div
                    key={bus.fleet_number}
                    className={`bus-tracking-card terminal-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelectBus(bus)}
                  >
                    <div className="bus-card-top">
                      <div className="fleet-badge-group">
                        <div className={`bus-number-chip ${isReadyToGo ? 'green-chip' : 'red-chip'}`}>
                          <Bus size={15} />
                          <span>{bus.fleet_number}</span>
                        </div>
                        <span className="bus-model-text">{bus.bus_model}</span>
                      </div>

                      <div
                        className={`lifecycle-status-pill ${
                          isReadyToGo ? 'pill-green' : 'pill-red'
                        }`}
                      >
                        <span className={`status-dot ${isReadyToGo ? 'dot-green' : 'dot-red'}`}></span>
                        <span>
                          {isReadyToGo
                            ? `READY TO GO (${bus.dwell_countdown_secs && bus.dwell_countdown_secs >= 60 ? formatMinutesSeconds(bus.dwell_countdown_secs) : `${bus.dwell_countdown_secs || 60}S`})`
                            : `30M TURNAROUND DWELL (${formatMinutesSeconds(bus.dwell_countdown_secs || 1800)})`}
                        </span>
                      </div>
                    </div>

                    <div className="terminal-bus-info-banner">
                      <div className="info-text">
                        <strong>Standing at Station:</strong> {pattern.stops[bus.current_stop_index]?.name || 'Terminal'}
                      </div>
                      <div className="sub-info">
                        {isReadyToGo
                          ? `Final 1 minute before departure (Ready to Go in Green - ${bus.dwell_countdown_secs && bus.dwell_countdown_secs >= 60 ? formatMinutesSeconds(bus.dwell_countdown_secs) : `${bus.dwell_countdown_secs || 60}S`} remaining)`
                          : `Scheduled turnaround dwell in progress. Departs in ${formatMinutesSeconds(bus.dwell_countdown_secs || 1800)}.`}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="card-footer-actions">
                      {onBookTicket && (
                        <button
                          type="button"
                          className="book-ticket-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBookTicket(bus);
                          }}
                        >
                          <Ticket size={14} />
                          <span>Book E-Ticket</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
