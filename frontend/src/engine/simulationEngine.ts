import { ActiveBus, Stop, TurnaroundEvent } from '../types';

/**
 * Calculates distance in meters between two lat/lng points using Haversine formula
 */
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West)
 */
export function getBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Advance a bus's position along its assigned stops
 */
export function tickBusSimulation(
  bus: ActiveBus,
  stops: Stop[],
  oppositeStops: Stop[],
  oppositeDirectionId: number,
  oppositePatternId: string,
  oppositeDirectionName: string,
  currentDirectionName: string,
  speedMultiplier: number = 1
): { updatedBus: ActiveBus; turnaroundEvent: TurnaroundEvent | null } {
  if (!stops || stops.length < 2) {
    return { updatedBus: bus, turnaroundEvent: null };
  }

  const updated: ActiveBus = { ...bus };
  let turnaroundEvent: TurnaroundEvent | null = null;

  // Terminal Dwell: Reached last station -> Stopped at last station (RED) -> Ready to go (GREEN) -> Turnaround
  if (updated.lifecycle_status === 'STOPPED_AT_TERMINAL') {
    const currentCountdown = (updated.dwell_countdown_secs ?? 12) - (1 * speedMultiplier);
    
    if (currentCountdown <= 0) {
      // Dwell complete! Turnaround to opposite pattern!
      // User requirement: "if one bus is reach the sarkhej now that bus counting on route for 31-down(sarkhej to meghaninagar)"
      // "if bus starting from the last stop or first stop show with green colour now bus is ready to go"
      const terminalStop = stops[stops.length - 1];
      
      turnaroundEvent = {
        id: `${updated.fleet_number}-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        fleet_number: updated.fleet_number,
        bus_model: updated.bus_model,
        terminal_stop_name: terminalStop?.name || 'Terminal',
        from_direction: currentDirectionName,
        to_direction: oppositeDirectionName,
        to_pattern_id: oppositePatternId,
      };

      // Reassign to opposite direction at stop 0
      updated.assigned_direction_id = oppositeDirectionId;
      updated.assigned_pattern_id = oppositePatternId;
      updated.current_stop_index = 0;
      updated.progress_ratio = 0.0;
      updated.lifecycle_status = 'READY_TO_DEPART'; // GREEN: ready to go from terminal
      updated.dwell_countdown_secs = 6;
      updated.speed_kmh = 0;
      updated.rounds_completed_today = Math.round((updated.rounds_completed_today + 0.5) * 10) / 10;

      if (oppositeStops && oppositeStops.length > 0) {
        updated.latitude = oppositeStops[0].latitude;
        updated.longitude = oppositeStops[0].longitude;
        updated.next_stop_name = oppositeStops[1]?.name || oppositeStops[0].name;
      }
    } else {
      updated.dwell_countdown_secs = Math.max(0, currentCountdown);
    }

    return { updatedBus: updated, turnaroundEvent };
  }

  // Ready to depart from first station / terminal (GREEN)
  if (updated.lifecycle_status === 'READY_TO_DEPART') {
    const countdown = (updated.dwell_countdown_secs ?? 5) - (1 * speedMultiplier);
    if (countdown <= 0) {
      // Start moving!
      updated.lifecycle_status = 'MOVING'; // GREEN: moving
      updated.speed_kmh = 24 + Math.floor(Math.random() * 8);
      updated.dwell_countdown_secs = 0;
    } else {
      updated.dwell_countdown_secs = countdown;
    }
    return { updatedBus: updated, turnaroundEvent: null };
  }

  // Stopped at origin (RED)
  if (updated.lifecycle_status === 'STOPPED_AT_ORIGIN') {
    const countdown = (updated.dwell_countdown_secs ?? 8) - (1 * speedMultiplier);
    if (countdown <= 0) {
      // Transition to ready to depart (GREEN)
      updated.lifecycle_status = 'READY_TO_DEPART';
      updated.dwell_countdown_secs = 5;
    } else {
      updated.dwell_countdown_secs = countdown;
    }
    return { updatedBus: updated, turnaroundEvent: null };
  }

  // MOVING along route (GREEN)
  // Step progression
  const curIdx = updated.current_stop_index;
  const nextIdx = curIdx + 1;

  if (nextIdx >= stops.length) {
    // Arrived at the final terminal stop!
    // User requirement: "which bus is stop on last station or first station show with red"
    const lastStop = stops[stops.length - 1];
    updated.current_stop_index = stops.length - 1;
    updated.progress_ratio = 1.0;
    updated.latitude = lastStop.latitude;
    updated.longitude = lastStop.longitude;
    updated.speed_kmh = 0;
    updated.lifecycle_status = 'STOPPED_AT_TERMINAL'; // RED
    updated.dwell_countdown_secs = 12; // 12 seconds dwell before turnaround
    updated.next_stop_name = `Reached Terminal (${lastStop.name})`;

    return { updatedBus: updated, turnaroundEvent: null };
  }

  const curStop = stops[curIdx];
  const nextStop = stops[nextIdx];

  // Increment progress between curStop and nextStop
  // Base speed: 0.05 step per tick (~20 ticks to complete segment between stops)
  const stepIncrement = 0.04 * speedMultiplier;
  let newRatio = updated.progress_ratio + stepIncrement;

  if (newRatio >= 1.0) {
    // Reached nextStop
    const newStopIdx = curIdx + 1;
    if (newStopIdx >= stops.length - 1) {
      // Reached final stop!
      updated.current_stop_index = stops.length - 1;
      updated.progress_ratio = 0.0;
      updated.latitude = stops[stops.length - 1].latitude;
      updated.longitude = stops[stops.length - 1].longitude;
      updated.speed_kmh = 0;
      updated.lifecycle_status = 'STOPPED_AT_TERMINAL'; // RED
      updated.dwell_countdown_secs = 12;
      updated.next_stop_name = `Reached Terminal (${stops[stops.length - 1].name})`;
    } else {
      // Reached intermediate stop, continue to next
      updated.current_stop_index = newStopIdx;
      updated.progress_ratio = 0.0;
      updated.latitude = stops[newStopIdx].latitude;
      updated.longitude = stops[newStopIdx].longitude;
      updated.speed_kmh = 24 + Math.floor(Math.random() * 8);
      updated.next_stop_name = stops[newStopIdx + 1]?.name || 'Next Stop';
    }
  } else {
    // Interpolate coordinates along segment
    updated.progress_ratio = newRatio;
    updated.latitude = curStop.latitude + (nextStop.latitude - curStop.latitude) * newRatio;
    updated.longitude = curStop.longitude + (nextStop.longitude - curStop.longitude) * newRatio;
    updated.heading_degrees = getBearingDegrees(curStop.latitude, curStop.longitude, nextStop.latitude, nextStop.longitude);
    updated.speed_kmh = 24 + Math.floor(Math.random() * 8);
    updated.next_stop_name = nextStop.name;
    const remainingDist = getDistanceMeters(updated.latitude, updated.longitude, nextStop.latitude, nextStop.longitude);
    updated.eta_next_stop_secs = Math.max(5, Math.round(remainingDist / ((updated.speed_kmh * 1000) / 3600)));
  }

  return { updatedBus: updated, turnaroundEvent: null };
}
