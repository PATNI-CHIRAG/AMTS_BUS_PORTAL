import React, { useEffect } from 'react';
import { Bus, Clock, MapPin, Eye, CheckCircle2, Navigation2, X, AlertTriangle } from 'lucide-react';
import { BookedTicket, ActiveBus } from '../types';
import { formatMinutesSeconds } from '../engine/scheduleEngine';
import { markTicketAsExpired } from '../utils/ticketStorage';

interface PassengerTripBannerProps {
  ticket: BookedTicket;
  bus: ActiveBus | null;
  onViewTicket: () => void;
  onDismiss: () => void;
  onTicketExpired?: (ticketNumber: string) => void;
}

export const PassengerTripBanner: React.FC<PassengerTripBannerProps> = ({
  ticket,
  bus,
  onViewTicket,
  onDismiss,
  onTicketExpired,
}) => {
  const boardingSeq = ticket.trip.boarding_stop.sequence;
  const boardingIdx = boardingSeq - 1;
  const exitSeq = ticket.trip.exit_stop.sequence;
  const exitIdx = exitSeq - 1;

  // Compute live ETA
  let etaLabel = '';
  let etaStatus: 'approaching' | 'at_stand' | 'on_board' | 'arrived' = 'approaching';
  let bannerClass = 'banner-blue-approaching';

  const isLocal = ticket.ticket_type === 'local';

  // If bus has reached or passed the exit stop or turned around to opposite direction
  useEffect(() => {
    if (bus) {
      const hasFinished =
        bus.current_stop_index >= exitIdx ||
        (bus.assigned_direction_id !== undefined &&
          ticket.trip.direction_id !== undefined &&
          bus.assigned_direction_id !== ticket.trip.direction_id);
      if (hasFinished && isLocal) {
        markTicketAsExpired(ticket.ticket_number);
        if (onTicketExpired) {
          onTicketExpired(ticket.ticket_number);
        }
      }
    }
  }, [bus, exitIdx, isLocal, ticket.ticket_number, ticket.trip.direction_id, onTicketExpired]);

  if (!bus) {
    etaLabel = `Bus ${ticket.trip.fleet_number} scheduled to arrive at ${ticket.trip.boarding_stop.name}`;
  } else {
    const curIdx = bus.current_stop_index;
    const isOppositeDirection =
      bus.assigned_direction_id !== undefined &&
      ticket.trip.direction_id !== undefined &&
      bus.assigned_direction_id !== ticket.trip.direction_id;

    if (curIdx >= exitIdx || isOppositeDirection) {
      // Reached or passed destination
      etaStatus = 'arrived';
      bannerClass = isLocal ? 'banner-expired-completed' : 'banner-green-completed';
      etaLabel = isLocal
        ? `Bus ${ticket.trip.fleet_number} reached ${ticket.trip.exit_stop.name}`
        : `🏁 Bus reached ${ticket.trip.exit_stop.name}! Golden Pass valid all day until 23:59:59.`;
    } else if (curIdx < boardingIdx) {
      // Still approaching boarding stop
      etaStatus = 'approaching';
      bannerClass = 'banner-blue-approaching';

      let etaSecs = 0;
      if (bus.lifecycle_status === 'STOPPED_AT_TERMINAL' || bus.lifecycle_status === 'READY_TO_DEPART') {
        const dwell = bus.dwell_countdown_secs || 60;
        const travel = boardingIdx * 70;
        etaSecs = dwell + travel;
      } else if (bus.lifecycle_status === 'STOPPED_AT_ORIGIN') {
        const dwell = bus.dwell_countdown_secs || 10;
        const travel = (boardingIdx - curIdx) * 70;
        etaSecs = dwell + travel;
      } else {
        const segmentRemaining = (1 - (bus.progress_ratio || 0)) * 60 + 10;
        const intermediate = Math.max(0, boardingIdx - curIdx - 1) * 70;
        etaSecs = Math.max(5, Math.round(segmentRemaining + intermediate));
      }

      etaLabel = `Bus ${ticket.trip.fleet_number} is arriving at your boarding stand (${ticket.trip.boarding_stop.name}) in ${formatMinutesSeconds(
        etaSecs
      )}`;
    } else if (curIdx === boardingIdx && bus.lifecycle_status !== 'MOVING') {
      // At boarding stand and STOPPED (Boarding in progress)
      etaStatus = 'at_stand';
      bannerClass = 'banner-green-arrived';
      if (bus.lifecycle_status === 'STOPPED_AT_TERMINAL') {
        etaLabel = `Bus ${ticket.trip.fleet_number} is stationed at your stand (${ticket.trip.boarding_stop.name}) - Scheduled to depart in ${formatMinutesSeconds(bus.dwell_countdown_secs || 1800)}`;
      } else if (bus.lifecycle_status === 'READY_TO_DEPART') {
        etaLabel = `🟢 Bus ${ticket.trip.fleet_number} is READY TO DEPART at your stand (${ticket.trip.boarding_stop.name}) in ${formatMinutesSeconds(bus.dwell_countdown_secs || 60)}!`;
      } else {
        const dwellLeft = bus.dwell_countdown_secs ? `${bus.dwell_countdown_secs}s` : '10s';
        etaLabel = `🟢 Bus ${ticket.trip.fleet_number} is AT YOUR STAND NOW (${ticket.trip.boarding_stop.name}) - Boarding in progress (${dwellLeft})!`;
      }
    } else {
      // The moment the bus starts moving from the boarding stop (curIdx === boardingIdx && bus.lifecycle_status === 'MOVING')
      // OR while in transit between subsequent stands (curIdx > boardingIdx && curIdx < exitIdx):
      etaStatus = 'on_board';
      bannerClass = 'banner-indigo-transit';
      const remainingStands = Math.max(1, exitIdx - curIdx);
      etaLabel = `🚍 Journey In Progress on Bus ${ticket.trip.fleet_number} • ${bus.next_stop_name || 'Approaching next stand'} (${remainingStands} stands to ${ticket.trip.exit_stop.name})`;
    }
  }

  return (
    <div className={`passenger-trip-banner ${bannerClass}`}>
      <div className="banner-top-bar">
        <div className="banner-badge-group">
          <div className="banner-icon-badge">
            {etaStatus === 'arrived' ? (
              <CheckCircle2 size={15} className="text-white" />
            ) : etaStatus === 'at_stand' ? (
              <CheckCircle2 size={15} className="text-white animate-pulse" />
            ) : (
              <Navigation2 size={15} className="text-white animate-spin-slow" />
            )}
          </div>
          <span className="banner-fleet-tag">Bus {ticket.trip.fleet_number}</span>
          <span className="banner-live-pulse">
            <span className="live-pulse-dot"></span>
            LIVE
          </span>
        </div>

        <div className="banner-actions-right">
          <button type="button" className="banner-view-ticket-btn" onClick={onViewTicket}>
            <Eye size={13} />
            <span>View Ticket</span>
          </button>

          <button
            type="button"
            className="banner-dismiss-btn"
            onClick={onDismiss}
            title={etaStatus === 'arrived' ? 'Close Journey' : 'Dismiss Tracker'}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="banner-message-row">
        {etaStatus === 'arrived' && isLocal ? (
          <div className="banner-expired-row">
            <span className="big-red-expired-tag">EXPIRED</span>
            <span className="arrived-summary-text">
              Bus {ticket.trip.fleet_number} arrived at {ticket.trip.exit_stop.name}
            </span>
          </div>
        ) : (
          <span className="banner-eta-text">{etaLabel}</span>
        )}
      </div>
    </div>
  );
};
